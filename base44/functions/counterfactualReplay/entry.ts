import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { deal_id } = await req.json();

    const deal = await base44.asServiceRole.entities.Deal.get(deal_id);
    if (!deal) return Response.json({ error: "deal_not_found" }, { status: 404 });
    if (deal.stage !== "lost") return Response.json({ error: "only_for_lost_deals" }, { status: 400 });

    const [lead, signals, activities] = await Promise.all([
      base44.asServiceRole.entities.Lead.get(deal.lead_id).catch(() => null),
      base44.asServiceRole.entities.DealSignal.filter({ deal_id }),
      base44.asServiceRole.entities.Activity.filter({ lead_id: deal.lead_id })
    ]);

    const timeline = [
      ...signals.map(s => ({ ts: s.occurred_at, kind: `signal/${s.type}`, text: s.claude_interpretation || s.raw_content || "" })),
      ...activities.map(a => ({ ts: a.created_date, kind: `activity/${a.type}`, text: a.ai_summary || a.title || "" }))
    ].sort((a, b) => a.ts?.localeCompare(b.ts || ""));

    const prompt = `AURORA REPLAY — Counterfactual analysis of a LOST deal.

Identify 3-5 PIVOT MOMENTS where a different action would have changed the outcome.
For each pivot: exact timestamp + what happened, what agent did/didn't do, best alternative action, close-probability delta (e.g. "+47% if responded in <5min"), one-sentence lesson.
End with a TEAM LESSON — a single rule to avoid this loss pattern.

LOST DEAL: ${deal.id} (reason: ${deal.lost_reason || "unspecified"})
Lead: ${lead?.full_name || "Unknown"} — ${lead?.ai_persona?.archetype || "unknown"}
Value: ${deal.deal_value} ${deal.currency || "AED"}

TIMELINE:
${timeline.slice(0,60).map(e => `${e.ts} | ${e.kind}: ${e.text.slice(0,120)}`).join("\n")}

Identify pivot moments.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: "claude_opus_4_7",
      response_json_schema: {
        type: "object",
        properties: {
          pivot_moments: {
            type: "array",
            maxItems: 5,
            items: {
              type: "object",
              properties: {
                timestamp: { type: "string" },
                what_happened: { type: "string" },
                what_agent_did: { type: "string" },
                counterfactual_action: { type: "string" },
                estimated_probability_lift: { type: "number" },
                lesson: { type: "string" }
              },
              required: ["what_happened","counterfactual_action","lesson"]
            }
          },
          team_lesson: { type: "string" },
          loss_category: { type: "string" }
        },
        required: ["pivot_moments","team_lesson"]
      }
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});