import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const LEAD_AI_SCHEMA = {
  type: "object",
  properties: {
    ai_lead_score: { type: "number", minimum: 0, maximum: 100 },
    ai_lead_score_breakdown: {
      type: "object",
      properties: {
        budget_fit: { type: "number", minimum: 0, maximum: 100 },
        authority: { type: "number", minimum: 0, maximum: 100 },
        need_clarity: { type: "number", minimum: 0, maximum: 100 },
        timeline_urgency: { type: "number", minimum: 0, maximum: 100 },
        engagement: { type: "number", minimum: 0, maximum: 100 },
        inventory_match: { type: "number", minimum: 0, maximum: 100 },
        responsiveness: { type: "number", minimum: 0, maximum: 100 }
      },
      required: ["budget_fit", "authority", "need_clarity", "timeline_urgency", "engagement", "inventory_match", "responsiveness"]
    },
    ai_score_trend: { type: "string", enum: ["rising", "stable", "falling"] },
    ai_conversion_probability: { type: "number", minimum: 0, maximum: 1 },
    ai_estimated_close_date: { type: ["string", "null"], format: "date" },
    ai_estimated_deal_value: { type: ["number", "null"] },
    ai_lifetime_value_estimate: { type: ["number", "null"] },
    ai_churn_prediction: {
      type: "object",
      properties: {
        risk_level: { type: "string", enum: ["low", "medium", "high", "critical"] },
        probability: { type: "number", minimum: 0, maximum: 1 },
        predicted_churn_date: { type: ["string", "null"], format: "date" },
        primary_risk_factors: { type: "array", items: { type: "string" } },
        retention_actions: { type: "array", items: { type: "string" } }
      },
      required: ["risk_level", "probability", "primary_risk_factors", "retention_actions"]
    },
    ai_persona: {
      type: "object",
      properties: {
        archetype: {
          type: "string",
          enum: ["first_time_buyer", "upgrader", "downsizer", "investor_yield", "investor_capital_growth", "international_buyer", "end_user_family", "young_professional", "luxury_buyer", "off_plan_speculator", "relocator", "tire_kicker"]
        },
        decision_style: { type: "string", enum: ["analytical", "emotional", "consensus_seeking", "impulsive", "cautious"] },
        price_sensitivity: { type: "string", enum: ["low", "medium", "high"] },
        communication_style: { type: "string", enum: ["formal", "casual", "direct", "relationship_first", "data_driven"] },
        key_motivators: { type: "array", items: { type: "string" } },
        concerns: { type: "array", items: { type: "string" } },
        persona_summary: { type: "string" }
      },
      required: ["archetype", "decision_style", "communication_style", "persona_summary"]
    },
    ai_recommended_property_ids: { type: "array", items: { type: "string" } },
    ai_recommendations: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          property_id: { type: "string" },
          match_score: { type: "number", minimum: 0, maximum: 100 },
          reasoning: { type: "string" },
          matched_criteria: { type: "array", items: { type: "string" } },
          mismatched_criteria: { type: "array", items: { type: "string" } },
          suggested_pitch: { type: "string" }
        },
        required: ["property_id", "match_score", "reasoning", "suggested_pitch"]
      }
    },
    ai_next_best_actions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["call", "whatsapp", "email", "send_listings", "schedule_viewing", "send_brochure", "negotiate", "send_contract", "request_documents", "escalate_to_manager", "nurture_campaign", "close_as_lost"]
          },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
          suggested_at: { type: "string", format: "date-time" },
          reasoning: { type: "string" },
          draft_message: { type: "string" },
          draft_language: { type: "string" },
          expected_outcome: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        },
        required: ["action", "priority", "reasoning", "confidence"]
      }
    },
    ai_engagement_level: { type: "string", enum: ["highly_engaged", "engaged", "lukewarm", "disengaged", "silent"] },
    ai_best_contact_time: {
      type: "object",
      properties: {
        day_of_week: { type: "string" },
        hour_range: { type: "string" },
        timezone: { type: "string" },
        reasoning: { type: "string" }
      }
    },
    ai_buying_signals: { type: "array", items: { type: "string" } },
    ai_red_flags: { type: "array", items: { type: "string" } },
    ai_objections_summary: {
      type: "array",
      items: {
        type: "object",
        properties: {
          objection: { type: "string" },
          frequency: { type: "number" },
          category: { type: "string" },
          best_response: { type: "string" }
        },
        required: ["objection", "category", "best_response"]
      }
    },
    ai_journey_stage: { type: "string", enum: ["awareness", "consideration", "evaluation", "decision", "post_purchase", "advocacy"] },
    ai_rolling_summary: { type: "string" },
    ai_coaching_for_agent: { type: "string" }
  },
  required: ["ai_lead_score", "ai_lead_score_breakdown", "ai_conversion_probability", "ai_churn_prediction", "ai_persona", "ai_next_best_actions", "ai_engagement_level", "ai_journey_stage", "ai_rolling_summary", "ai_coaching_for_agent"]
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { lead, activities, properties, agent } = await req.json();

    if (!lead) {
      return Response.json({ error: "lead is required" }, { status: 400 });
    }

    const systemPrompt = `You are a senior real-estate sales strategist embedded in a CRM.

Your job: synthesize EVERYTHING known about a lead — their profile, every activity, the inventory available — into a complete intelligence picture the agent and CRM can act on.

You compute:
1. Overall lead score 0-100 with per-dimension breakdown
2. Score trend vs. prior score
3. Conversion probability within 90 days (0.0-1.0)
4. Estimated close date and deal value
5. Lifetime value estimate (include referral and repeat-purchase potential)
6. Churn prediction with explainability and retention actions
7. Persona archetype, decision style, motivators, concerns
8. Top property recommendations from the inventory provided, ranked with reasoning
9. Next best actions (up to 3) with priority, timing, and ready-to-send drafts
10. Engagement level, best contact time, buying signals, red flags
11. Aggregated objections across all activities
12. Journey stage (marketing funnel)
13. Rolling narrative summary (3-5 sentences)
14. Coaching for THIS agent on how to handle THIS lead

Rules:
- Output STRICT JSON matching the schema. No markdown, no commentary.
- Draft messages in lead.preferred_language.
- If inventory is empty, set ai_recommended_property_ids and ai_recommendations to empty arrays.
- Be honest about low scores. A tire-kicker with no budget gets a low score with clear reasoning — don't inflate.
- Lifetime value: consider repeat purchase probability for investors, referral network for connected buyers, single-deal for end-users.
- Best contact time: infer from when this lead has historically responded to messages.
- Coaching: be specific to this lead and this agent. "Use data" is bad. "This lead is analytical — lead with ROI numbers and avoid emotional framing" is good.`;

    const userPrompt = `LEAD PROFILE
${JSON.stringify({
      full_name: lead.full_name,
      preferred_language: lead.preferred_language,
      nationality: lead.nationality,
      source: lead.source,
      stage: lead.stage,
      status: lead.status,
      intent: lead.intent,
      transaction_type: lead.transaction_type,
      budget_min: lead.budget_min,
      budget_max: lead.budget_max,
      budget_currency: lead.budget_currency,
      financing_method: lead.financing_method,
      pre_approved_amount: lead.pre_approved_amount,
      move_in_timeline: lead.move_in_timeline,
      preferred_locations: lead.preferred_locations,
      preferred_property_types: lead.preferred_property_types,
      bedrooms_min: lead.bedrooms_min,
      bedrooms_max: lead.bedrooms_max,
      must_have_features: lead.must_have_features,
      deal_breakers: lead.deal_breakers,
      qualification: lead.qualification,
      days_since_last_contact: lead.days_since_last_contact,
      activity_count: lead.activity_count,
      prior_ai_lead_score: lead.ai_lead_score
    }, null, 2)}

ACTIVITY HISTORY (most recent first, up to 20)
${(activities || []).slice(0, 20).map((a, i) => `
[${i + 1}] ${a.type} via ${a.channel || "?"} on ${a.created_at}
  Title: ${a.title}
  Outcome: ${a.outcome || "—"} | Sentiment: ${a.ai_sentiment || a.sentiment || "—"} | Quality: ${a.ai_quality_score ?? "—"}
  Summary: ${a.ai_summary || (a.description || "").slice(0, 200) || "(no content)"}
  Intent detected: ${a.ai_intent || "—"}
  Score delta: ${a.ai_lead_score_delta ?? 0}
