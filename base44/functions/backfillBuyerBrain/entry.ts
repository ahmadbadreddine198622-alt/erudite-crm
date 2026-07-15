import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// backfillBuyerBrain — the BUYER SWEEP daemon (BUYER BRAIN V1 B2; twin of
// backfillLandlordBrainV2 with one deliberate architectural divergence).
//
// SINGLE-WRITER DISCIPLINE: unlike the landlord backfill (which predates the tiered
// orchestrator and carries its own inline Haiku prompt — a third KEEP-IN-SYNC surface),
// this daemon writes NOTHING to the Lead itself. It is a bounded ROUTER + PACER: it
// selects unprocessed active leads, resolves the tier, and hands every one to
// buyerOrchestrator (the single thesis-capable writer, which owns both tiers, all field
// normalization, and the LeadScoreSnapshot append). Zero prompt drift by construction.
//
// COST LEDGER: every attempt persists a BuyerSweepLog row (run_group, effective tier,
// model, measured tokens, computed cost) so a sweep's spend is queryable live while the
// daemon keeps running past any gateway cut. est_cost_usd is computed in CODE from the
// orchestrator's measured usage x published per-MTok pricing.
//
// Bounding (same resumable pattern as the landlord twin): per-invocation caps for full
// (Opus, ~40s each) and cold (Haiku, ~25s each) runs PLUS a wall-clock budget; when a cap
// or the budget is hit the rest are DEFERRED — left unprocessed (no stamp) so the next
// invocation picks them up. 429s back off the whole sweep. Failures leave the lead
// unprocessed for retry (the orchestrator stamps ai_processing_status itself).
//
// Call with: { limit, max_full, max_cold, delay_ms, force_cold, lead_ids, run_group,
//              triggered_by } — all optional.
// Returns: { status, processed_full, processed_cold, deferred, failures, has_more,
//            remaining, usage: { input_tokens, output_tokens, est_cost_usd, by_tier } }

const MAX_FULL_DEFAULT = 4;      // Opus handoffs per invocation
const MAX_COLD_DEFAULT = 8;      // Haiku handoffs per invocation
const DELAY_MS_DEFAULT = 1500;   // backoff between orchestrator invokes (429 safety)
const TIME_BUDGET_MS = 150_000;  // hard wall-clock stop (margin under the 180s ceiling)
const RESERVE_MS = 45_000;       // headroom reserved for one in-flight run + its writes

// Buyer entry stages — KEEP IN SYNC with buyerOrchestrator's ENTRY_STAGES.
const ENTRY_STAGES = new Set(['intake_clarify', 'contact_identity', 'new_tenant_lead']);

// KEEP IN SYNC with buyerOrchestrator's resolveTier — sweep variant: engagement is decided
// ONLY from the stage already on the record (NO per-lead message/activity queries — avoids a
// 429 surface of 2+ queries x batch size). A contact-engaged lead still sitting in an entry
// stage stays cold here; the orchestrator's own engagement-wins routing upgrades it to full
// the moment it runs (it DOES load real messages), and routeWhatsAppMessage upgrades it the
// instant it replies. forceCold wins over everything (deliberate bulk cost control).
function resolveTier({ lead, forceCold = false }) {
  if (forceCold === true) return 'cold';
  const stageEngaged = !!lead.stage && !ENTRY_STAGES.has(lead.stage);
  return stageEngaged ? 'full' : 'cold';
}

// Pricing per MTok — KEEP IN SYNC with buyerOrchestrator's FULL_MODEL/COLD_MODEL choices.
const PRICE = {
  full: { in: 5, out: 25 },   // claude-opus-4-8
  cold: { in: 1, out: 5 },    // claude-haiku-4-5
};
function estCost(tier, inTok, outTok) {
  const p = PRICE[tier] || PRICE.cold;
  return Math.round(((inTok || 0) * p.in / 1e6 + (outTok || 0) * p.out / 1e6) * 1e6) / 1e6;
}

