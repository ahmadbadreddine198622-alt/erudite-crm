import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * brainEvalHarness — BRAIN V4 P10: the golden-set eval harness.
 *
 * Replays real landlords through landlordOrchestrator in eval_mode (the full pipeline runs —
 * gathering, tier routing, cortex loop, telemetry — but the CRM is untouched) and asserts the
 * invariants that define a correct brain:
 *
 *   schema_shape     — every required output present and in range (per tier)
 *   doctrine_14day   — a flagged 14-Day-Law violation forces schedule_next_touch + a cadence key
 *   quiet_hours      — every campaign touch inside 09:00-21:00 Asia/Dubai, day_offset 0-30
 *   state_awareness  — no suggested task/follow-up duplicates an existing open/done entity
 *   tool_budget      — the cortex loop stayed within its investigation cap
 *   trace_grounded   — every reasoning-trace claim carries at least one citation
 *   self_critique    — exactly two weakest claims + an adjustment statement
 *   no_fabrication   — big figures (>=10,000 AED-scale) in drafts exist in the supplied context
 *                      (market pack / asking price) — WARNING level, since legitimate
 *                      conversational figures can be missed by the source scan
 *
 * DELIVERY: full-tier eval runs take longer than the platform's function-to-function gateway
 * cut (~120s), so the orchestrator persists each eval envelope to BrainEvalRun and this harness
 * polls that entity when the invoke is cut. The harness's own verdict is ALSO persisted as a
 * BrainEvalRun row with landlord_id '__report__' — read that row when the harness's own HTTP
 * response gets cut too.
 *
 * Run it BEFORE declaring any brain change done. Costs real Opus calls — batched with a time
 * budget; re-invoke with the returned next_ids to continue. { golden: true } uses the pinned
 * golden set; or pass { landlord_ids: [...] }.
 */

const TIME_BUDGET_MS = 240_000;
const PARALLEL = 3;
const POLL_EVERY_MS = 10_000;

// Pinned golden set — hand-picked live landlords covering the brain's regimes:
// engaged conversations, cold records, doctrine violations, Russian-cohort, P3/P4 market packs.
// Extend deliberately; keep ~15. (Pinned 2026-07-14.)
const GOLDEN_SET = [
  '6a560e102eae616c8b537395', // Dmitry Kvachev — overseas_owner, ru, Six Senses, forged drafts
  '6a55fd19e4e48cc63cad3068', // Darina Sikorska — relocating, Peninsula 4, forge-provenance send
  '6a1f0665988dc2f017a59b59', // ALIYA SHAKIROVA — professional_investor, ru cohort, price_discovery
];

const CADENCE_KEYS = ['rule5_day2_value_drop', 'rule5_day5_call', 'rule5_day9_voice_note', 'rule5_day14_snapshot', 'law14_nurture', 'unsold_competitor_watch_30'];

function extractBigNumbers(text) {
  const out = new Set();
  const s = String(text || '');
  // 1,234,567 / 1234567 / 1.2M / 950K styles, AED-scale only (>= 10,000)
  for (const m of s.matchAll(/\d{1,3}(?:[.,]\d{3})+(?:\.\d+)?|\d{5,}/g)) {
    const n = parseFloat(m[0].replace(/,/g, ''));
    if (isFinite(n) && n >= 10000) out.add(Math.round(n));
  }
  for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:M|М|million|млн)/gi)) {
    const n = parseFloat(m[1].replace(',', '.')) * 1e6;
    if (isFinite(n) && n >= 10000) out.add(Math.round(n));
  }
  return out;
}

