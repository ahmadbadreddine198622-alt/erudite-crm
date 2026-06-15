import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Sends an outgoing WhatsApp message via the specified Evolution API instance.
 * 
 * Supports two channels:
 * - "business": erudite instance (Meta Cloud API, company number +971582806000)
 * - "personal": erudite_whatsapp instance (Baileys, Ahmad's number +971581806000)
 * 
 * Request body:
 * {
 *   landlord_id: string,
 *   text: string,
 *   channel?: "business" | "personal" (default: "personal")
 * }
 */

const INSTANCE_MAP = {
  business: 'erudite',
  personal: 'erudite_whatsapp',
  malik: 'malik_whatsapp',
};

const FROM_NUMBER_MAP = {
  business: '+971582806000',
  personal: '+971581806000',
  malik: '+971529871277',
};

function toDigits(raw) {
  return String(raw || '').replace(/\D/g, '');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user = null;
  try { user = await base44.auth.me(); } catch (_) { /* gate below */ }
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch (_) { /* none */ }
  
  const landlord_id = body.landlord_id;
  const conversation_id = body.conversation_id;
  const text = body.text;
  const channel = body.channel || 'personal';
  
  // Support both landlord_id OR conversation_id - at least one required
  if ((!landlord_id && !conversation_id) || !text || !String(text).trim()) {
    return Response.json({ error: 'landlord_id or conversation_id, and non-empty text are required' }, { status: 400 });
  }

  if (!['business', 'personal', 'malik'].includes(channel)) {
    return Response.json({ error: 'Invalid channel. Must be "business", "personal", or "malik"' }, { status: 400 });
  }

  const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
  const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
  if (!apiUrl || !apiKey) {
    return Response.json({
      error: 'Evolution secrets missing',
      detail: `Set EVOLUTION_API_URL and EVOLUTION_API_KEY in Base44 (have url:${!!apiUrl}, key:${!!apiKey}).`,
    }, { status: 500 });
  }

  const svc = base44.asServiceRole;
  let landlord = null;
  let number = null;
  
  // If landlord_id provided, fetch landlord
  if (landlord_id) {
    const llList = await svc.entities.Landlord.filter({ id: landlord_id });
    landlord = llList && llList[0];
    if (!landlord) return Response.json({ error: 'Landlord not found', landlord_id }, { status: 404 });
    number = toDigits(landlord.phone);
    if (!number) return Response.json({ error: 'Landlord has no phone number to send to', landlord_id }, { status: 422 });
  } 
  // If conversation_id provided, get phone from conversation
  else if (conversation_id) {
    const convList = await svc.entities.WhatsAppConversation.filter({ id: conversation_id });
    const conv = convList && convList[0];
    if (!conv) return Response.json({ error: 'Conversation not found', conversation_id }, { status: 404 });
    number = toDigits(conv.wa_phone_e164 || conv.phone_number);
    if (!number) return Response.json({ error: 'Conversation has no phone number', conversation_id }, { status: 422 });
  }

  // ---- Send via appropriate API depending on channel ----
  let evoStatus = 0;
  let evoBody = null;

  if (channel === 'business') {
    // Business: send via Meta Cloud API
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    if (!phoneNumberId || !accessToken) {
      return Response.json({ error: 'WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN secret missing' }, { status: 500 });
    }
    const metaPayload = {
      messaging_product: 'whatsapp',
      to: '+' + number,
      type: 'text',
      text: { body: String(text), preview_url: false },
    };
    try {
      const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(metaPayload),
      });
      evoStatus = resp.status;
      const raw = await resp.text();
      try { evoBody = JSON.parse(raw); } catch { evoBody = raw; }
      if (!resp.ok) {
        return Response.json({ error: 'Meta API send failed', meta_status: evoStatus, meta_response: evoBody }, { status: 502 });
      }
    } catch (e) {
      return Response.json({ error: 'Could not reach Meta API', detail: String(e?.message || e) }, { status: 502 });
    }
  } else {
    // Personal: send via Evolution API
    if (!apiUrl || !apiKey) {
      return Response.json({ error: 'Evolution secrets missing' }, { status: 500 });
    }
    const instanceName = INSTANCE_MAP[channel];
    const sendUrl = `${apiUrl}/message/sendText/${instanceName}`;
    try {
      const resp = await fetch(sendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({ number, text: String(text) }),
      });
      evoStatus = resp.status;
      const raw = await resp.text();
      try { evoBody = JSON.parse(raw); } catch { evoBody = raw; }
      if (!resp.ok) {
        return Response.json({ error: 'Evolution send failed', evolution_status: evoStatus, evolution_response: evoBody, send_url: sendUrl }, { status: 502 });
      }
    } catch (e) {
      return Response.json({ error: 'Could not reach Evolution API', detail: String(e?.message || e), send_url: sendUrl }, { status: 502 });
    }
  }

  // ---- record the outgoing message so the thread stays complete ----
  // Meta returns { messages: [{ id }] }, Evolution returns { key: { id } }
  const waId = (evoBody && (
    evoBody.messages?.[0]?.id ||   // Meta Cloud API
    evoBody.key?.id ||             // Evolution API
    evoBody.message?.key?.id       // Evolution API (alt)
  )) || null;
  let message;
  try {
    let conversation = null;
    
    // ALWAYS resolve the correct conversation for the requested channel.
    // Even when conversation_id is provided, we must check whether its channel
    // matches the requested channel. If not, find/create the correct one.
    // This ensures business and personal threads are NEVER mixed.
    
    const e164 = '+' + number;

    // Step 1: If conversation_id given, fetch it to get its phone
    if (conversation_id) {
      const convList = await svc.entities.WhatsAppConversation.filter({ id: conversation_id });
      const srcConv = convList && convList[0];
      if (srcConv) {
        const srcPhone = toDigits(srcConv.wa_phone_e164 || srcConv.phone_number);
        // Use same number as source conversation for lookup
        number = srcPhone || number;
      }
    }
    
    // Step 2: Find the conversation that matches phone + channel (strict)
    const phoneE164 = '+' + number;
    const byPhoneAndChannel = await svc.entities.WhatsAppConversation.filter({ wa_phone_e164: phoneE164, channel });
    conversation = byPhoneAndChannel[0] || null;

    // Fallback: try digits-only phone_number field
    if (!conversation) {
      const byPhoneNumber = await svc.entities.WhatsAppConversation.filter({ phone_number: phoneE164, channel });
      conversation = byPhoneNumber[0] || null;
    }

    // Step 3: If landlord_id provided and still no match, try landlord + channel
    if (!conversation && landlord_id) {
      const byLandlord = await svc.entities.WhatsAppConversation.filter({ landlord_id, channel });
      conversation = byLandlord[0] || null;
    }

    // Step 4: Create a new conversation for this channel if none found
    if (!conversation) {
      const now = new Date().toISOString();
      conversation = await svc.entities.WhatsAppConversation.create({
        wa_phone_e164: phoneE164,
        phone_number: phoneE164,
        landlord_id: landlord_id || null,
        lead_id: null,
        status: 'open',
        channel,
        first_message_at: now,
        last_message_at: now,
        unread_count: 0,
      });
    }
    
    // Dedupe WhatsAppMessage by wa_message_id before creating
    let whatsAppMessageExists = false;
    if (waId) {
      const existingWAMsg = await svc.entities.WhatsAppMessage.filter({ wa_message_id: waId });
      whatsAppMessageExists = existingWAMsg && existingWAMsg.length > 0;
    }
    
    // Create WhatsAppMessage record (used by the inbox UI) - skip if duplicate
    // Use the channel from the conversation if available (source of truth), fall back to request channel
    const effectiveChannel = conversation?.channel || channel;
    if (!whatsAppMessageExists) {
      message = await svc.entities.WhatsAppMessage.create({
        conversation_id: conversation?.id || conversation_id || null,
        lead_id: null,
        landlord_id: landlord_id || null,
        direction: 'outbound',
        body: String(text),
        timestamp: new Date().toISOString(),
        status: 'sent',
        wa_message_id: waId,
        from_number: FROM_NUMBER_MAP[effectiveChannel] || FROM_NUMBER_MAP[channel] || '+971581806000',
        to_number: '+' + number,
        channel: effectiveChannel,
        media_type: 'none',
      });
    } else {
      message = existingWAMsg[0];
    }
    
    // Dedupe Message (backup) by wa_message_id before creating
    if (waId) {
      const existingMsg = await svc.entities.Message.filter({ wa_message_id: waId });
      if (!existingMsg || existingMsg.length === 0) {
        // Also create legacy Message record for backward compatibility
        await svc.entities.Message.create({
          landlord_id: landlord_id || null,
          phone: number,
          direction: 'outgoing',
          text: String(text),
          timestamp: new Date().toISOString(),
          status: 'sent',
          wa_message_id: waId,
          channel: channel,
        });
      }
    }
    
    // Update conversation — keep existing channel if set, don't overwrite it
    if (conversation && conversation.id) {
      await svc.entities.WhatsAppConversation.update(conversation.id, {
        channel: conversation.channel || effectiveChannel,
        last_message: String(text),
        last_message_at: new Date().toISOString(),
        last_outbound_at: new Date().toISOString(),
        status: conversation.status === 'resolved' ? 'open' : (conversation.status || 'open'),
      });
    }
  } catch (e) {
    return Response.json({
      status: 'sent_but_not_recorded',
      evolution_status: evoStatus,
      error: 'Message sent on WhatsApp but the Message record failed to save: ' + String(e && e.message ? e.message : e),
    }, { status: 207 });
  }

  return Response.json({ status: 'ok', message_id: message.id, evolution_status: evoStatus, channel, conversation_id: conversation_id || conversation?.id });
});