import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { conversation_id } = await req.json();
  if (!conversation_id) return Response.json({ error: 'conversation_id required' }, { status: 400 });

  const convs = await base44.asServiceRole.entities.WhatsAppConversation.filter({ id: conversation_id });
  const conv = convs[0];
  if (!conv) return Response.json({ error: 'Conversation not found' }, { status: 404 });

  const messages = await base44.asServiceRole.entities.WhatsAppMessage.filter(
    { conversation_id },
    'timestamp',
    50
  );

  if (messages.length === 0) return Response.json({ status: 'no_messages' });

  const transcript = messages
    .map(m => `[${m.direction === 'inbound' ? 'Client' : 'Agent'}]: ${m.body}`)
    .join('\n');

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are an AI assistant for a Dubai real estate CRM. Analyze this WhatsApp conversation between a real estate agent and a client.

Conversation:
${transcript}

Provide a structured analysis in JSON.`,
    response_json_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: '2-3 sentence summary of the conversation' },
        sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
        intent: { type: 'string', description: 'What the client is looking for or trying to achieve' },
        urgency: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        next_action: { type: 'string', description: 'The most important next action the agent should take' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '3-5 short tags describing the lead (e.g. "Ready to Buy", "Investor", "Budget Conscious")'
        }
      },
      required: ['summary', 'sentiment', 'intent', 'urgency', 'next_action', 'tags']
    }
  });

  await base44.asServiceRole.entities.WhatsAppConversation.update(conversation_id, {
    ai_summary: result.summary,
    ai_sentiment: result.sentiment,
    ai_intent: result.intent,
    ai_urgency: result.urgency,
    ai_next_action: result.next_action,
    ai_tags: result.tags,
  });

  return Response.json({ status: 'ok', analysis: result });
});