import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { conversation_id, template_name, template_components, template_body } = body;
  const message = body.message || body.message_text;
  // Normalize language: Meta requires locale codes like en_US, ar, en — map bare "en" to "en_US"
  const rawLang = body.template_language || 'en';
  const template_language = rawLang === 'en' ? 'en_US' : rawLang;

  if (!conversation_id || (!message?.trim() && !template_name)) {
    return Response.json({ error: 'conversation_id and message (or template_name) are required' }, { status: 400 });
  }

  // Get conversation
  const convList = await base44.asServiceRole.entities.WhatsAppConversation.filter({ id: conversation_id });
  const conv = convList[0];
  if (!conv) return Response.json({ error: 'Conversation not found' }, { status: 404 });

  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

  // Ensure phone has + prefix — Meta requires E.164 with leading +
  const rawPhone = conv.wa_phone_e164 || conv.phone_number || '';
  const toPhone = rawPhone.startsWith('+') ? rawPhone : '+' + rawPhone.replace(/^\+/, '');

  // Build payload - either text or template
  let payload;
  if (template_name) {
    payload = {
      messaging_product: 'whatsapp',
      to: toPhone,
      type: 'template',
      template: {
        name: template_name,
        language: { code: template_language },
        components: template_components || [],
      },
    };
  } else {
    payload = {
      messaging_product: 'whatsapp',
      to: toPhone,
      type: 'text',
      text: { body: message, preview_url: false },
    };
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    return Response.json({ error: data.error?.message || 'Failed to send', details: data }, { status: 500 });
  }

  const waMessageId = data.messages?.[0]?.id;
  const timestamp = new Date().toISOString();
  // Use the actual template body text if provided, otherwise fall back to message or a label
  const bodyText = message || template_body || `[Template: ${template_name}]`;

  // Save outbound message
  const msgRecord = {
    conversation_id,
    wa_message_id: waMessageId || '',
    direction: 'outbound',
    body: bodyText,
    status: 'sent',
    timestamp,
    from_number: '',
    to_number: conv.wa_phone_e164 || conv.phone_number,
    media_type: 'none',
  };
  if (conv.lead_id) msgRecord.lead_id = conv.lead_id;
  await base44.asServiceRole.entities.WhatsAppMessage.create(msgRecord);

  // Update conversation — bump to top of list
  const phoneE164 = conv.wa_phone_e164 || conv.phone_number;
  const updatePayload = {
    last_message: bodyText,
    last_message_at: timestamp,
    last_outbound_at: timestamp,
    status: conv.status === 'resolved' ? 'open' : (conv.status || 'open'),
  };
  if (!conv.wa_phone_e164 && phoneE164) updatePayload.wa_phone_e164 = phoneE164;
  await base44.asServiceRole.entities.WhatsAppConversation.update(conversation_id, updatePayload);

  // Log activity only if there's a lead
  if (conv.lead_id) {
    await base44.asServiceRole.entities.Activity.create({
      lead_id: conv.lead_id,
      type: 'whatsapp',
      direction: 'outbound',
      title: 'WhatsApp message sent',
      description: bodyText,
      channel: 'whatsapp',
      status: 'completed',
      completed_at: timestamp,
      agent_email: user.email,
      agent_name: user.full_name,
      source: 'manual',
    });
  }

  return Response.json({ status: 'sent', wa_message_id: waMessageId });
});