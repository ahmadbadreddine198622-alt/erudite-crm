import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Whisper Mode — real-time AI suggestions during a live conversation.
 *
 * Frontend calls this every ~5-10s while agent is in a conversation.
 * Returns up to 3 short tactical suggestions based on last 20 messages.
 *
 * Body: { landlord_id, recent_messages: [{ direction, text, timestamp }] }
 * Returns: { whispers: [{ tier: "info"|"warn"|"critical", text, action? }], detected_signals: [...] }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { landlord_id, recent_messages = [] } = await req.json();
    if (!landlord_id) return Response.json({ error: 'landlord_id required' }, { status: 400 });

    if (recent_messages.length === 0) {
      return Response.json({ whispers: [], detected_signals: [] });
    }

    const landlord = await base44.asServiceRole.entities.Landlord.get(landlord_id);

    const systemPrompt = `You are WHISPER — a real-time AI co-pilot whispering tactical suggestions into the agent's ear during a live conversation with a landlord.

You read the last 20 messages and emit 1-3 SHORT (≤15 words) whispers, each tagged:
- "info": helpful observation, e.g. "Lead mentioned wife is decision-maker — add her as stakeholder"
- "warn": something to be careful about, e.g. "Landlord brought up 3 competitor brokers in 2 days — risk of bidding war"
- "critical": red flag requiring immediate handling, e.g. "Landlord just mentioned title dispute — STOP and verify before continuing"

Also extract detected_signals (max 5): short labels of buying signals or red flags from this conversation chunk.

Rules:
- Whispers must be ACTIONABLE — not commentary.
- Reference specific words from the conversation.
- If conversation is calm with no notable signals, return whispers: [].
- STRICT JSON output.`;

    const userPrompt = `LANDLORD: ${landlord?.full_name_en || landlord?.full_name}
Stage: ${landlord?.stage}  |  Archetype: ${landlord?.landlord_archetype}  |  Trust score: ${landlord?.trust_score ?? '?'}
Current red flags: ${(landlord?.red_flags || []).join(', ') || 'none'}

LAST ${recent_messages.length} MESSAGES (oldest first):
${recent_messages.slice(-20).map((m: any) => `[${m.direction}] ${m.text}`).join('\n')}

Emit whispers.`;

    const aiRes = await base44.functions.invoke('claudeAI', {
      action: 'generate',
      system: systemPrompt,
      prompt: userPrompt,
      model: 'claude-haiku-4-5', // fast model — whisper mode is high-frequency
      response_format: {
        type: 'object',
        properties: {
          whispers: {
            type: 'array',
            maxItems: 3,
            items: {
              type: 'object',
              properties: {
                tier: { type: 'string', enum: ['info', 'warn', 'critical'] },
                text: { type: 'string' },
                action: { type: ['string', 'null'] }
              },
              required: ['tier', 'text']
            }
          },
          detected_signals: {
            type: 'array',
            maxItems: 5,
            items: { type: 'string' }
          }
        },
        required: ['whispers']
      }
    });

    const result = aiRes?.data || aiRes;
    return Response.json(result || { whispers: [], detected_signals: [] });
  } catch (error: any) {
    console.error('landlordWhisper error:', error);
    return Response.json({ error: error.message, whispers: [] }, { status: 500 });
  }
});
