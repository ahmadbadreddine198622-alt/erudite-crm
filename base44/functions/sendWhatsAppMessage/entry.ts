import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { template_name, template_components, template_body } = body;
  const conversation_id = body.conversation_id || null;
  const message = body.message || body.message_text;
  // Use language exactly as returned from Meta — do not remap
  const template_language = body.template_language || 'en';

  if (!conversation_id && !body.to_phone) {
    return Response.json({ error: 'conversation_id or to_phone is required' }, { status: 400 });
  }
  if (!message?.trim() && !template_name) {
    return Response.json({ error: 'message or template_name is required' }, { status: 400 });
  }

  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

  // Resolve conversation and phone
  let conv = null;
  let toPhone = '';

  if (conversation_id) {
    const convList = await base44.asServiceRole.entities.WhatsAppConversation.filter({ id: conversation_id });
    conv = convList[0];
    if (!conv) return Response.json({ error: 'Conversation not found' }, { status: 404 });
    const rawPhone = conv.wa_phone_e164 || conv.phone_number || '';
    toPhone = rawPhone.startsWith('+') ? rawPhone : '+' + rawPhone.replace(/^\+/, '');
  } else {
    // Direct send to phone — always use/create the business channel conversation
    toPhone = body.to_phone.startsWith('+') ? body.to_phone : '+' + body.to_phone.replace(/^\+/, '');
    const existing = await base44.asServiceRole.entities.WhatsAppConversation.filter({ wa_phone_e164: toPhone, channel: 'business' });
    if (existing[0]) {
      conv = existing[0];
    } else {
      // Create a new conversation record
      conv = await base44.asServiceRole.entities.WhatsAppConversation.create({
        wa_phone_e164: toPhone,
        phone_number: toPhone,
        channel: 'business',
        status: 'open',
        ...(body.landlord_id ? { landlord_id: body.landlord_id } : {}),
      });
    }
  }

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

  // Save outbound message — always tag with the conversation's channel so the UI can label it correctly
  const msgRecord = {
    conversation_id: conv.id,
    wa_message_id: waMessageId || '',
    direction: 'outbound',
    body: bodyText,
    status: 'sent',
    timestamp,
    from_number: '',
    to_number: conv.wa_phone_e164 || conv.phone_number,
    media_type: 'none',
    channel: conv.channel || 'business',
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
  await base44.asServiceRole.entities.WhatsAppConversation.update(conv.id, updatePayload);

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