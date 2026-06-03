import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Dedup cleanup for duplicate Peninsula 2 LandlordProperty rows.
// Groups links by landlord_id|property_id (scoped to Peninsula 2 landlords),
// keeps the OLDEST row of each group (created_date asc, id asc tiebreak), and
// targets the rest for deletion.
//
// PREVIEW by default: returns the exact row-ids that WOULD be deleted, deletes
// nothing. Append ?confirm=delete to actually delete. Idempotent: re-running
// recomputes from live data, so a partial delete just resumes. Chunked under a
// soft deadline. Only ever deletes EXTRA rows of a duplicated pair — never a
// unique pair, never the kept oldest row.

const PROJECT_ID = '6a1808d8793c2b7606599f55';
const PAGE = 200;
const CONCURRENCY = 10;
const SOFT_DEADLINE_MS = 26000;

async function listAllRaw(entity: any, filter: any) {
  const out: any[] = [];
  for (let page = 0; ; page++) {
    const batch = await entity.filter(filter, '-created_date', PAGE, page * PAGE);
    out.push(...batch);
    if (!batch || batch.length < PAGE) break;
  }
  return out;
}

async function pool(thunks: (() => Promise<void>)[], start: number) {
  for (let i = 0; i < thunks.length; i += CONCURRENCY) {
    if (Date.now() - start > SOFT_DEADLINE_MS) return;
    await Promise.all(thunks.slice(i, i + CONCURRENCY).map((t) => t()));
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user: any = null;
  try { user = await base44.auth.me(); } catch (_) { /* gate below */ }
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const svc = base44.asServiceRole.entities;
  const start = Date.now();

  // Peninsula 2 landlord ids
  const landlords = await listAllRaw(svc.Landlord, { project_id: PROJECT_ID });
  const p2 = new Set<string>(landlords.map((L: any) => L.id));

  // all links, deduped by record id, scoped to Peninsula 2
  const byId = new Map<string, any>();
  for (const X of await listAllRaw(svc.LandlordProperty, {})) if (X.id) byId.set(X.id, X);
  const rows = [...byId.values()].filter((X: any) => p2.has(X.landlord_id));

  // group by pair
  const groups = new Map<string, any[]>();
  for (const X of rows) {
    const sig = `${X.landlord_id}|${X.property_id}`;
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig)!.push(X);
  }

  // for each duplicated pair: keep oldest (created_date asc, id asc), delete rest
  const toDelete: { id: string; pair: string }[] = [];
  let duplicatedPairs = 0;
  for (const [sig, g] of groups) {
    if (g.length <= 1) continue;
    duplicatedPairs++;
    g.sort((a, b) => {
      const ca = String(a.created_date || ''), cb = String(b.created_date || '');
      if (ca !== cb) return ca < cb ? -1 : 1;
      return String(a.id) < String(b.id) ? -1 : 1;
    });
    for (let i = 1; i < g.length; i++) toDelete.push({ id: g[i].id, pair: sig });
  }

  const confirm = new URL(req.url).searchParams.get('confirm') === 'delete';
  if (!confirm) {
    return Response.json({
      mode: 'preview_NO_DELETE',
      peninsula2_landlords: landlords.length,
      total_link_rows: rows.length,
      distinct_pairs: groups.size,
      duplicated_pairs: duplicatedPairs,
      rows_to_delete: toDelete.length,
      delete_ids: toDelete.map((d) => d.id),
      delete_detail_sample: toDelete.slice(0, 25),
      note: 'Nothing deleted. Re-call ?confirm=delete to remove these row-ids.',
    });
  }

  // delete mode (chunked, idempotent)
  const errors: any[] = [];
  let deleted = 0;
  await pool(toDelete.map((d) => async () => {
    try { await svc.LandlordProperty.delete(d.id); deleted++; }
    catch (e) { errors.push({ id: d.id, error: String(e) }); }
  }), start);

  return Response.json({
    mode: 'delete',
    targeted: toDelete.length,
    deleted_this_run: deleted,
    remaining_to_delete: toDelete.length - deleted,
    done: deleted === toDelete.length,
    distinct_pairs_should_remain: groups.size,
    durationMs: Date.now() - start,
    errorCount: errors.length,
    errors: errors.slice(0, 25),
  });
});
