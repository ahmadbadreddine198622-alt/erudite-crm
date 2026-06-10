import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Diagnostic: checks recent WhatsAppMessages and WhatsAppConversations
 * for a given phone number, and also shows the configured WHATSAPP_PHONE_NUMBER_ID
 * so we can compare vs what Meta is actually sending.
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user = null;
  try { user = await base44.auth.me(); } catch (_) {}
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch (_) {}

  const svc = base44.asServiceRole;
  const phone = body.phone || '+971526330035'; // default to the number in screenshots

  const configuredPhoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || 'NOT SET';
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ? 'SET (hidden)' : 'NOT SET';
  const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ? 'SET (hidden)' : 'NOT SET';

  // Normalize phone
  const digits = phone.replace(/\D/g, '');
  const e164 = '+' + digits;

  // Find all conversations for this phone (any channel)
  const convs = await svc.entities.WhatsAppConversation.filter({ wa_phone_e164: e164 }).catch(() => []);
  const convsByPhone = convs.length > 0 ? convs : 
    await svc.entities.WhatsAppConversation.filter({ phone_number: e164 }).catch(() => []);

  // Get recent messages for each conversation
  const messagesPerConv = {};
  for (const conv of convsByPhone) {
    const msgs = await svc.entities.WhatsAppMessage.filter({ conversation_id: conv.id }, '-timestamp', 20).catch(() => []);
    messagesPerConv[conv.id] = msgs;
  }

  // Also get the last 10 inbound messages across the whole system (any phone)
  const recentInbound = await svc.entities.WhatsAppMessage.filter({ direction: 'inbound', channel: 'business' }, '-timestamp', 10).catch(() => []);

  // Try to call Meta Graph API to verify the phone number is active
  let metaPhoneCheck = null;
  try {
    const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    if (token && phoneNumberId) {
      const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}?fields=display_phone_number,status,quality_rating,verified_name&access_token=${token}`);
      metaPhoneCheck = await resp.json();
    }
  } catch (e) {
    metaPhoneCheck = { error: e.message };
  }

  return Response.json({
    config: {
      WHATSAPP_PHONE_NUMBER_ID: configuredPhoneNumberId,
      WHATSAPP_ACCESS_TOKEN: accessToken,
      WHATSAPP_VERIFY_TOKEN: verifyToken,
    },
    meta_phone_check: metaPhoneCheck,
    searched_phone: e164,
    conversations_found: convsByPhone.map(c => ({
      id: c.id,
      channel: c.channel,
      status: c.status,
      wa_phone_e164: c.wa_phone_e164,
      phone_number: c.phone_number,
      last_message: c.last_message,
      last_message_at: c.last_message_at,
      unread_count: c.unread_count,
      message_count: (messagesPerConv[c.id] || []).length,
      messages: (messagesPerConv[c.id] || []).map(m => ({
        id: m.id,
        direction: m.direction,
        channel: m.channel,
        body: m.body,
        timestamp: m.timestamp,
        wa_message_id: m.wa_message_id,
      })),
    })),
    recent_business_inbound_messages: recentInbound.map(m => ({
      id: m.id,
      from_number: m.from_number,
      body: m.body,
      timestamp: m.timestamp,
      conversation_id: m.conversation_id,
    })),
  });
});