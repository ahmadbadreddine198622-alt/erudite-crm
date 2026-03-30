import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { conversation_id, message } = await req.json();

  if (!conversation_id || !message?.trim()) {
    return Response.json({ error: 'conversation_id and message are required' }, { status: 400 });
  }

  const convs = await base44.entities.WhatsAppConversation.filter({ id: conversation_id });
  const conv = convs[0];
  if (!conv) return Response.json({ error: 'Conversation not found' }, { status: 404 });

  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: conv.phone_number,
      type: 'text',
      text: { body: message },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return Response.json({ error: data.error?.message || 'Failed to send' }, { status: 500 });
  }

  const waMessageId = data.messages?.[0]?.id;
  const timestamp = new Date().toISOString();

  await base44.entities.WhatsAppMessage.create({
    conversation_id,
    lead_id: conv.lead_id,
    wa_message_id: waMessageId || '',
    direction: 'outbound',
    body: message,
    status: 'sent',
    timestamp,
    from_number: '',
    to_number: conv.phone_number,
    media_type: 'none',
  });

  await base44.entities.WhatsAppConversation.update(conversation_id, {
    last_message: message,
    last_message_at: timestamp,
  });

  return Response.json({ status: 'sent', wa_message_id: waMessageId });
});