function isRateLimit(err) {
  const s = `${err?.status || ''} ${err?.message || err || ''}`.toLowerCase();
  return s.includes('429') || s.includes('rate limit') || s.includes('rate_limit') || s.includes('too many requests');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { user = null; }
    if (user && user.role !== 'admin' && !String(user.email || '').toLowerCase().includes('no-reply.base44.com')) {
      return Response.json({ error: 'admin only' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    let body = {};
    try { body = await req.json(); } catch (_) {}
    const maxFull = Math.min(Math.max(0, Number(body.max_full ?? MAX_FULL_DEFAULT)), 12);
    const maxCold = Math.min(Math.max(0, Number(body.max_cold ?? MAX_COLD_DEFAULT)), 25);
    const delayMs = Number(body.delay_ms ?? DELAY_MS_DEFAULT);
    const forceCold = body.force_cold === true;
    const runGroup = typeof body.run_group === 'string' && body.run_group.trim() ? body.run_group.trim().slice(0, 60) : `sweep_${new Date().toISOString().slice(0, 10)}`;
    const triggeredBy = typeof body.triggered_by === 'string' && body.triggered_by.trim() ? body.triggered_by.trim().slice(0, 60) : 'backfill_sweep';
    const startTime = Date.now();

    // Fetch ALL leads, filter unprocessed client-side (same rationale as the landlord twin:
    // a shallow paged window can sit entirely on processed records and falsely report done).
    const allLeads = await svc.entities.Lead.list('-created_date', 5000).catch(() => []);
    let unprocessed = (Array.isArray(allLeads) ? allLeads : []).filter((l) =>
      l && l.status === 'active' &&
      (!l.ai_processed_at || l.ai_processing_status === 'failed' || l.ai_processing_status === 'needs_retry')
    );
    if (Array.isArray(body.lead_ids) && body.lead_ids.length) {
      const allow = new Set(body.lead_ids.map((id) => String(id)));
      unprocessed = unprocessed.filter((l) => allow.has(String(l.id)));
    }
    const totalUnprocessed = unprocessed.length;

    if (!totalUnprocessed) {
      return Response.json({
        status: 'complete', run_group: runGroup,
        processed_full: 0, processed_cold: 0, deferred: 0, failures: [],
        has_more: false, remaining: 0,
        usage: { input_tokens: 0, output_tokens: 0, est_cost_usd: 0, by_tier: {} },
        message: 'Sweep complete - no remaining unprocessed active leads for this filter.',
      });
    }

    const results = { processed_full: 0, processed_cold: 0, deferred: 0, failures: [] };
    const usage = { input_tokens: 0, output_tokens: 0, est_cost_usd: 0, by_tier: { full: { runs: 0, input_tokens: 0, output_tokens: 0, est_cost_usd: 0 }, cold: { runs: 0, input_tokens: 0, output_tokens: 0, est_cost_usd: 0 } } };
    let rateLimited = false;

    for (const lead of unprocessed) {
      const requestedTier = resolveTier({ lead, forceCold });
      const fullBudgetLeft = results.processed_full < maxFull;
      const coldBudgetLeft = results.processed_cold < maxCold;
      const timeLeft = (Date.now() - startTime) < (TIME_BUDGET_MS - RESERVE_MS);
      if (!timeLeft || (requestedTier === 'full' && !fullBudgetLeft) || (requestedTier === 'cold' && !coldBudgetLeft)) {
        results.deferred++;
        continue;
      }

      const runStart = Date.now();
      try {
        // Synchronous handoff — the orchestrator is the single writer: it stamps
        // ai_processed_at / ai_processing_status and appends the LeadScoreSnapshot itself.
        // force:true beats its 6h debounce (safe: stateless re-analysis is its contract).
        const res = await svc.functions.invoke('buyerOrchestrator', {
          lead_id: lead.id, force: true, tier: requestedTier, force_cold: forceCold, triggered_by: triggeredBy,
        });
        const data = res?.data ?? res;
        if (!data || data.error) throw new Error(data?.error || 'orchestrator returned no data');

        // Effective tier from the RESPONSE — engagement-wins routing may upgrade cold→full.
        const tier = data.tier === 'full' ? 'full' : 'cold';
        const inTok = Number(data?.usage?.input_tokens) || 0;
        const outTok = Number(data?.usage?.output_tokens) || 0;
        const cost = estCost(tier, inTok, outTok);
        if (tier === 'full') results.processed_full++; else results.processed_cold++;
        usage.input_tokens += inTok; usage.output_tokens += outTok; usage.est_cost_usd = Math.round((usage.est_cost_usd + cost) * 1e6) / 1e6;
        usage.by_tier[tier].runs++; usage.by_tier[tier].input_tokens += inTok; usage.by_tier[tier].output_tokens += outTok;
        usage.by_tier[tier].est_cost_usd = Math.round((usage.by_tier[tier].est_cost_usd + cost) * 1e6) / 1e6;

        // Cost ledger row — non-fatal, never blocks the sweep.
        try {
          await svc.entities.BuyerSweepLog.create({
            run_group: runGroup, lead_id: lead.id, lead_name: lead.full_name || '',
            tier, model: data.model || '', input_tokens: inTok, output_tokens: outTok,
            est_cost_usd: cost, duration_ms: Date.now() - runStart, status: 'ok', triggered_by: triggeredBy,
          });
        } catch (_) { /* ledger must never block */ }
      } catch (err) {
        // Failure → leave the lead unprocessed (no stamp from us) so the next cycle retries.
        results.failures.push({ lead_id: lead.id, name: lead.full_name || '', error: String(err?.message || err) });
        try {
          await svc.entities.BuyerSweepLog.create({
            run_group: runGroup, lead_id: lead.id, lead_name: lead.full_name || '',
            tier: requestedTier, duration_ms: Date.now() - runStart, status: 'failed',
            error: String(err?.message || err).slice(0, 300), triggered_by: triggeredBy,
          });
        } catch (_) { /* ledger must never block */ }
        if (isRateLimit(err)) { rateLimited = true; break; }
      }
      if (delayMs > 0) await sleep(delayMs);
    }

    const processed = results.processed_full + results.processed_cold;
    const remaining = Math.max(0, totalUnprocessed - processed);
    return Response.json({
      status: rateLimited ? 'rate_limited' : (remaining > 0 ? 'in_progress' : 'complete'),
      run_group: runGroup,
      batch_info: { max_full: maxFull, max_cold: maxCold, delay_ms: delayMs, force_cold: forceCold, elapsed_ms: Date.now() - startTime },
      processed_full: results.processed_full,
      processed_cold: results.processed_cold,
      deferred: results.deferred,
      failures: results.failures.slice(0, 20),
      has_more: remaining > 0,
      remaining,
      usage,
      summary: `Full ${results.processed_full}, cold ${results.processed_cold}, deferred ${results.deferred}, failed ${results.failures.length}; ~$${usage.est_cost_usd} this invocation; ${remaining} remaining${rateLimited ? ' (rate-limited — backed off)' : ''}.`,
    });
  } catch (error) {
    console.error('backfillBuyerBrain error:', error);
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});
