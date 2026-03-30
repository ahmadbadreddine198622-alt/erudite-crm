import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const WA_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
const WA_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { conversation_id, message } = await req.json();
  if (!conversation_id || !message) {
    return Response.json({ error: 'conversation_id and message required' }, { status: 400 });
  }

  const convs = await base44.asServiceRole.entities.WhatsAppConversation.filter({ id: conversation_id });
  if (!convs.length) return Response.json({ error: 'Conversation not found' }, { status: 404 });
  const conv = convs[0];

  // Send via Meta Cloud API
  const waRes = await fetch(
    `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: conv.phone_number,
        type: 'text',
        text: { body: message },
      }),
    }
  );

  const waData = await waRes.json();
  if (!waRes.ok) {
    return Response.json({ error: waData }, { status: 502 });
  }

  const timestamp = new Date().toISOString();

  // Store outbound message
  await base44.asServiceRole.entities.WhatsAppMessage.create({
    conversation_id,
    lead_id: conv.lead_id,
    wa_message_id: waData.messages?.[0]?.id || '',
    direction: 'outbound',
    body: message,
    media_type: 'none',
    timestamp,
    from_number: WA_PHONE_ID,
    to_number: conv.phone_number,
    status: 'sent',
  });

  // Update conversation
  await base44.asServiceRole.entities.WhatsAppConversation.update(conversation_id, {
    last_message: message.slice(0, 100),
    last_message_at: timestamp,
  });

  return Response.json({ status: 'ok', wa_message_id: waData.messages?.[0]?.id });
});