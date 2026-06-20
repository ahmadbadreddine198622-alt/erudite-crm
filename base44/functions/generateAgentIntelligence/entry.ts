import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// generateAgentIntelligence — AI agent-performance brain. ONE InvokeLLM call per agent.

const CONFIG = {
  dlaAgent: 'agent_email', dlaDate: 'allocation_date',
  aiEarnedVerdict: 'ai_earned_more_leads_verdict', aiEarnedReason: 'ai_earned_reasoning',
  aiSlackFlag: 'ai_slacking_flag', aiSlackReason: 'ai_slacking_reason',
  aiCoaching: 'ai_coaching_note',
  aiTargetPred: 'ai_hit_target_prediction', aiTargetReason: 'ai_target_reasoning',
  aiRolling: 'ai_agent_rolling_summary', aiProcessedAt: 'ai_processed_at',
  ocAgent: 'agent_email', ocDate: 'outreach_date', ocLandlord: 'landlord_id',
  agAgent: 'agent_email', agPeriod: 'month',
  agTargetDeals: 'target_deals', agTargetRev: 'target_revenue_aed',
  agTargetLeads: 'target_leads', agTargetViewings: 'target_viewings',
  agentRoles: ['agent', 'admin', 'manager'],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const todayStr = (d = new Date()) => d.toISOString().slice(0, 10);
const monthStr = (d = new Date()) => d.toISOString().slice(0, 7);
const sameDay = (v, day) => typeof v === 'string' && v.slice(0, 10) === day;

async function invokeWithRetry(base44, args, { maxAttempts = 5, baseDelayMs = 2000 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await base44.integrations.Core.InvokeLLM(args); }
    catch (err) {
      lastErr = err;
      const msg = (err?.message || '').toLowerCase();
      const rate = msg.includes('rate limit') || err?.status === 429 || msg.includes('429');
      if (!rate || attempt === maxAttempts) break;
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
  throw new Error(`agent-intel rate-limited after ${maxAttempts} attempts (last: ${lastErr?.message})`);
}

async function generateAgentIntelligenceInternal(base44, agentEmail, { date = todayStr() } = {}) {
  const db = base44.asServiceRole.entities;

  const alloc = ((await db.DailyLeadAllocation.filter({ [CONFIG.dlaAgent]: agentEmail })) || [])
    .find((a) => sameDay(a[CONFIG.dlaDate], date));
  if (!alloc) return { ok: false, reason: 'No DailyLeadAllocation today', agentEmail };

  const checklists = ((await db.OutreachChecklist.filter({ [CONFIG.ocAgent]: agentEmail })) || [])
    .filter((r) => sameDay(r[CONFIG.ocDate], date));
  const quals = ((await db.CallQualification.filter({ agent_email: agentEmail })) || [])
    .filter((q) => sameDay(q.call_date, date));

  const landlordIds = [...new Set([...checklists.map((r) => r[CONFIG.ocLandlord]), ...quals.map((q) => q.landlord_id)].filter(Boolean))];
  const landlords = [];
  for (const id of landlordIds) {
    const l = await db.Landlord.get(id).catch(() => null);
    if (l) landlords.push({ id: l.id, name: l.full_name_en || l.full_name, stage: l.stage, mandate_win_probability: l.mandate_win_probability, ai_strike_now: l.ai_strike_now, urgency_score: l.urgency_score });
  }

  const goal = ((await db.AgentGoal.filter({ [CONFIG.agAgent]: agentEmail })) || [])
    .find((g) => (g[CONFIG.agPeriod] || '').slice(0, 7) === monthStr());

  const context = {
    agent: agentEmail, date,
    allocation: {
      base_allocation: alloc.base_allocation, total_available: alloc.total_available,
      bonus_earned: alloc.bonus_earned, leads_unlocked_count: alloc.leads_unlocked_count,
      sequences_completed: alloc.sequences_completed, completion_rate: alloc.completion_rate,
    },
    checklists,
    qualifications: quals,
    landlords_worked: landlords,
    monthly_goal: goal ? { target_deals: goal[CONFIG.agTargetDeals], target_revenue_aed: goal[CONFIG.agTargetRev], target_leads: goal[CONFIG.agTargetLeads], target_viewings: goal[CONFIG.agTargetViewings] } : null,
  };

  const prompt = `You are a sharp, demanding Dubai real estate SALES MANAGER reviewing one agent's day. Reason about QUALITY and BEHAVIOR — never reward box-ticking. Be specific and grounded ENTIRELY in the data; never generic.

JUDGE:
- Did they have REAL conversations (qualifications logged, decision-makers reached, stages advanced) — or just tick checklist boxes with no qualifications?
- Did they FOLLOW THE SEQUENCE (e.g. Email/WhatsApp before Call) or skip steps / jump straight to Call on every lead?
- Reward agents who genuinely work leads well; flag those gaming the checklist.
- QUALITY OVER VOLUME: judge what they did relative to what they worked. 2 real qualifications from 2 leads worked is STRONG — do NOT call that "slacking" or score it as a low percentage. A small allocation worked well beats a large one ticked without conversations.

CONSISTENCY RULE (hard): the verdicts must not contradict. If ai_earned_more_leads_verdict is true then ai_slacking_flag MUST be false; if ai_slacking_flag is true then ai_earned_more_leads_verdict MUST be false. Never return both true.

AGENT DAY (JSON):
${JSON.stringify(context, null, 2)}

Return:
- ai_earned_more_leads_verdict (boolean) + ai_earned_reasoning: do they GENUINELY deserve more leads? Quality, not raw volume. "8 checklists, 0 qualifications" = no; "2 leads worked, 2 real qualifications" = yes.
- ai_slacking_flag (boolean) + ai_slacking_reason: underperforming and WHY specifically. Do NOT flag an agent who worked few leads WELL.
- ai_coaching_note: ONE sharp tactical sentence for today, grounded in what they actually did.
- ai_hit_target_prediction (on_track | at_risk | will_miss) + ai_target_reasoning: today's pace AND quality vs their monthly goal (${goal ? 'target provided' : 'NO monthly target is set — base the prediction on activity pace + quality alone and state "no monthly target set" in ai_target_reasoning'}).
- ai_agent_rolling_summary: short narrative of this agent's performance pattern.`;

  const result = await invokeWithRetry(base44, {
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        ai_earned_more_leads_verdict: { type: 'boolean' }, ai_earned_reasoning: { type: 'string' },
        ai_slacking_flag: { type: 'boolean' }, ai_slacking_reason: { type: 'string' },
        ai_coaching_note: { type: 'string' },
        ai_hit_target_prediction: { type: 'string', enum: ['on_track', 'at_risk', 'will_miss'] }, ai_target_reasoning: { type: 'string' },
        ai_agent_rolling_summary: { type: 'string' },
      },
      required: ['ai_earned_more_leads_verdict', 'ai_earned_reasoning', 'ai_slacking_flag', 'ai_slacking_reason', 'ai_coaching_note', 'ai_hit_target_prediction', 'ai_target_reasoning', 'ai_agent_rolling_summary'],
    },
  });

  await db.DailyLeadAllocation.update(alloc.id, {
    [CONFIG.aiEarnedVerdict]: result.ai_earned_more_leads_verdict,
    [CONFIG.aiEarnedReason]: result.ai_earned_reasoning,
    [CONFIG.aiSlackFlag]: result.ai_slacking_flag,
    [CONFIG.aiSlackReason]: result.ai_slacking_reason,
    [CONFIG.aiCoaching]: result.ai_coaching_note,
    [CONFIG.aiTargetPred]: result.ai_hit_target_prediction,
    [CONFIG.aiTargetReason]: result.ai_target_reasoning,
    [CONFIG.aiRolling]: result.ai_agent_rolling_summary,
    [CONFIG.aiProcessedAt]: new Date().toISOString(),
  });

  return { ok: true, agentEmail, verdict: result.ai_earned_more_leads_verdict, slacking: result.ai_slacking_flag, prediction: result.ai_hit_target_prediction };
}