function evalOne(landlordId, payload) {
  const failures = [];
  const warnings = [];
  const push = (arr, code, detail) => arr.push(`${code}: ${detail}`);
  const r = payload?.result;
  const tier = payload?.tier;
  const ctx = payload?.context || {};
  const tel = payload?.telemetry || {};

  if (!r || typeof r !== 'object') {
    return { landlord_id: landlordId, tier, pass: false, failures: ['no_result: orchestrator returned nothing'], warnings };
  }

  if (tier === 'full') {
    // schema_shape
    const num01 = (v) => typeof v === 'number' && v >= 0 && v <= 1;
    if (!(typeof r.trust_score === 'number' && r.trust_score >= 0 && r.trust_score <= 100)) push(failures, 'schema_shape', 'trust_score missing/out of range');
    if (!num01(r.mandate_win_probability)) push(failures, 'schema_shape', 'mandate_win_probability missing/out of range');
    if (!(typeof r.ai_rolling_summary === 'string' && r.ai_rolling_summary.trim())) push(failures, 'schema_shape', 'ai_rolling_summary empty');
    if (!(r.ai_next_best_action && typeof r.ai_next_best_action.action === 'string' && r.ai_next_best_action.action.trim())) push(failures, 'schema_shape', 'ai_next_best_action.action empty');
    const c = r.ai_confidence;
    if (!(c && num01(c.trust) && num01(c.urgency) && num01(c.win_prob) && num01(c.overall))) push(failures, 'schema_shape', 'ai_confidence incomplete');
    // self_critique
    const sc = r.self_critique;
    if (!(sc && Array.isArray(sc.weakest_claims) && sc.weakest_claims.length === 2 && typeof sc.adjustments_applied === 'string' && sc.adjustments_applied.trim())) {
      push(failures, 'self_critique', 'missing two weakest claims + adjustment statement');
    }
    // trace_grounded
    if (!Array.isArray(r.ai_reasoning_trace) || r.ai_reasoning_trace.length < 2) {
      push(failures, 'trace_grounded', 'reasoning trace missing or <2 entries');
    } else {
      for (const t of r.ai_reasoning_trace) {
        if (!t || !Array.isArray(t.grounds) || !t.grounds.length) { push(failures, 'trace_grounded', `ungrounded claim: "${String(t?.claim || '').slice(0, 80)}"`); break; }
      }
    }
    // campaign plan + quiet hours
    const plan = r.ai_campaign_plan;
    if (!(plan && Array.isArray(plan.touches) && plan.touches.length >= 2 && Array.isArray(plan.exit_conditions) && plan.exit_conditions.length)) {
      push(failures, 'campaign_plan', 'missing plan / <2 touches / no exit conditions');
    } else {
      for (const t of plan.touches) {
        if (typeof t.hour === 'number' && (t.hour < 9 || t.hour > 21)) push(failures, 'quiet_hours', `touch at hour ${t.hour} (quiet hours are 21:00-09:00 Dubai)`);
        if (typeof t.day_offset === 'number' && (t.day_offset < 0 || t.day_offset > 30)) push(failures, 'quiet_hours', `day_offset ${t.day_offset} outside 0-30`);
      }
    }
    // doctrine_14day
    if (ctx.doctrine_violation) {
      const action = String(r.ai_next_best_action?.action || '').toLowerCase();
      if (!action.includes('schedule_next_touch')) push(failures, 'doctrine_14day', `violation flagged but NBA action is "${action}"`);
      const fups = Array.isArray(r.suggested_followups) ? r.suggested_followups : [];
      if (!fups.some((f) => CADENCE_KEYS.includes(f?.template_key))) push(failures, 'doctrine_14day', 'violation flagged but no cadence follow-up proposed');
    }
    // state_awareness
    const existingT = new Set(ctx.existing_task_keys || []);
    const existingF = new Set(ctx.existing_followup_keys || []);
    for (const t of (Array.isArray(r.suggested_tasks) ? r.suggested_tasks : [])) {
      if (existingT.has(t?.template_key)) push(failures, 'state_awareness', `re-suggested existing task ${t.template_key}`);
    }
    for (const f of (Array.isArray(r.suggested_followups) ? r.suggested_followups : [])) {
      if (existingF.has(f?.template_key)) push(failures, 'state_awareness', `re-suggested existing follow-up ${f.template_key}`);
    }
    // no_fabrication (WARNING level) — sources are what the orchestrator emitted in context
    const sourceText = [ctx.market_pack_text, ctx.asking_price_aed].map((x) => String(x ?? '')).join(' ');
    const sourceNums = extractBigNumbers(sourceText);
    const draftTexts = [
      ...(Array.isArray(r.ai_suggested_messages) ? r.ai_suggested_messages.map((m) => m?.text) : []),
      r.ai_next_best_action?.draft_message,
    ].filter(Boolean);
    for (const d of draftTexts) {
      for (const n of extractBigNumbers(d)) {
        const tolerated = [...sourceNums].some((s) => Math.abs(s - n) / Math.max(s, n) < 0.001);
        if (!tolerated) push(warnings, 'no_fabrication', `figure ${n} in a draft not found in supplied context`);
      }
    }
  } else if (tier === 'cold') {
    if (!(typeof r.urgency_score === 'number')) push(failures, 'schema_shape', 'cold: urgency_score missing');
    if (!(r.ai_next_best_action && r.ai_next_best_action.action)) push(failures, 'schema_shape', 'cold: NBA missing');
  }

  // tool_budget (both tiers; cold is always 0)
  if ((tel.tool_calls || 0) > 6) push(failures, 'tool_budget', `${tel.tool_calls} tool calls (cap 6)`);

  return { landlord_id: landlordId, tier, pass: failures.length === 0, failures, warnings, tool_calls: tel.tool_calls || 0, tools_used: tel.tools_used || [] };
}

