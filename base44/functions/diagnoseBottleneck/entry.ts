import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { agent_email, window_days = 60 } = await req.json();
    const targetEmail = agent_email || user.email;

    const allDeals = await base44.asServiceRole.entities.Deal.filter({ assigned_agent_email: targetEmail });

    const wonDeals = allDeals.filter(d => d.stage === "won");
    const lostDeals = allDeals.filter(d => d.stage === "lost");
    const activeDeals = allDeals.filter(d => !["won","lost"].includes(d.stage));

    const stageStats = {};
    for (const d of allDeals) {
      for (const h of (d.stage_history || [])) {
        if (!stageStats[h.stage]) stageStats[h.stage] = { count: 0, total_hours: 0 };
        stageStats[h.stage].count++;
        stageStats[h.stage].total_hours += h.duration_hours || 0;
      }
    }
    for (const s in stageStats) {
      stageStats[s].avg_hours = stageStats[s].total_hours / stageStats[s].count;
    }

    const lostReasons = {};
    for (const d of lostDeals) {
      const r = d.lost_reason || "unknown";
      lostReasons[r] = (lostReasons[r] || 0) + 1;
    }

    const prompt = `AURORA BOTTLENECK ANALYST

Analyze this agent's pipeline for STRUCTURAL bottlenecks — not surface symptoms.
Symptoms: "Deal X stuck 11 days."
Structural: "viewings→offers conversion 12% vs benchmark 28%. Pattern: agent shows 4+ properties; winners show 2. Hypothesis: decision paralysis."

For each bottleneck: name the transition, quantify the gap vs benchmark, identify the pattern, hypothesize root cause, recommend specific behavioral change with measurable target, estimate impact.

AGENT: ${targetEmail}
WINDOW: ${window_days} days

OUTCOMES:
- Active: ${activeDeals.length} | Won: ${wonDeals.length} | Lost: ${lostDeals.length}
- Win rate: ${wonDeals.length + lostDeals.length > 0 ? ((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100).toFixed(1) : 0}%

STAGE TIMING (avg hours):
${Object.entries(stageStats).map(([s,v]) => `- ${s}: ${v.avg_hours.toFixed(1)}h (n=${v.count})`).join("\n") || "No data"}

LOST REASONS:
${Object.entries(lostReasons).map(([r,c]) => `- ${r}: ${c}`).join("\n") || "None"}

TEAM BENCHMARKS: viewings→offers: 28%, offers→negotiating: 61%, negotiating→agreement: 73%, avg_days_negotiating: 5.2

Output up to 4 bottlenecks ranked by impact.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: "claude_opus_4_7",
      response_json_schema: {
        type: "object",
        properties: {
          bottlenecks: {
            type: "array",
            maxItems: 4,
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                transition: { type: "string" },
                your_rate: { type: "number" },
                benchmark_rate: { type: "number" },
                gap_pct: { type: "number" },
                detected_pattern: { type: "string" },
                hypothesized_root_cause: { type: "string" },
                recommended_change: { type: "string" },
                measurable_target: { type: "string" },
                estimated_impact: { type: "string" },
                priority: { type: "string", enum: ["critical","high","medium"] }
              },
              required: ["name","transition","detected_pattern","recommended_change","priority"]
            }
          },
          headline_insight: { type: "string" }
        },
        required: ["bottlenecks","headline_insight"]
      }
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});