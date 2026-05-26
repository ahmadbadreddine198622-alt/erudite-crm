import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ORCHESTRATOR_SCHEMA = {
  type: "object",
  properties: {
    new_stage: { type: ["string","null"], enum: ["discovery","qualified","viewing","offer_drafting","offer_submitted","negotiating","agreement","diligence","noc_signing","closing","won","lost",null] },
    sub_stage: { type: ["string","null"] },
    aurora_score: { type: "number", minimum: 0, maximum: 100 },
    aurora_velocity: { type: "number" },
    aurora_temperature: { type: "string", enum: ["frozen","cold","warming","hot","blazing"] },
    aurora_risk_score: { type: "number", minimum: 0, maximum: 100 },
    aurora_risk_factors: { type: "array", items: { type: "string" }, maxItems: 5 },
    aurora_forecast: {
      type: "object",
      properties: {
        weighted_value: { type: "number" },
        close_probability: { type: "number", minimum: 0, maximum: 1 },
        predicted_close_date: { type: "string" },
        predicted_close_date_p10: { type: "string" },
        predicted_close_date_p90: { type: "string" },
        drivers: { type: "array", items: { type: "string" } },
        blockers: { type: "array", items: { type: "string" } },
        reasoning_trace: { type: "string" }
      },
      required: ["weighted_value","close_probability","predicted_close_date","reasoning_trace"]
    },
    aurora_dna: {
      type: "object",
      properties: {
        markers: { type: "object" },
        dna_fingerprint: { type: "string" },
        similar_won_deal_ids: { type: "array", items: { type: "string" } },
        similar_lost_deal_ids: { type: "array", items: { type: "string" } },
        playbook_recommendation: { type: "string" }
      },
      required: ["markers","playbook_recommendation"]
    },
    next_aurora_action: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["send_whatsapp","send_email","send_listings","schedule_followup","move_stage","request_documents","do_nothing"] },
        scheduled_for: { type: ["string","null"] },
        draft_payload: { type: "object" },
        rationale: { type: "string" },
        requires_approval: { type: "boolean" },
        approval_deadline: { type: ["string","null"] }
      },
      required: ["action","rationale","requires_approval"]
    },
    needs_human_review: { type: "boolean" },
    review_reason: { type: ["string","null"] }
  },
  required: ["aurora_score","aurora_temperature","aurora_risk_score","aurora_forecast","next_aurora_action","needs_human_review"]
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { deal_id, force = false } = await req.json();

    if (!deal_id) return Response.json({ error: "deal_id required" }, { status: 400 });

    const deal = await base44.asServiceRole.entities.Deal.get(deal_id);
    if (!deal) return Response.json({ error: "deal_not_found" }, { status: 404 });

    if (["won","lost"].includes(deal.stage)) return Response.json({ skipped: "terminal_stage" });

    const hoursSinceRun = (Date.now() - new Date(deal.last_orchestrator_run_at || 0)) / 3.6e6;

    const newSignals = await base44.asServiceRole.entities.DealSignal.filter({ deal_id, consumed_by_orchestrator: false });

    if (!force && newSignals.length === 0 && hoursSinceRun < 6) {
      return Response.json({ skipped: "no_new_signals" });
    }

    const [lead, stakeholders, recentActivities] = await Promise.all([
      base44.asServiceRole.entities.Lead.get(deal.lead_id).catch(() => null),
      base44.asServiceRole.entities.DealStakeholder.filter({ deal_id }),
      base44.asServiceRole.entities.Activity.filter({ lead_id: deal.lead_id })
    ]);

    const systemPrompt = `You are AURORA, an autonomous sales intelligence agent for a real-estate CRM in Dubai/GCC.
You orchestrate deals end-to-end. Recompute: stage, score, velocity, temperature, risk, forecast (glass-box), DNA, next action.
Rules: calibrated forecasts, infer DNA from behavior, ghosting (3+ silent days) → cold, competitor mentioned twice → red flag + escalate.
Output STRICT JSON matching the schema exactly.`;

    const userPrompt = `DEAL: ${JSON.stringify({ id: deal.id, stage: deal.stage, sub_stage: deal.sub_stage, stage_entered_at: deal.stage_entered_at, deal_value: deal.deal_value, currency: deal.currency || "AED", aurora_score: deal.aurora_score, aurora_temperature: deal.aurora_temperature, autopilot_mode: deal.autopilot_mode })}

LEAD: ${JSON.stringify({ name: lead?.full_name, persona: lead?.ai_persona, score: lead?.ai_lead_score, language: lead?.preferred_language, budget: `${lead?.budget_min}-${lead?.budget_max} ${lead?.budget_currency}`, days_since_contact: lead?.days_since_last_contact })}

STAKEHOLDERS: ${stakeholders.map(s => `${s.name} (${s.role}, power ${s.decision_power}, ${s.sentiment})`).join("; ") || "Solo buyer"}

NEW SIGNALS (${newSignals.length}):
${newSignals.slice(0,20).map(s => `[${s.id}] ${s.occurred_at} | ${s.type} (w:${s.weight}) | ${s.claude_interpretation || s.raw_content?.slice(0,100)}`).join("\n") || "(none)"}

RECENT ACTIVITY:
${recentActivities.slice(0,10).map(a => `[${a.id}] ${a.created_date} | ${a.type}/${a.outcome||"—"} | ${a.title}`).join("\n")}

PRIOR FORECAST: ${JSON.stringify(deal.aurora_forecast)}

Emit orchestrator JSON.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: userPrompt,
      model: "claude_opus_4_7",
      response_json_schema: ORCHESTRATOR_SCHEMA
    });

    const now = new Date().toISOString();
    const update = {
      sub_stage: result.sub_stage,
      aurora_score: result.aurora_score,
      aurora_velocity: result.aurora_velocity,
      aurora_temperature: result.aurora_temperature,
      aurora_risk_score: result.aurora_risk_score,
      aurora_risk_factors: result.aurora_risk_factors,
      aurora_forecast: result.aurora_forecast,
      aurora_dna: result.aurora_dna,
      next_aurora_action: result.next_aurora_action,
      needs_human_review: result.needs_human_review,
      review_reason: result.review_reason,
      last_orchestrator_run_at: now
    };

    if (result.new_stage && result.new_stage !== deal.stage) {
      update.stage = result.new_stage;
      update.stage_entered_at = now;
      update.stage_history = [
        ...(deal.stage_history || []),
        {
          stage: deal.stage,
          entered_at: deal.stage_entered_at,
          exited_at: now,
          duration_hours: (Date.now() - new Date(deal.stage_entered_at || deal.created_date).getTime()) / 3.6e6,
          moved_by: deal.autopilot_mode === "autonomous" ? "aurora_auto" : "aurora_supervised"
        }
      ];
    }

    await base44.asServiceRole.entities.Deal.update(deal_id, update);

    if (newSignals.length > 0) {
      await Promise.all(newSignals.map(s => base44.asServiceRole.entities.DealSignal.update(s.id, { consumed_by_orchestrator: true })));
    }

    return Response.json({ updated: true, stage: update.stage || deal.stage, aurora_score: result.aurora_score, aurora_temperature: result.aurora_temperature });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});