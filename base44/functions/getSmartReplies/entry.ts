import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { conversation_id } = await req.json();
  if (!conversation_id) return Response.json({ error: 'conversation_id required' }, { status: 400 });

  const messages = await base44.entities.WhatsAppMessage.filter(
    { conversation_id },
    '-timestamp',
    10
  );

  if (messages.length === 0) return Response.json({ replies: [] });

  const transcript = [...messages].reverse()
    .map(m => `[${m.direction === 'inbound' ? 'Client' : 'Agent'}]: ${m.body}`)
    .join('\n');

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are an AI assistant helping a Dubai real estate agent reply to a WhatsApp conversation. 
    
Based on this conversation, generate 3 short, professional reply suggestions. Keep them concise (1-2 sentences max), natural, and appropriate for a real estate context in Dubai.

Conversation:
${transcript}

Generate 3 different reply options varying in tone (e.g. one formal, one friendly, one with a call to action).`,
    response_json_schema: {
      type: 'object',
      properties: {
        replies: {
          type: 'array',
          items: { type: 'string' },
          description: '3 suggested reply messages'
        }
      },
      required: ['replies']
    }
  });

  return Response.json({ replies: result.replies || [] });
});