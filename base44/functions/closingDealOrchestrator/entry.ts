import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.27.3';

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

const STAGE_ORDER = [
  'not_started', 'cheques_ready', 'trustee_booked', 'at_trustee',
  'transfer_done', 'title_issued', 'handover', 'complete'
];

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function daysFromNow(dateStr) {
  return daysBetween(new Date().toISOString(), dateStr);
}

function stageIndex(stage) {
  return STAGE_ORDER.indexOf(stage ?? 'not_started');
}

function buildDealContext(deal) {
  const now = new Date();
  const stageIdx = stageIndex(deal.stage);
  const enteredAt = deal.stage_entered_at ? new Date(deal.stage_entered_at) : new Date(deal.created_date);
  const daysInStage = Math.round((now - enteredAt) / 86400000);

  const flags = [];

  // Cheque flags
  if (deal.stage === 'cheques_ready' && daysInStage > 5) {
    flags.push(`Cheques marked ready ${daysInStage}d ago but trustee not yet booked`);
  }
  if (deal.cheques_required_count > 0) {
    const missing = deal.cheques_required_count - (deal.cheques_received_count || 0);
    if (missing > 0) flags.push(`${missing} of ${deal.cheques_required_count} cheques still missing`);
  }

  // NOC flags
  if (deal.noc_status === 'pending' && stageIdx >= 2) {
    flags.push(`NOC pending — may block trustee transfer`);
  }
  if (deal.noc_status === 'rejected') {
    flags.push(`NOC rejected — critical blocker`);
  }

  // Trustee date flags
  if (deal.trustee_appointment_at) {
    const daysToTrustee = daysFromNow(deal.trustee_appointment_at);
    if (daysToTrustee < 0 && deal.stage !== 'at_trustee' && deal.stage !== 'transfer_done' && deal.stage !== 'title_issued' && deal.stage !== 'handover' && deal.stage !== 'complete') {
      flags.push(`Trustee appointment was ${Math.abs(daysToTrustee)}d ago but deal not yet at transfer_done`);
    }
    if (daysToTrustee >= 0 && daysToTrustee <= 2) {
      flags.push(`Trustee appointment in ${daysToTrustee}d — urgent prep needed`);
    }
  } else if (deal.stage === 'trustee_booked' || deal.stage === 'cheques_ready') {
    flags.push(`No trustee appointment date set despite being at stage: ${deal.stage}`);
  }

  // Title deed flags
  if (deal.stage === 'transfer_done' && !deal.title_deed_number) {
    const daysSinceStage = daysInStage;
    if (daysSinceStage > 3) flags.push(`Transfer done ${daysSinceStage}d ago — title deed not yet recorded`);
  }

  // General stalling
  if (daysInStage > 14 && deal.stage !== 'complete') {
    flags.push(`Stalled: ${daysInStage}d in stage "${deal.stage}" without progression`);
  }

  return {
    reference: deal.closing_reference || deal.id,
    stage: deal.stage,
    stage_index: stageIdx,
    stages_remaining: STAGE_ORDER.length - 1 - stageIdx,
    days_in_current_stage: daysInStage,
    deal_type: deal.deal_type,
    representation: deal.representation,
    deal_value_aed: deal.deal_value_aed,
    property_ref: deal.property_ref,
    lead_name: deal.lead_name,
    landlord_name: deal.landlord_name,
    trustee_office: deal.trustee_office,
    trustee_appointment_at: deal.trustee_appointment_at,
    noc_status: deal.noc_status,
    cheques_received: deal.cheques_received_count || 0,
    cheques_required: deal.cheques_required_count || 0,
    dld_transfer_ref: deal.dld_transfer_ref,
    title_deed_number: deal.title_deed_number,
    assigned_agent: deal.assigned_agent_email,
    risk_flags: flags,
    notes: deal.notes,
  };
}

