import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const { conversation_id } = await req.json();
  const base44 = createClientFromRequest(req);

  if (!conversation_id) {
    return Response.json({ error: 'conversation_id required' }, { status: 400 });
  }

  // Fetch last 30 messages for context
  const messages = await base44.asServiceRole.entities.WhatsAppMessage.filter(
    { conversation_id },
    '-timestamp',
    30
  );

  if (!messages.length) return Response.json({ status: 'no_messages' });

  // Build transcript (oldest first)
  const transcript = messages
    .slice()
    .reverse()
    .map(m => `[${m.direction === 'inbound' ? 'Client' : 'Agent'}]: ${m.body}`)
    .join('\n');

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are a real estate CRM AI assistant analyzing a WhatsApp conversation for a Dubai property agency.

CONVERSATION TRANSCRIPT:
${transcript}

Analyze this conversation and return a JSON object with these exact fields:
- summary: A 2-3 sentence summary of the conversation (string)
- sentiment: Overall client sentiment — one of: "positive", "neutral", "negative" (string)
- intent: The client's main intent, e.g. "Looking to buy 2BR in Marina", "Asking about rental prices", "Following up on viewing" (string)
- urgency: One of: "low", "medium", "high", "urgent" (string)
- next_action: Recommended next action for the agent, e.g. "Schedule viewing", "Send property options", "Follow up in 3 days" (string)
- suggested_tags: Array of up to 5 short CRM tags. Choose from or create variants of: "Hot Lead", "Follow Up", "Interested", "Price Sensitive", "Ready to Buy", "Viewing Requested", "Negotiating", "Cold Lead", "High Budget", "Investor" (array of strings)

Base your analysis on the most recent client messages. Be concise and Dubai real-estate focused.`,
    response_json_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        sentiment: { type: 'string' },
        intent: { type: 'string' },
        urgency: { type: 'string' },
        next_action: { type: 'string' },
        suggested_tags: { type: 'array', items: { type: 'string' } },
      },
    },
  });

  // Update conversation with AI insights
  await base44.asServiceRole.entities.WhatsAppConversation.update(conversation_id, {
    ai_summary: result.summary,
    ai_sentiment: result.sentiment,
    ai_intent: result.intent,
    ai_urgency: result.urgency,
    ai_next_action: result.next_action,
    ai_tags: result.suggested_tags || [],
  });

  // Also update lead tags if not already present
  const conv = await base44.asServiceRole.entities.WhatsAppConversation.filter({ id: conversation_id });
  if (conv.length > 0 && result.suggested_tags?.length) {
    const lead = await base44.asServiceRole.entities.Lead.filter({ id: conv[0].lead_id });
    if (lead.length > 0) {
      const existingTags = lead[0].tags || [];
      const merged = [...new Set([...existingTags, ...result.suggested_tags])];
      await base44.asServiceRole.entities.Lead.update(lead[0].id, { tags: merged });
    }
  }

  return Response.json({ status: 'ok', ...result });
});