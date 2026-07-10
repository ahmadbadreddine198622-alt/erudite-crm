import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// landlordHeartbeat — V3 Phase 2 (proactive heartbeat). Mirrors auroraHeartbeat (the Deal side).
//
// Periodically re-analyzes ACTIVE landlords whose brain output is STALE, so silence-decay and
// time-based follow-ups get detected WITHOUT waiting for a new inbound message or a manual Analyse
// click. It only TRIGGERS the existing landlordOrchestrator (via asServiceRole.functions.invoke — the
// same path routeWhatsAppMessage uses) — it never changes the brain's logic. The orchestrator's own
// 6h debounce protects against over-running; force defaults to false.
//
// INERT until you wire a Base44 schedule to it. Time-bounded + batched + capped + dry_run so it can
// never run away. Optional hardening: if HEARTBEAT_SECRET env is set, require an x-heartbeat-secret
// header (no-op until set; matches the auroraHeartbeat open-cron convention by default).
//
// Body: { staleness_hours?=48, batch_size?=10, max?=80, dry_run?=false, force?=false }

const CEILING_MS = 180000;
const STOP_AT_MS = CEILING_MS - 40000;
const TERMINAL_STAGES = ['deal_closed'];

Deno.serve(async (req) => {
  const startedAt = Date.now();
  try {
    const base44 = createClientFromRequest(req);

    const secret = Deno.env.get('HEARTBEAT_SECRET') || '';
    if (secret && req.headers.get('x-heartbeat-secret') !== secret) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const svc = base44.asServiceRole;

    let body = {};
    try { body = await req.json(); } catch (_) {}
    const stalenessHours = (typeof body.staleness_hours === 'number' && body.staleness_hours > 0) ? body.staleness_hours : 48;
    const batchSize = (typeof body.batch_size === 'number' && body.batch_size > 0) ? Math.floor(body.batch_size) : 10;
    const max = (typeof body.max === 'number' && body.max > 0) ? Math.floor(body.max) : 80;
    const dryRun = body.dry_run === true;
    const force = body.force === true;

    // Active landlords whose last orchestrator run is older than the staleness window.
    const all = await svc.entities.Landlord.list('-updated_date', 5000).catch(() => []);
    const cutoffMs = stalenessHours * 3.6e6;
    const due = (all || []).filter((l) =>
      l && !TERMINAL_STAGES.includes(l.stage) &&
      (Date.now() - new Date(l.last_orchestrator_run_at || 0).getTime()) >= cutoffMs
    ).slice(0, max);

    if (dryRun) {
      return Response.json({
        dry_run: true,
        due_count: due.length,
        staleness_hours: stalenessHours,
        cap: max,
        sample: due.slice(0, 5).map((l) => ({ id: l.id, stage: l.stage, last_run: l.last_orchestrator_run_at || null })),
      });
    }

    let processed = 0;
    const failures = [];
    for (let i = 0; i < due.length; i += batchSize) {
      if (Date.now() - startedAt > STOP_AT_MS) break; // leave the rest for the next tick
      const batch = due.slice(i, i + batchSize);
      const res = await Promise.allSettled(
        batch.map((l) => svc.functions.invoke('landlordOrchestrator', { landlord_id: l.id, force }))
      );
      res.forEach((r, j) => {
        if (r.status === 'fulfilled') processed++;
        else failures.push({ landlord_id: batch[j].id, error: String(r.reason && r.reason.message ? r.reason.message : r.reason).slice(0, 140) });
      });
    }

    const remaining = Math.max(0, due.length - processed);
    return Response.json({
      status: 'ok',
      candidates: due.length,
      processed,
      failed: failures.length,
      remaining,
      has_more: remaining > 0,
      staleness_hours: stalenessHours,
      failures: failures.slice(0, 10),
      elapsed_ms: Date.now() - startedAt,
      summary: `Re-analyzed ${processed}/${due.length} stale active landlords (> ${stalenessHours}h since last run).`,
    });
  } catch (error) {
    return Response.json({ error: (error && error.message) ? error.message : String(error), elapsed_ms: Date.now() - startedAt }, { status: 500 });
  }
});