/* Find the freshest unprocessed BrainEvalRun row for this landlord fired at/after firedAtIso,
 * stamp it processed, return its payload — or null. */
async function consumeEvalRow(svc, landlordId, firedAtIso) {
  const rows = await svc.entities.BrainEvalRun.filter({ landlord_id: landlordId }, '-created_date', 5).catch(() => []);
  const row = (rows || []).find((r) => r && !r.processed_at && r.payload && String(r.run_at || '') >= firedAtIso);
  if (!row) return null;
  await svc.entities.BrainEvalRun.update(row.id, { processed_at: new Date().toISOString() }).catch(() => {});
  return row.payload;
}

async function runEval(svc, landlordId, deadline) {
  // 5s grace for clock skew between this isolate and the orchestrator's.
  const firedAtIso = new Date(Date.now() - 5_000).toISOString();
  let payload = null;
  try {
    const res = await svc.functions.invoke('landlordOrchestrator', { landlord_id: landlordId, eval_mode: true, triggered_by: 'eval_harness' });
    const data = res?.data ?? res;
    if (data && data.eval_mode) payload = data;
  } catch (_) { /* gateway cut a long run — the envelope lands in BrainEvalRun */ }
  while (!payload && Date.now() < deadline) {
    payload = await consumeEvalRow(svc, landlordId, firedAtIso);
    if (!payload) await new Promise((r) => setTimeout(r, POLL_EVERY_MS));
  }
  if (payload) {
    // Stamp the persisted twin row even when the invoke returned in time (keeps the queue clean).
    await consumeEvalRow(svc, landlordId, firedAtIso).catch(() => {});
    return evalOne(landlordId, payload);
  }
  return { landlord_id: landlordId, tier: null, pass: false, failures: ['no_payload: invoke cut and no BrainEvalRun row appeared before the deadline'], warnings: [] };
}

Deno.serve(async (req) => {
  const startedAt = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { user = null; }
    if (user && user.role !== 'admin') return Response.json({ error: 'admin only' }, { status: 403 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body.landlord_ids) && body.landlord_ids.length
      ? body.landlord_ids.slice(0, 30)
      : GOLDEN_SET;

    const results = [];
    let i = 0;
    while (i < ids.length) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break;
      const deadline = startedAt + TIME_BUDGET_MS;
      const batch = ids.slice(i, i + PARALLEL);
      const settled = await Promise.allSettled(batch.map((id) => runEval(svc, id, deadline)));
      for (let j = 0; j < batch.length; j++) {
        const s = settled[j];
        if (s.status === 'fulfilled') {
          results.push(s.value);
        } else {
          results.push({ landlord_id: batch[j], tier: null, pass: false, failures: [`eval_failed: ${String(s.reason?.message || s.reason).slice(0, 200)}`], warnings: [] });
        }
      }
      i += batch.length;
    }

    const summary = {
      total_requested: ids.length,
      evaluated: results.length,
      passed: results.filter((r) => r.pass).length,
      failed: results.filter((r) => !r.pass).length,
      green: results.length > 0 && results.every((r) => r.pass),
      next_ids: ids.slice(i),
      elapsed_ms: Date.now() - startedAt,
    };
    // Persist the verdict — the harness's own HTTP response can be gateway-cut just like the
    // orchestrator's. '__report__' rows ARE the record of an eval pass.
    try {
      await svc.entities.BrainEvalRun.create({
        landlord_id: '__report__',
        run_at: new Date(startedAt).toISOString(),
        tier: '',
        triggered_by: 'eval_harness',
        payload: { summary, results },
      });
    } catch (repErr) {
      console.error('BrainEvalRun report create failed (non-fatal):', repErr?.message);
    }
    return Response.json({ summary, results });
  } catch (error) {
    console.error('brainEvalHarness error:', error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});