async function generateAllAgentIntelligenceInternal(base44, { date = todayStr() } = {}) {
  const db = base44.asServiceRole.entities;
  const eligible = new Set(((await db.User.filter({})) || []).filter((u) => CONFIG.agentRoles.includes(u.role)).map((u) => u.email));
  const allocs = ((await db.DailyLeadAllocation.filter({})) || [])
    .filter((a) => sameDay(a[CONFIG.dlaDate], date) && eligible.has(a[CONFIG.dlaAgent]));
  let processed = 0; const results = [];
  for (const a of allocs) {
    try { results.push(await generateAgentIntelligenceInternal(base44, a[CONFIG.dlaAgent], { date })); processed++; }
    catch (err) { results.push({ ok: false, agentEmail: a[CONFIG.dlaAgent], error: err?.message }); }
    await sleep(800);
  }
  return { date, agents_processed: processed, results };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { agent_email, all_agents = false, date = todayStr() } = await req.json();

    if (all_agents) {
      const result = await generateAllAgentIntelligenceInternal(base44, { date });
      return Response.json({ success: true, data: result });
    }

    if (!agent_email) {
      return Response.json({ error: 'agent_email or all_agents is required' }, { status: 400 });
    }

    const result = await generateAgentIntelligenceInternal(base44, agent_email, { date });
    return Response.json({ success: result.ok, data: result });
  } catch (error) {
    console.error('[generateAgentIntelligence] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});