`).join("")}

AVAILABLE INVENTORY (candidates to recommend, top 30)
${(properties || []).slice(0, 30).map(p => `- [${p.id}] ${p.title} | ${p.type} | ${p.bedrooms}BR | ${p.size_sqft}sqft | ${p.location} | ${p.price} ${p.currency} | features: ${(p.features || []).join(", ")}`).join("\n") || "No inventory provided"}

AGENT CONTEXT
Name: ${agent?.name || "unknown"}
Experience level: ${agent?.experience_level || "unknown"}
Specialty: ${agent?.specialty || "general"}
Language(s): ${(agent?.languages || []).join(", ") || "en"}

TASK
Analyze everything above and return the lead intelligence JSON. Reference specific activities and properties by ID in your reasoning where it strengthens the recommendation.`;

    const result = await base44.integrations.Core.InvokeLLM({
      model: "claude_opus_4_7",
      prompt: userPrompt,
      response_json_schema: LEAD_AI_SCHEMA
    });

    // Persist enrichment back to Lead record
    if (lead.id) {
      await base44.asServiceRole.entities.Lead.update(lead.id, {
        ...result,
        ai_processed_at: new Date().toISOString(),
        ai_model_used: "claude-opus-4-7",
        ai_processing_status: "completed"
      });
    }

    return Response.json({
      ...result,
      ai_processed_at: new Date().toISOString(),
      ai_model_used: "claude-opus-4-7",
      ai_processing_status: "completed"
    });
  } catch (error) {
    return Response.json({ error: error.message, ai_processing_status: "failed" }, { status: 500 });
  }
});