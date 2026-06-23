import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// backfillOrchestratorTasks
// Backfills ai_suggested_tasks across landlords by invoking landlordOrchestrator per record.
//
// Re-triggerable: each call processes a TIME-BOUNDED slice of the pending set and returns
// { remaining, done }. The caller re-invokes until done === true. Idempotent and resumable.
//
// AUTH: authenticated ADMIN only (401 no user, 403 role !== 'admin'). The orchestrator is
//   invoked in the SAME user context via base44.functions.invoke(...) — NOT asServiceRole —
//   so landlordOrchestrator's own auth.me() survives the function-to-function hop.
//
// Body: { dry_run?: boolean, max?: number }
//   dry_run → count pending + report ai_suggested_tasks shape (null/undefined/array), run nothing, $0.
//   max     → optional hard cap on records this call (probe=1 / canary=10). When unset, the time
//             guard alone decides how many run (no fixed batch size).
//
// HOW THE FOUR EDGE CASES ARE HANDLED
//   (1) Zero-task result: a data-poor lead can legitimately produce []. That is a SUCCESS
//       ("ran, no tasks"), NOT a failure — success = the orchestrator RAN (ok===true OR it
//       returned an ai_suggested_tasks array, empty included). It cannot loop forever: the
//       orchestrator writes [] back, and {ai_suggested_tasks: null} does NOT match a non-null
//       array (verified live: the filter excludes records that already hold an array), so the
//       record leaves the pending set.
//   (2) Stop condition + RLS: countPending() and the work-list selection use the IDENTICAL
//       client (request-scoped) and the IDENTICAL filter, so they can never disagree on which
//       records match. (Gross RLS under-count is caught by the dry-run's remaining≈596 echo.)
//   (3) Out of time mid-retry: returns { deferred:true }. The loop then stops and leaves that
//       landlord cleanly PENDING (still null → retried next call). It is NOT recorded as a
//       failure.
//   (4) Transient classification: a returned orchestrator error (e.g. its 500 "Claude call
//       failed" path) is treated as TRANSIENT and retried by default — only clearly-permanent
//       errors (not found / unauthorized / forbidden / required) are non-retryable. Thrown
//       errors retry on 429/5xx and bare network (status 0).
//
// No raw token handling; only ids + truncated error strings are ever logged.

const CEILING_MS = 180000;             // platform function ceiling
const STOP_AT_MS = CEILING_MS - 40000; // stop ~40s before the ceiling (140s)
const MAX_RETRIES = 3;                  // exponential backoff on transient: 2s, 4s, 8s
const WORK_WINDOW = 100;                // pending records fetched per call (headroom, not a batch cap)
const PENDING_FILTER = { ai_suggested_tasks: null }; // plain-object equality (SDK rejects $operators)
const PERMANENT_ERR = /not found|unauthorized|forbidden|required/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hasTasks = (l) => Array.isArray(l?.ai_suggested_tasks) && l.ai_suggested_tasks.length > 0;

// base44.functions.invoke may return the response object directly or wrapped in `.data`.
const unwrap = (res) => (res && typeof res === 'object' && 'data' in res) ? res.data : res;
// Best-effort HTTP status from a thrown error (for 429/5xx detection on the throw path).
const statusOf = (x) => (x && (x.status || x.statusCode || (x.response && x.response.status))) || 0;
const isTransient = (st) => st === 429 || (st >= 500 && st <= 599);

