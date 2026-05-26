import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SIMULATION_SCHEMA = {
  type: "object",
  properties: {
    scenarios: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          action_sequence: { type: "array", items: { type: "string" }, maxItems: 6 },
          probability_of_close: { type: "number", minimum: 0, maximum: 1 },
          predicted_close_date: { type: "string" },
          predicted_final_value: { type: "number" },
          predicted_stage_at_horizon: { type: "string" },
          expected_value: { type: "number" },
          risks: { type: "array", items: { type: "string" }, maxItems: 3 },
          narrative: { type: "string" }
        },
        required: ["name","action_sequence","probability_of_close","expected_value","narrative"]
      }
    },
    recommended_scenario_name: { type: "string" },
    recommendation_reasoning: { type: "string" }
  },
  required: ["scenarios","recommended_scenario_name","recommendation_reasoning"]
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { deal_id, horizon_days = 14 } = await req.json();

    const deal = await base44.asServiceRole.entities.Deal.get(deal_id);
    const [lead, recentActivities, signals] = await Promise.all([
      base44.asServiceRole.entities.Lead.get(deal.lead_id).catch(() => null),
      base44.asServiceRole.entities.Activity.filter({ lead_id: deal.lead_id }),
      base44.asServiceRole.entities.DealSignal.filter({ deal_id })
    ]);

    const prompt = `DEAL TIME MACHINE — ${horizon_days}-day simulation

DEAL: Stage=${deal.stage} | Value=${deal.deal_value} ${deal.currency || "AED"} | Score=${deal.aurora_score} | Temp=${deal.aurora_temperature} | Risk=${deal.aurora_risk_score}
LEAD: ${lead?.full_name || "Unknown"} — ${lead?.ai_persona?.archetype || "unknown"}, ${lead?.ai_engagement_level || "unknown"}
${lead?.ai_persona?.persona_summary || ""}

RECENT SIGNALS:
${signals.slice(0,10).map(s => `- ${s.type}: ${s.claude_interpretation || s.raw_content || ""}`).join("\n")}

RECENT ACTIVITY:
${recentActivities.slice(0,10).map(a => `- ${a.type}/${a.outcome || "—"}: ${a.title}`).join("\n")}

HORIZON: ${horizon_days} days

Generate 3 genuinely different scenarios (e.g. aggressive push / patient nurture / pivot inventory).
Pick recommended by EXPECTED VALUE. Be honest about probabilities — a stalled deal should have low close prob even optimistically.
Reference real real-estate actions: NOC, viewing, counter-offer, payment plan, etc.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: "claude_opus_4_7",
      response_json_schema: SIMULATION_SCHEMA
    });

    const simulation = await base44.asServiceRole.entities.DealSimulation.create({
      deal_id,
      requested_by: user.email,
      requested_at: new Date().toISOString(),
      horizon_days,
      scenarios: result.scenarios,
      recommended_scenario_name: result.recommended_scenario_name,
      recommendation_reasoning: result.recommendation_reasoning
    });

    return Response.json(simulation);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});