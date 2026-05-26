import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // GET — webhook verification (no auth required)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
    if (mode === 'subscribe' && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // POST — incoming messages + status updates
  const body = await req.json();
  const base44 = createClientFromRequest(req);

  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  // Handle message status updates (delivered, read, failed)
  if (value?.statuses?.length) {
    for (const status of value.statuses) {
      const waId = status.id;
      const newStatus = status.status;
      const msgs = await base44.asServiceRole.entities.WhatsAppMessage.filter({ wa_message_id: waId });
      if (msgs.length > 0) {
        await base44.asServiceRole.entities.WhatsAppMessage.update(msgs[0].id, { status: newStatus });
      }
    }
    return Response.json({ status: 'ok' });
  }

  if (!value?.messages?.length) {
    return Response.json({ status: 'no_messages' });
  }

  for (const msg of value.messages) {
    const fromNumber = msg.from;
    const waMessageId = msg.id;
    const timestamp = new Date(parseInt(msg.timestamp) * 1000).toISOString();
    let bodyText = msg.text?.body || msg.caption || '[media]';

    // Handle voice messages
    const isVoiceMessage = msg.type === 'audio' && msg.audio;
    if (isVoiceMessage) {
      bodyText = '🎤 Voice message (transcribing...)';
    }

    // Normalize phone number to E.164 format
    const normalizedPhone = fromNumber.replace(/\s+/g, '').replace(/^00/, '');
    const e164Phone = normalizedPhone.startsWith('+') ? normalizedPhone : `+${normalizedPhone}`;

    // Find or create lead in the LEAD entity (not Leads)
    let leadId;
    const leads = await base44.asServiceRole.entities.Lead.filter({ phone: normalizedPhone });
    if (leads.length > 0) {
      leadId = leads[0].id;
      // Update last touch
      await base44.asServiceRole.entities.Lead.update(leadId, {
        last_touch_at: timestamp,
        last_activity_at: timestamp,
        last_activity_type: 'whatsapp',
      });
    } else {
      const newLead = await base44.asServiceRole.entities.Lead.create({
        full_name: normalizedPhone,
        phone: normalizedPhone,
        source: 'whatsapp_campaign',
        stage: 'new',
        preferred_contact_channel: 'whatsapp',
        first_touch_at: timestamp,
        last_touch_at: timestamp,
      });
      leadId = newLead.id;
    }

    // Find or create WhatsApp conversation
    let convId;
    const convs = await base44.asServiceRole.entities.WhatsAppConversation.filter({ lead_id: leadId });
    if (convs.length > 0) {
      convId = convs[0].id;
      await base44.asServiceRole.entities.WhatsAppConversation.update(convId, {
        lead_id: leadId,
        wa_phone_e164: e164Phone,
        phone_number: normalizedPhone,
        status: 'open',
        first_message_at: timestamp,
        last_inbound_at: timestamp,
        last_message: bodyText,
        last_message_at: timestamp,
        unread_count: 1,
      });
      convId = newConv.id;
    }

    // Deduplicate messages
    const existing = await base44.asServiceRole.entities.WhatsAppMessage.filter({ wa_message_id: waMessageId });
    let messageId;
    if (existing.length === 0) {
      const newMsg = await base44.asServiceRole.entities.WhatsAppMessage.create({
        conversation_id: convId,
        lead_id: leadId,
        wa_message_id: waMessageId,
        direction: 'inbound',
        body: bodyText,
        status: 'delivered',
        timestamp,
        from_number: normalizedPhone,
        to_number: value.metadata?.display_phone_number || '',
        media_type: msg.type !== 'text' ? msg.type : 'none',
      });
      messageId = newMsg.id;
    } else {
      messageId = existing[0].id;
    }

    // Trigger voice transcription in background
    if (isVoiceMessage && msg.audio?.id) {
      const audioUrl = `https://graph.facebook.com/v21.0/${msg.audio.id}?access_token=${Deno.env.get('WHATSAPP_ACCESS_TOKEN')}`;
      base44.asServiceRole.functions.invoke('processVoiceMessage', {
        conversation_id: convId,
        message_id: messageId,
        audio_url: audioUrl,
        from_number: normalizedPhone,
      }).catch(() => {});
    }

    // Log activity on the lead
    await base44.asServiceRole.entities.Activity.create({
      lead_id: leadId,
      type: 'whatsapp',
      direction: 'inbound',
      title: 'WhatsApp message received',
      description: bodyText,
      channel: 'whatsapp',
      status: 'completed',
      completed_at: timestamp,
      source: 'whatsapp_sync',
    });

    // Background tasks (fire-and-forget)
    base44.asServiceRole.functions.invoke('analyzeConversation', { conversation_id: convId }).catch(() => {});
    base44.asServiceRole.functions.invoke('calculateLeadScore', { conversation_id: convId }).catch(() => {});
    base44.asServiceRole.functions.invoke('executeAutomationRules', { conversation_id: convId }).catch(() => {});
  }

  return Response.json({ status: 'ok' });
});