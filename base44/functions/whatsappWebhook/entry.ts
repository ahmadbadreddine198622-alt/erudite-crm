import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // GET — webhook verification (must be handled FIRST, no auth required)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
    if (mode === 'subscribe' && token === verifyToken && challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // POST — incoming messages + status updates
  const body = await req.json();
  const base44 = createClientFromRequest(req);

  // Handle message status updates (delivered, read, failed)
  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  if (value?.statuses?.length) {
    for (const status of value.statuses) {
      const waId = status.id;
      const newStatus = status.status; // sent, delivered, read, failed
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
    let body_text = msg.text?.body || msg.caption || '[media]';
    
    // Handle voice messages
    const isVoiceMessage = msg.type === 'audio' && msg.audio;
    if (isVoiceMessage) {
      body_text = '🎤 Voice message (transcribing...)';
    }

    // Find or create lead by phone
    const leads = await base44.asServiceRole.entities.Leads.filter({ phone: fromNumber });
    let leadId;
    if (leads.length > 0) {
      leadId = leads[0].id;
    } else {
      const newLead = await base44.asServiceRole.entities.Leads.create({
        full_name: fromNumber,
        phone: fromNumber,
        source: 'whatsapp',
        status: 'New',
      });
      leadId = newLead.id;
    }

    // Find or create conversation
    const convs = await base44.asServiceRole.entities.WhatsAppConversation.filter({ lead_id: leadId });
    let convId;
    if (convs.length > 0) {
      convId = convs[0].id;
      await base44.asServiceRole.entities.WhatsAppConversation.update(convId, {
        last_message: body_text,
        last_message_at: timestamp,
        unread_count: (convs[0].unread_count || 0) + 1,
        status: 'open',
      });
    } else {
      const newConv = await base44.asServiceRole.entities.WhatsAppConversation.create({
        lead_id: leadId,
        phone_number: fromNumber,
        status: 'open',
        last_message: body_text,
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
        body: body_text,
        status: 'delivered',
        timestamp,
        from_number: fromNumber,
        to_number: value.metadata?.display_phone_number || '',
        media_type: msg.type !== 'text' ? msg.type : 'none',
      });
      messageId = newMsg.id;
    } else {
      messageId = existing[0].id;
    }

    // Trigger voice transcription if audio message
    if (isVoiceMessage && msg.audio?.id) {
      const audioUrl = `https://graph.instagram.com/v18.0/${msg.audio.id}?access_token=${Deno.env.get('WHATSAPP_ACCESS_TOKEN')}`;
      base44.asServiceRole.functions.invoke('processVoiceMessage', {
        conversation_id: convId,
        message_id: messageId,
        audio_url: audioUrl,
        from_number: fromNumber,
      }).catch(() => {});
    }

    // Log activity
    await base44.asServiceRole.entities.Activity.create({
      lead_id: leadId,
      type: 'whatsapp',
      title: 'WhatsApp message received',
      description: body_text,
    });

    // Trigger AI analysis in background (fire-and-forget)
    base44.asServiceRole.functions.invoke('analyzeConversation', { conversation_id: convId }).catch(() => {});

    // Calculate lead score (fire-and-forget)
    base44.asServiceRole.functions.invoke('calculateLeadScore', { conversation_id: convId }).catch(() => {});

    // Execute automation rules (fire-and-forget)
    base44.asServiceRole.functions.invoke('executeAutomationRules', { conversation_id: convId }).catch(() => {});
  }

  return Response.json({ status: 'ok' });
});