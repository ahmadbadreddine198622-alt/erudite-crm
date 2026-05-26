import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ACTIVITY_AI_SCHEMA = {
  type: "object",
  properties: {
    ai_summary: { type: "string" },
    ai_sentiment: {
      type: "string",
      enum: ["very_positive", "positive", "neutral", "negative", "very_negative"]
    },
    ai_sentiment_score: { type: "number", minimum: -1, maximum: 1 },
    ai_intent: {
      type: "string",
      enum: ["ready_to_buy", "comparing_options", "needs_financing_info", "wants_viewing", "negotiating_price", "needs_more_listings", "just_browsing", "objection_raised", "ghosting", "complaint", "referral_opportunity", "other"]
    },
    ai_extracted_entities: {
      type: "object",
      properties: {
        budget_min: { type: ["number", "null"] },
        budget_max: { type: ["number", "null"] },
        currency: { type: ["string", "null"] },
        preferred_locations: { type: "array", items: { type: "string" } },
        property_types: { type: "array", items: { type: "string" } },
        bedrooms_min: { type: ["number", "null"] },
        bedrooms_max: { type: ["number", "null"] },
        move_in_timeline: { type: ["string", "null"] },
        financing_method: { type: ["string", "null"], enum: ["cash", "mortgage", "installments", "unknown", null] },
        must_haves: { type: "array", items: { type: "string" } },
        deal_breakers: { type: "array", items: { type: "string" } }
      }
    },
    ai_suggested_tags: { type: "array", items: { type: "string" } },
    ai_next_action: {
      type: "object",
      properties: {
        action_type: {
          type: "string",
          enum: ["call", "whatsapp", "email", "send_listings", "schedule_viewing", "send_contract", "follow_up", "no_action"]
        },
        suggested_at: { type: "string", format: "date-time" },
        reasoning: { type: "string" },
        draft_message: { type: "string" },
        draft_language: { type: "string", enum: ["en", "ar", "fr", "ru", "zh", "hi", "ur", "fa"] },
        confidence: { type: "number", minimum: 0, maximum: 1 }
      },
      required: ["action_type", "reasoning", "confidence"]
    },
    ai_lead_score_delta: { type: "number", minimum: -100, maximum: 100 },
    ai_churn_risk: { type: "string", enum: ["low", "medium", "high", "critical"] },
    ai_objections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          objection: { type: "string" },
          category: { type: "string", enum: ["price", "location", "timing", "financing", "property_features", "trust", "competition", "other"] },
          suggested_response: { type: "string" }
        },
        required: ["objection", "category", "suggested_response"]
      }
    },
    ai_quality_score: { type: "number", minimum: 0, maximum: 100 },
    ai_coaching_notes: { type: "string" }
  },
  required: ["ai_summary", "ai_sentiment", "ai_sentiment_score", "ai_intent", "ai_lead_score_delta", "ai_churn_risk", "ai_quality_score"]
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { activity, lead, property, recentActivities } = await req.json();

    if (!activity?.description && !activity?.ai_transcript) {
      return Response.json({ ai_processing_status: "skipped" });
    }

    const systemPrompt = `You are an AI analyst embedded in a real-estate CRM serving GCC and international markets.

Your job: for each lead activity (call, email, whatsapp, viewing, offer, note), extract structured intelligence the CRM can act on.

Rules:
- Output STRICT JSON matching the provided schema. No prose, no markdown fences.
- Be concise. Summaries are 1-2 sentences max.
- Draft messages match the lead's preferred_language and communication_style.
- For Arabic drafts, use Modern Standard Arabic unless dialect is clearly Gulf/Levantine/Egyptian — then match it.
- Sentiment scores: -1.0 = very negative, 0 = neutral, +1.0 = very positive.
- Lead score delta: how this single activity should move the overall lead score. Positive = progress toward close. Negative = regression. Range -100 to +100, typical -20 to +20.
- Churn risk: assess THIS interaction's contribution to churn likelihood, not the lead's overall risk.
- Quality score: rate the agent's handling — did they qualify, listen, handle objections, set clear next steps?
- Coaching: 1-2 actionable sentences. Be direct, not generic.
- Next action 'suggested_at': pick a realistic time. Hot leads = within 2 hours. Warm = next business day. Cold = 3-7 days.
- If activity is purely informational (system event, stage_change), set most ai_* fields to null and lead_score_delta to 0.`;

    const userPrompt = `LEAD CONTEXT
Name: ${lead?.full_name || "unknown"}
Stage: ${lead?.stage}
Status: ${lead?.status}
Source: ${lead?.source}
Preferred language: ${lead?.preferred_language || "en"}
Budget: ${lead?.budget_min || "?"}-${lead?.budget_max || "?"} ${lead?.budget_currency || "AED"}
Locations: ${(lead?.preferred_locations || []).join(", ") || "not specified"}
Property types: ${(lead?.preferred_property_types || []).join(", ") || "not specified"}
Bedrooms: ${lead?.bedrooms_min || "?"}-${lead?.bedrooms_max || "?"}
Timeline: ${lead?.move_in_timeline || "unknown"}
Financing: ${lead?.financing_method || "unknown"}
Current lead score: ${lead?.ai_lead_score ?? "not yet scored"}
Prior activities: ${lead?.activity_count || 0}
Last 3 activity summaries: ${(recentActivities || []).slice(0, 3).map(a => `- ${a.type}: ${a.ai_summary || a.title}`).join("\n") || "none"}

PROPERTY CONTEXT
${property ? `Title: ${property.title}
Price: ${property.price} ${property.currency}
Location: ${property.location}
Type: ${property.type}
Bedrooms: ${property.bedrooms}
Size: ${property.size_sqft} sqft` : "No property attached"}

CURRENT ACTIVITY
Type: ${activity.type}
Channel: ${activity.channel || "unknown"}
Direction: ${activity.direction}
Title: ${activity.title}
Duration: ${activity.duration_minutes || 0} minutes
Outcome (agent-tagged): ${activity.outcome || "not set"}
Sentiment (agent-tagged): ${activity.sentiment || "not set"}

CONTENT:
"""
${activity.description || activity.ai_transcript}
"""

Analyze and return the JSON.`;

    const result = await base44.integrations.Core.InvokeLLM({
      model: "claude_opus_4_7",
      prompt: userPrompt,
      response_json_schema: ACTIVITY_AI_SCHEMA
    });

    // Persist AI enrichment back onto the Activity record
    if (activity.id) {
      await base44.asServiceRole.entities.Activity.update(activity.id, {
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