Deno.serve(async (req) => {
  const startedAt = Date.now();
  try {
    const base44 = createClientFromRequest(req);

    // --- Auth gate: authenticated admin only ---
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { user = null; }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    let body = {};
    try { body = await req.json(); } catch (_) {}
    const dryRun = body.dry_run === true;
    const max = (typeof body.max === 'number' && body.max > 0) ? Math.floor(body.max) : Infinity;

    // (2) Same client + same filter for counting and selecting → they cannot disagree.
    const countPending = async () => (await base44.entities.Landlord.filter(PENDING_FILTER, 'created_date', 2000)).length;

    if (dryRun) {
      const sample = await base44.entities.Landlord.filter(PENDING_FILTER, 'created_date', 5);
      const remaining = await countPending();
      return Response.json({
        dry_run: true,
        user_role: user.role,
        remaining,
        sample: sample.map((l) => ({
          id: l.id,
          ai_suggested_tasks_shape: l.ai_suggested_tasks === undefined ? 'undefined'
            : l.ai_suggested_tasks === null ? 'null'
            : Array.isArray(l.ai_suggested_tasks) ? `array(${l.ai_suggested_tasks.length})`
            : typeof l.ai_suggested_tasks,
        })),
      });
    }

    const pending = await base44.entities.Landlord.filter(PENDING_FILTER, 'created_date', WORK_WINDOW);
    const results = { processed: 0, succeeded: 0, empty: 0, failed: 0, failures: [] };

    // Returns one of: { ok:true, count } | { ok:false, reason|error } | { deferred:true }
    async function runOne(id) {
      let lastErr = 'unknown';
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        let transient;
        try {
          const res = await base44.functions.invoke('landlordOrchestrator', { landlord_id: id, force: true });
          const data = unwrap(res);
          const tasks = data && Array.isArray(data.ai_suggested_tasks) ? data.ai_suggested_tasks : null;
          // (1) RAN === success, including a legitimate empty result.
          if (data && (data.ok === true || tasks !== null)) return { ok: true, count: tasks ? tasks.length : 0 };
          // Returned an error body (no run). (4) Default to transient (e.g. "Claude call failed").
          lastErr = (data && data.error ? String(data.error) : 'unknown_error').slice(0, 120);
          if (PERMANENT_ERR.test(lastErr)) return { ok: false, reason: lastErr };
          transient = true;
        } catch (err) {
          const st = statusOf(err);
          lastErr = (err && err.message ? err.message : String(err)).slice(0, 120);
          // (4) Retry transient HTTP (429/5xx) and bare network (status 0); permanent 4xx → fail.
          transient = isTransient(st) || st === 0;
          if (!transient) return { ok: false, error: lastErr };
        }
        // transient → back off if the budget allows; otherwise (3) DEFER (cleanly pending, not a failure).
        if (attempt < MAX_RETRIES) {
          const wait = 2000 * 2 ** attempt;
          if (Date.now() - startedAt + wait > STOP_AT_MS) return { deferred: true };
          await sleep(wait);
          continue;
        }
        return { ok: false, error: `transient_exhausted: ${lastErr}` };
      }
      return { ok: false, error: 'max_retries_exceeded' };
    }

    for (const l of pending) {
      if (results.processed >= max) break;             // optional explicit cap (probe/canary)
      if (Date.now() - startedAt > STOP_AT_MS) break;  // (3) time-aware: stop ~40s before ceiling
      if (hasTasks(l)) continue;                        // (1) guard against a loose null match
      const r = await runOne(l.id);
      if (r.deferred) break;                            // (3) out of time mid-retry → leave pending, stop
      results.processed++;
      if (r.ok) { results.succeeded++; if (r.count === 0) results.empty++; }
      else { results.failed++; results.failures.push({ id: l.id, ...r }); }
    }

    const remaining = await countPending();  // (2) real count, same client + filter
    return Response.json({
      processed: results.processed,
      succeeded: results.succeeded,
      empty: results.empty,           // succeeded but produced 0 tasks (data-poor leads)
      failed: results.failed,
      remaining,
      done: remaining === 0,
      elapsed_ms: Date.now() - startedAt,
      failures: results.failures.slice(0, 10),
    });
  } catch (error) {
    return Response.json({ error: (error && error.message) ? error.message : String(error), elapsed_ms: Date.now() - startedAt }, { status: 500 });
  }
});