async function orchestrateDeal(deal) {
  const ctx = buildDealContext(deal);

  const prompt = `You are a senior real estate closing manager in Dubai (UAE) reviewing a deal in the closing pipeline.

DEAL CONTEXT:
${JSON.stringify(ctx, null, 2)}

PRIOR DEAL THESIS (evolve it — keep what still holds, revise only what changed): ${deal.ai_deal_thesis || '(none yet — establish it)'}

STAGE PIPELINE (in order): not_started → cheques_ready → trustee_booked → at_trustee → transfer_done → title_issued → handover → complete

YOUR TASK: Analyze this deal and return a JSON object with exactly these six fields:

1. "ai_risk_score" (number 0-100): Overall risk level. Consider: overdue stages, missing cheques, NOC issues, trustee delays, title deed not yet recorded after transfer. 0 = on track, 100 = critically blocked.

2. "ai_next_best_action" (string, max 120 chars): The single most important next step the agent should take right now. Be concrete — include timeframes, names, or specific documents where relevant. E.g. "Book trustee office — all cheques received 2 days ago" or "Chase NOC from developer — trustee in 3 days".

3. "ai_rolling_summary" (string, max 300 chars): Plain-language summary of where the deal stands. Mention: current stage, days in stage, any critical flags, what's been completed. Written as if briefing a manager in a 30-second handoff.

4. "ai_predicted_close_date" (string, ISO date YYYY-MM-DD or null): Estimated date the deal reaches 'complete' stage. Base this on: current stage, days already in stage, typical Dubai DLD closing timelines (cheques to transfer usually 5-10 days, title deed 1-3 days, handover 1-2 days). Return null if too uncertain.

5. "ai_deal_thesis" (string, 2-4 sentences): The persistent strategy for getting THIS deal to 'complete' — the through-line that holds across runs (the critical path, the main blocker, who must act next). EVOLVE the prior thesis above; do NOT just restate the rolling summary.

6. "ai_open_questions" (array of {question, why} objects, 0-3 items): Specific things a HUMAN could answer that would unblock or sharpen the close (e.g. "Has the developer confirmed the NOC fee?"). Return an empty array when nothing is genuinely blocking — do not invent questions.

Return ONLY valid JSON, no markdown, no explanation.`;

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim();
  const parsed = JSON.parse(raw);

  // Split into CORE (always written to ClosingDeal) and MEMORY (V3 P2 thesis/questions, written
  // separately + non-fatally so they can't brick the core write if not yet in the live schema).
  const core = {
    ai_risk_score: typeof parsed.ai_risk_score === 'number' ? parsed.ai_risk_score : null,
    ai_next_best_action: parsed.ai_next_best_action || null,
    ai_rolling_summary: parsed.ai_rolling_summary || null,
    ai_predicted_close_date: parsed.ai_predicted_close_date || null,
  };
  const memory = {};
  if (typeof parsed.ai_deal_thesis === 'string' && parsed.ai_deal_thesis.trim()) {
    memory.ai_deal_thesis = parsed.ai_deal_thesis.trim();
  }
  if (Array.isArray(parsed.ai_open_questions)) {
    memory.ai_open_questions = parsed.ai_open_questions
      .filter(q => q && typeof q === 'object' && typeof q.question === 'string' && q.question.trim())
      .slice(0, 3)
      .map(q => ({ question: q.question.trim(), why: typeof q.why === 'string' ? q.why.trim() : '' }));
  }
  return { core, memory };
}

// V3 Phase 0 (RECORD): append-only closing-risk snapshot — one per orchestrated deal per run. The
// ClosingDeal row clobbers aiFields each run, so this is the only score time-series (risk + predicted
// close date over time) that V3 REMEMBER/LEARN can build on. Non-fatal: a failure (e.g. the entity is
// not yet in the live schema) must never break orchestration. Called at BOTH update seams below.
async function writeClosingSnapshot(base44, deal, aiFields) {
  try {
    await base44.entities.ClosingDealScoreSnapshot.create({
      closing_deal_id: deal.id,
      captured_at: new Date().toISOString(),
      stage: deal.stage || null,
      ai_risk_score: (typeof aiFields.ai_risk_score === 'number') ? aiFields.ai_risk_score : null,
      ai_predicted_close_date: aiFields.ai_predicted_close_date || null,
    });
  } catch (snapErr) {
    console.error('ClosingDealScoreSnapshot create failed (non-fatal):', snapErr?.message);
  }
}

// V3 Phase 2 (REMEMBER): persistent thesis + ask-the-agent open questions, written SEPARATELY from the
// core ai fields and non-fatally — if ai_deal_thesis / ai_open_questions aren't yet in the live
// ClosingDeal schema, a rejected write degrades here instead of bricking the core update. Mirrors the
// landlord/aurora memory write. No-op when the model returned neither.
async function writeClosingMemory(base44, dealId, memory) {
  if (!memory || !Object.keys(memory).length) return;
  try {
    await base44.entities.ClosingDeal.update(dealId, memory);
  } catch (memErr) {
    console.error('ClosingDeal thesis/open_questions write failed (non-fatal — apply live schema):', memErr?.message);
  }
}

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });

  let body = {};
  try { body = await req.json(); } catch {}

  const { deal_id } = body;

  // If deal_id provided — orchestrate single deal
  if (deal_id) {
    const deals = await base44.entities.ClosingDeal.filter({ id: deal_id });
    const deal = Array.isArray(deals) ? deals[0] : deals;
    if (!deal) return new Response(JSON.stringify({ error: 'Deal not found' }), { status: 404, headers });

    const { core, memory } = await orchestrateDeal(deal);
    await base44.entities.ClosingDeal.update(deal_id, core);
    await writeClosingMemory(base44, deal_id, memory);
    await writeClosingSnapshot(base44, deal, core);
    return new Response(JSON.stringify({ ok: true, deal_id, ...core }), { status: 200, headers });
  }

  // Otherwise orchestrate ALL non-complete deals (batch mode — for scheduled automation)
  if (user.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden: admin only for batch mode' }), { status: 403, headers });
  }

  const allDeals = await base44.entities.ClosingDeal.list('-updated_date', 200);
  const active = allDeals.filter(d => d.stage !== 'complete');

  const results = [];
  for (const deal of active) {
    const { core, memory } = await orchestrateDeal(deal);
    await base44.entities.ClosingDeal.update(deal.id, core);
    await writeClosingMemory(base44, deal.id, memory);
    await writeClosingSnapshot(base44, deal, core);
    results.push({ deal_id: deal.id, reference: deal.closing_reference, ...core });
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), { status: 200, headers });
});