import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * probeOutcomeLedger — V4 diagnostic: ledger totals, duplicate audit, attribution coverage.
 * Read-only by default. Pass { cleanup_duplicates: true } to delete the newer copy of any
 * (kind, source_ref) duplicate pair — a data repair for rows raced in by concurrent backfill
 * sweeps; real events are never touched (they have unique refs).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const cleanup = body.cleanup_duplicates === true;
    const rows = await svc.entities.OutcomeEvent.filter({}, '-created_date', 10000).catch(() => []);
    const all = Array.isArray(rows) ? rows : [];
    const byKind = {};
    const byChannel = {};
    const refCount = new Map();
    let withAngle = 0, withLatency = 0, backfilled = 0;
    for (const e of all) {
      byKind[e.kind] = (byKind[e.kind] || 0) + 1;
      byChannel[e.channel] = (byChannel[e.channel] || 0) + 1;
      if (e.source_ref) {
        const k = `${e.kind}|${e.source_ref}`;
        refCount.set(k, (refCount.get(k) || 0) + 1);
      }
      if (e.angle_used) withAngle++;
      if (typeof e.latency_hours === 'number') withLatency++;
      if (e.backfilled) backfilled++;
    }
    const dupes = [...refCount.entries()].filter(([, n]) => n > 1);
    let removed = 0;
    if (cleanup && dupes.length) {
      const seen = new Set();
      // rows are sorted -created_date (newest first): keep the OLDEST copy, delete newer ones.
      const ordered = all.slice().reverse();
      const keep = new Set();
      for (const e of ordered) {
        if (!e.source_ref) continue;
        const k = `${e.kind}|${e.source_ref}`;
        if (!keep.has(k)) { keep.add(k); continue; }
        try { await svc.entities.OutcomeEvent.delete(e.id); removed++; } catch (_) { /* best-effort */ }
      }
    }
    return Response.json({
      removed_duplicates: removed,
      total: all.length,
      by_kind: byKind,
      by_channel: byChannel,
      duplicates: dupes.length,
      duplicate_samples: dupes.slice(0, 10).map(([k, n]) => ({ key: k, n })),
      with_angle: withAngle,
      with_latency: withLatency,
      backfilled,
      distinct_landlords: new Set(all.map((e) => e.landlord_id)).size,
    });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});
