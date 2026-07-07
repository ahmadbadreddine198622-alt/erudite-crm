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
  malik: 'Malik',
  sameie: 'Samy',
  dari: 'Dari',
};

const FROM_NUMBER_MAP = {
  business: '+971582806000',
  personal: '+971581806000',
  malik: '+971529871277',
  sameie: '+971522869064',
  dari: '+971559508545',
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
  // Optional attachment: { attachment_url, attachment_name, attachment_media_type }
  // When set, the message is sent as media (image/document/video/audio) with the text as caption.
  const attachment_url = body.attachment_url || null;
  const attachment_name = body.attachment_name || 'attachment';
  let attachmentMediaType = (body.attachment_media_type || 'document').toLowerCase();
  if (!['image', 'document', 'video', 'audio'].includes(attachmentMediaType)) attachmentMediaType = 'document';
  
  // Support both landlord_id OR conversation_id - at least one required.
  // Text may be empty when sending a media-only message (caption is optional).
  if ((!landlord_id && !conversation_id) || (!text || !String(text).trim()) && !attachment_url) {
    return Response.json({ error: 'landlord_id or conversation_id, and (text or attachment) are required' }, { status: 400 });
  }

  if (!['business', 'personal', 'malik', 'sameie', 'dari'].includes(channel)) {
    return Response.json({ error: 'Invalid channel. Must be "business", "personal", "malik", "sameie", or "dari"' }, { status: 400 });
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
  const isAdmin = user.role === 'admin';

  // Per-agent own WhatsApp line: each agent sends from their own Evolution instance
  // (configured in Profile). Agents without a configured line cannot send. Admins bypass
  // so the company keeps working during transition.
  let ownInstance = null;
  let ownNumber = null;
  try {
    const meList = await svc.entities.User.filter({ email: user.email });
    const me = meList?.[0];
    ownInstance = me?.whatsapp_instance || null;
    ownNumber = me?.whatsapp_number || null;
  } catch (_) { /* ignore */ }
  if (!ownInstance && !isAdmin) {
    return Response.json({ error: 'Your WhatsApp line is not configured. Add your WhatsApp number in Profile to send.' }, { status: 403 });
  }
  if (landlord_id) {
    const llList = await svc.entities.Landlord.filter({ id: landlord_id });
    landlord = llList && llList[0];
    if (!landlord) return Response.json({ error: 'Landlord not found', landlord_id }, { status: 404 });
    // Ownership check — agents can only send to landlords assigned to them
    if (!isAdmin && landlord.assigned_agent_email !== user.email) {
      return Response.json({ error: 'You can only send WhatsApp messages to landlords assigned to you' }, { status: 403 });
    }
    number = toDigits(landlord.phone);
    if (!number) return Response.json({ error: 'Landlord has no phone number to send to', landlord_id }, { status: 422 });
  } 
  // If conversation_id provided, get phone from conversation (user-scoped — RLS enforces ownership)
  else if (conversation_id) {
    const convList = await base44.entities.WhatsAppConversation.filter({ id: conversation_id });
    const conv = convList && convList[0];
    if (!conv) return Response.json({ error: 'Conversation not found or not assigned to you', conversation_id }, { status: 403 });
    number = toDigits(conv.wa_phone_e164 || conv.phone_number);
    if (!number) return Response.json({ error: 'Conversation has no phone number', conversation_id }, { status: 422 });
  }

  // ---- GUARD: never send to one of our own instance numbers (self-send loop) ----
  // Bug: replies were resolving the destination to the sending line itself
  // (from === to === +971581806000), so the customer never received them.
  // Reject any send where the recipient equals a known own-number.
  const OWN_NUMBERS = [...Object.values(FROM_NUMBER_MAP).map(toDigits)];
  if (ownNumber) OWN_NUMBERS.push(toDigits(ownNumber));
  if (OWN_NUMBERS.includes(toDigits(number))) {
    return Response.json({
      error: 'Refusing to send: destination is one of our own WhatsApp numbers (self-send loop)',
      destination: '+' + number,
      channel,
    }, { status: 422 });
  }

  // ---- Send via appropriate API depending on channel ----
  let evoStatus = 0;
  let evoBody = null;

  if (channel === 'business' && !ownInstance) { // Meta Cloud API (company line — only when agent has no own instance)
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

    // Meta Cloud API: send media by uploading the file to /media first, then referencing its id.
    if (attachment_url) {
      try {
        const fileResp = await fetch(attachment_url);
        if (!fileResp.ok) throw new Error('Could not fetch attachment from ' + attachment_url);
        const fileBlob = await fileResp.blob();
        const mime = fileResp.headers.get('content-type') || 'application/octet-stream';
        const filename = attachment_name || 'attachment';
        const form = new FormData();
        form.append('messaging_product', 'whatsapp');
        form.append('type', attachmentMediaType === 'image' ? 'image'
          : attachmentMediaType === 'video' ? 'video'
          : attachmentMediaType === 'audio' ? 'audio'
          : 'document');
        form.append('file', fileBlob, filename);
        const upResp = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/media`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}` },
          body: form,
        });
        const upJson = await upResp.json().catch(() => ({}));
        if (!upResp.ok || !upJson?.id) throw new Error('Meta media upload failed: ' + JSON.stringify(upJson));
        const mediaId = upJson.id;
        const typeKey = attachmentMediaType === 'image' ? 'image'
          : attachmentMediaType === 'video' ? 'video'
          : attachmentMediaType === 'audio' ? 'audio'
          : 'document';
        metaPayload.type = typeKey;
        metaPayload[typeKey] = { id: mediaId, caption: (text && String(text).trim()) ? String(text) : undefined };
        // remove the text block to avoid an invalid payload
        delete metaPayload.text;
      } catch (e) {
        return Response.json({ error: 'Failed to prepare media for Meta', detail: String(e?.message || e) }, { status: 502 });
      }
    }

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
    const instanceName = ownInstance || INSTANCE_MAP[channel];
    // sendMedia when an attachment is present (caption = text); otherwise plain sendText.
    const isMedia = !!attachment_url;
    const sendUrl = isMedia
      ? `${apiUrl}/message/sendMedia/${instanceName}`
      : `${apiUrl}/message/sendText/${instanceName}`;
    try {
      const payload = isMedia
        ? { number, media: attachment_url, mediatype: attachmentMediaType, caption: String(text || ''), fileName: attachment_name }
        : { number, text: String(text) };
      const resp = await fetch(sendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify(payload),
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
  let conversation = null;
  try {
    
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
    
    // Step 2: Find the conversation that matches phone + channel (strict).
    // There may be duplicate threads — always reuse the MOST RECENTLY ACTIVE one
    // so replies don't split across threads (which looks like the wrong number).
    const phoneE164 = '+' + number;
    const pickNewest = (list) => {
      if (!list || !list.length) return null;
      return [...list].sort((a, b) =>
        new Date(b.last_message_at || b.updated_date || 0) - new Date(a.last_message_at || a.updated_date || 0)
      )[0];
    };
    const byPhoneAndChannel = await svc.entities.WhatsAppConversation.filter({ wa_phone_e164: phoneE164, channel });
    conversation = pickNewest(byPhoneAndChannel);

    // Fallback: try digits-only phone_number field
    if (!conversation) {
      const byPhoneNumber = await svc.entities.WhatsAppConversation.filter({ phone_number: phoneE164, channel });
      conversation = pickNewest(byPhoneNumber);
    }

    // Step 3: If landlord_id provided and still no match, try landlord + channel
    if (!conversation && landlord_id) {
      const byLandlord = await svc.entities.WhatsAppConversation.filter({ landlord_id, channel });
      conversation = pickNewest(byLandlord);
    }

    // Step 4: Create a new conversation for this channel if none found
    if (!conversation) {
      const now = new Date().toISOString();
      conversation = await svc.entities.WhatsAppConversation.create({
        wa_phone_e164: phoneE164,
        phone_number: phoneE164,
        landlord_id: landlord_id || null,
        lead_id: null,
        assigned_agent_email: landlord?.assigned_agent_email || landlord?.listing_manager_email || null,
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
        body: String(text || ''),
        timestamp: new Date().toISOString(),
        status: 'sent',
        wa_message_id: waId,
        from_number: ownNumber || FROM_NUMBER_MAP[effectiveChannel] || FROM_NUMBER_MAP[channel] || '+971581806000',
        to_number: '+' + number,
        channel: effectiveChannel,
        media_type: attachment_url ? attachmentMediaType : 'none',
        media_url: attachment_url || null,
        assigned_agent_email: conversation?.assigned_agent_email || landlord?.assigned_agent_email || landlord?.listing_manager_email || null,
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
          text: String(text || ''),
          timestamp: new Date().toISOString(),
          status: 'sent',
          wa_message_id: waId,
          channel: channel,
          agent_email: user.email,
          media_url: attachment_url || null,
          media_type: attachment_url ? attachmentMediaType : 'none',
          // V3 Phase 0 (RECORD): AI-draft provenance, set ONLY when the send originated from an AI
          // draft (passed by the composer). Non-AI messages keep created_from_ai:false and are otherwise
          // unaffected. Instrumentation only — no behavior/wording/timing change.
          created_from_ai: body.created_from_ai === true,
          ai_source: body.created_from_ai === true ? (body.ai_source || null) : null,
          ai_draft_text: body.created_from_ai === true ? (body.ai_draft_text || null) : null,
          was_edited_after_draft: body.created_from_ai === true ? (body.was_edited_after_draft === true) : false,
          ai_disposition: body.created_from_ai === true && ['accepted', 'edited', 'ignored'].includes(body.ai_disposition) ? body.ai_disposition : null,
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