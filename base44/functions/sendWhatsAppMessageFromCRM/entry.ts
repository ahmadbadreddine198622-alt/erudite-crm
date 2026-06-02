import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { phone_number, message_text, media_url, media_type, conversation_id } = await req.json();

    if (!phone_number || (!message_text && !media_url)) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    if (!accessToken || !phoneNumberId) {
      return Response.json({ error: 'WhatsApp credentials not configured' }, { status: 500 });
    }

    const normalized = normalizePhoneNumber(phone_number);
    if (!normalized) return Response.json({ error: 'Invalid phone number' }, { status: 400 });

    const recipientPhone = normalized.replace('+', '');

    let messagePayload;
    if (media_url && media_type && media_type !== 'text') {
      const typeKey = ['image','audio','video','document'].includes(media_type) ? media_type : 'document';
      messagePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone,
        type: typeKey,
        [typeKey]: { link: media_url, ...(message_text && { caption: message_text }) }
      };
    } else {
      messagePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone,
        type: 'text',
        text: { body: message_text }
      };
    }

    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(messagePayload)
    });

    const rawBody = await response.text();
    if (!response.ok) {
      console.error('WhatsApp API error:', rawBody);
      return Response.json({ error: JSON.parse(rawBody)?.error?.message || rawBody }, { status: response.status });
    }

    const result = JSON.parse(rawBody);
    const waMessageId = result.messages?.[0]?.id || '';
    const timestamp = new Date().toISOString();
    const bodyText = message_text || `[${media_type}]`;

    // Find conversation — try by id first, then by phone (both fields)
    let conv = null;
    if (conversation_id) {
      const convs = await base44.asServiceRole.entities.WhatsAppConversation.filter({ id: conversation_id });
      conv = convs[0] || null;
    }
    if (!conv) {
      const byE164 = await base44.asServiceRole.entities.WhatsAppConversation.filter({ wa_phone_e164: normalized });
      conv = byE164[0] || null;
    }
    if (!conv) {
      const byPhone = await base44.asServiceRole.entities.WhatsAppConversation.filter({ phone_number: normalized });
      conv = byPhone[0] || null;
    }
    // Strip + variant too
    if (!conv) {
      const stripped = normalized.replace('+', '');
      const byStripped = await base44.asServiceRole.entities.WhatsAppConversation.filter({ wa_phone_e164: stripped });
      conv = byStripped[0] || null;
    }

    if (conv) {
      // Save outbound message
      await base44.asServiceRole.entities.WhatsAppMessage.create({
        conversation_id: conv.id,
        lead_id: conv.lead_id || undefined,
        wa_message_id: waMessageId,
        direction: 'outbound',
        body: bodyText,
        media_url: media_url || undefined,
        media_type: (media_type && media_type !== 'text') ? media_type : 'none',
        status: 'sent',
        timestamp,
        from_number: '',
        to_number: normalized,
      });

      // Update conversation — bump to top
      await base44.asServiceRole.entities.WhatsAppConversation.update(conv.id, {
        last_message: bodyText,
        last_message_at: timestamp,
        last_outbound_at: timestamp,
      });
    }

    return Response.json({ success: true, message_id: waMessageId });
  } catch (error) {
    console.error('sendWhatsAppMessageFromCRM error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function normalizePhoneNumber(phone) {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('971') && cleaned.length >= 11) return `+${cleaned}`;
  if (cleaned.startsWith('0') && cleaned.length === 10) return `+971${cleaned.substring(1)}`;
  if (cleaned.length >= 10 && cleaned.length <= 15) return `+${cleaned}`;
  return null;
}