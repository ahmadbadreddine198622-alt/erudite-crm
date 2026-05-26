import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { conversation, recent_messages, lead, inventory } = await req.json();

    const systemPrompt = `You enrich a live WhatsApp conversation in a real-estate CRM.

From the conversation, extract & update:
- ai_rolling_summary (5-7 sentences, narrative)
- ai_sentiment_current + ai_sentiment_trend (improving/stable/deteriorating vs last enrichment)
- ai_buying_signal_count + ai_red_flag_count (incremental over last enrich? just count current)
- ai_topics (max 8 short tags)
- ai_mentioned_properties (titles or unit refs the lead said)
- ai_mentioned_locations (Dubai communities: Marina, Downtown, JVC, etc.)
- ai_mentioned_competitors (other brokerages or developer names mentioned negatively or for comparison)
- 3 next_message_suggestions with diverse tones (warm, professional, urgent)
- detected_language (ISO 639-1)
- ai_priority (urgent/high/medium/low) based on signal strength × deal value × SLA
- recommended_property_ids: rank top 3 from provided inventory matching this lead's stated needs

Rules: STRICT JSON. Suggestions in detected_language. Be concise.`;

    const userPrompt = `CONVERSATION META
Phone: ${conversation.wa_phone_e164}
Status: ${conversation.status}
Detected language so far: ${conversation.detected_language || "?"}

LEAD (if linked)
${lead ? JSON.stringify({
      name: lead.full_name,
      score: lead.ai_lead_score,
      budget: `${lead.budget_min}-${lead.budget_max} ${lead.budget_currency}`,
      locations: lead.preferred_locations,
      types: lead.preferred_property_types,
      bedrooms: `${lead.bedrooms_min}-${lead.bedrooms_max}`,
      timeline: lead.move_in_timeline,
      persona: lead.ai_persona?.archetype
    }, null, 2) : "no linked lead"}

RECENT MESSAGES (last 30, oldest first):
${(recent_messages || []).map(m => `[${m.direction}] ${m.created_at} ${m.body || `(${m.media_type})`}`).join("\n")}

INVENTORY (top 20 matching by hard filters):
${(inventory || []).slice(0, 20).map(p => `- [${p.id}] ${p.title} | ${p.bedrooms}BR | ${p.location} | ${p.price} ${p.currency}`).join("\n")}

Enrich.`;

    const ENRICH_SCHEMA = {
      type: "object",
      properties: {
        ai_rolling_summary: { type: "string" },
        ai_sentiment_current: { type: "string", enum: ["very_positive","positive","neutral","negative","very_negative"] },
        ai_sentiment_trend: { type: "string", enum: ["improving","stable","deteriorating"] },
        ai_buying_signal_count: { type: "number" },
        ai_red_flag_count: { type: "number" },
        ai_topics: { type: "array", items: { type: "string" }, maxItems: 8 },
        ai_mentioned_properties: { type: "array", items: { type: "string" } },
        ai_mentioned_locations: { type: "array", items: { type: "string" } },
        ai_mentioned_competitors: { type: "array", items: { type: "string" } },
        ai_next_message_suggestions: {
          type: "array",
          minItems: 3, maxItems: 3,
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              language: { type: "string" },
              tone: { type: "string", enum: ["warm","professional","urgent","casual"] },
              intent: { type: "string" }
            },
            required: ["text", "tone", "intent"]
          }
        },
        detected_language: { type: "string" },
        ai_priority: { type: "string", enum: ["low","medium","high","urgent"] },
        recommended_property_ids: { type: "array", items: { type: "string" }, maxItems: 3 }
      },
      required: ["ai_rolling_summary","ai_sentiment_current","ai_next_message_suggestions","ai_priority"]
    };

    const result = await base44.integrations.Core.InvokeLLM({
      model: "claude_opus_4_7",
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      response_json_schema: ENRICH_SCHEMA
    });

    // Persist enrichment back to the conversation
    await base44.asServiceRole.entities.WhatsAppConversation.update(conversation.id, {
      ai_rolling_summary: result.ai_rolling_summary,
      ai_sentiment_current: result.ai_sentiment_current,
      ai_sentiment_trend: result.ai_sentiment_trend,
      ai_buying_signal_count: result.ai_buying_signal_count,
      ai_red_flag_count: result.ai_red_flag_count,
      ai_topics: result.ai_topics,
      ai_mentioned_properties: result.ai_mentioned_properties,
      ai_mentioned_locations: result.ai_mentioned_locations,
      ai_mentioned_competitors: result.ai_mentioned_competitors,
      ai_next_message_suggestions: result.ai_next_message_suggestions,
      detected_language: result.detected_language,
      ai_priority: result.ai_priority,
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});