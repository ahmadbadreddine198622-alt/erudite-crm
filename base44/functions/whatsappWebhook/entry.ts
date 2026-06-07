import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * WhatsApp Cloud API webhook.
 *
 * GET  → Meta verification handshake
 * POST → message events + status updates
 *
 * Every inbound message is routed through `routeWhatsAppMessage` which:
 *   - Matches the sender against Lead / Landlord / Contact
 *   - If unknown → classifies intent and creates the right entity (Lead OR Landlord)
 *   - Auto-assigns an agent, triggers Aurora orchestrator, logs the activity
 *
 * This webhook is responsible for:
 *   - Verifying with Meta (GET)
 *   - Deduping by wa_message_id
 *   - Persisting the WhatsAppMessage + WhatsAppConversation records
 *   - Calling the router and saving its result back to the conversation
 *   - Handling voice messages (transcription) and message status callbacks
 */

function normalizePhone(raw: string): string {
  if (!raw) return '';
  let c = String(raw).replace(/[^\d+]/g, '');
  if (!c) return '';
  if (c.startsWith('+')) return c;
  if (c.startsWith('00')) return '+' + c.slice(2);
  if (c.startsWith('05') && c.length === 10) return '+971' + c.slice(1);
  if (c.startsWith('5') && c.length === 9) return '+971' + c;
  if (c.length >= 10) return '+' + c;
  return c;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // ----- GET: webhook verification handshake -----
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

  // ----- POST: messages + status updates -----
  const body = await req.json();
  const base44 = createClientFromRequest(req);

  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  // Status updates: delivered / read / failed
  if (value?.statuses?.length) {
    for (const status of value.statuses) {
      try {
        const msgs = await base44.asServiceRole.entities.WhatsAppMessage.filter({ wa_message_id: status.id });
        if (msgs.length > 0) {
          await base44.asServiceRole.entities.WhatsAppMessage.update(msgs[0].id, { status: status.status });
        }
      } catch (err) { console.warn('status update failed', err); }
    }
    return Response.json({ status: 'ok', type: 'status_update' });
  }

  if (!value?.messages?.length) {
    return Response.json({ status: 'no_messages' });
  }

  const results: any[] = [];

  for (const msg of value.messages) {
    try {
      const fromNumber = msg.from;
      const waMessageId = msg.id;
      const timestamp = new Date(parseInt(msg.timestamp) * 1000).toISOString();
      const isVoiceMessage = msg.type === 'audio' && msg.audio;
      let bodyText = msg.text?.body || msg.caption || (isVoiceMessage ? '🎤 Voice message (transcribing…)' : `[${msg.type}]`);

      const e164Phone = normalizePhone(fromNumber);
      
      // Extract sender's profile name from Meta's contact data
      const senderProfile = value?.contacts?.find(c => c.wa_id === fromNumber);
      const waDisplayName = senderProfile?.profile?.name || '';

      // ---- Dedupe by wa_message_id (Meta retries the webhook on failure) ----
      const dup = await base44.asServiceRole.entities.WhatsAppMessage.filter({ wa_message_id: waMessageId });
      if (dup.length > 0) {
        results.push({ wa_message_id: waMessageId, status: 'duplicate' });
        continue;
      }

      // ---- Find or create the WhatsAppConversation (by phone) ----
      let conv = null;
      try {
        const convs = await base44.asServiceRole.entities.WhatsAppConversation.filter({ wa_phone_e164: e164Phone });
        conv = convs?.[0] || null;
      } catch {}
      // Legacy fallback: some old conversations stored phone in phone_number not wa_phone_e164
      if (!conv) {
        try {
          const convs = await base44.asServiceRole.entities.WhatsAppConversation.filter({ phone_number: e164Phone });
          conv = convs?.[0] || null;
        } catch {}
      }

      if (!conv) {
        // Brand-new conversation — create stub
        try {
          conv = await base44.asServiceRole.entities.WhatsAppConversation.create({
            wa_phone_e164: e164Phone,
            phone_number: e164Phone,
            wa_display_name: waDisplayName,
            status: 'new',
            first_message_at: timestamp,
            last_inbound_at: timestamp,
            last_message: bodyText,
            last_message_at: timestamp,
            unread_count: 1
          });
        } catch (err) {
          console.error('conversation create failed', err);
          results.push({ wa_message_id: waMessageId, error: 'conversation_create_failed' });
          continue;
        }
      } else {
        // Existing conversation — bump counters & update display name if missing
        try {
          await base44.asServiceRole.entities.WhatsAppConversation.update(conv.id, {
            status: conv.status === 'resolved' ? 'open' : (conv.status || 'open'),
            wa_display_name: waDisplayName || conv.wa_display_name,
            last_inbound_at: timestamp,
            last_message: bodyText,
            last_message_at: timestamp,
            unread_count: (conv.unread_count || 0) + 1
          });
        } catch (err) { console.warn('conversation update failed', err); }
      }

      // ---- Route the message through Aurora (Lead/Landlord matching + classification) ----
      // Fetch up to 10 prior message bodies for thread context
      let recentThread: string[] = [];
      try {
        const prior = await base44.asServiceRole.entities.WhatsAppMessage.filter(
          { conversation_id: conv.id }, '-timestamp', 10
        );
        recentThread = prior.reverse().map((m: any) => `[${m.direction}] ${m.body}`);
      } catch {}

      let routeResult: any = null;
      try {
        const r = await base44.asServiceRole.functions.invoke('routeWhatsAppMessage', {
          phone_e164: e164Phone,
          message_text: bodyText,
          message_id: waMessageId,
          timestamp,
          conversation_id: conv.id,
          recent_thread: recentThread
        });
        routeResult = r?.data || r;
      } catch (err) {
        console.error('routeWhatsAppMessage failed', err);
      }

      // ---- Persist the WhatsApp message ----
      let messageRecord = null;
      try {
        const inboundRecord: any = {
          conversation_id: conv.id,
          wa_message_id: waMessageId,
          direction: 'inbound',
          body: bodyText,
          status: 'delivered',
          timestamp,
          from_number: e164Phone,
          to_number: value.metadata?.display_phone_number || '',
          media_type: msg.type !== 'text' ? msg.type : 'none',
          channel: 'business'
        };
        if (routeResult?.routed_entity_id) inboundRecord.lead_id = routeResult.routed_entity_id;
        messageRecord = await base44.asServiceRole.entities.WhatsAppMessage.create(inboundRecord);
        console.log('✅ Message created:', messageRecord.id, 'conversation:', conv.id);
      } catch (err) { 
        console.error('❌ message create failed:', err.message);
        console.error('Details:', {
          conversation_id: conv.id,
          wa_message_id: waMessageId,
          body: bodyText,
          timestamp
        });
      }

      // ---- Update conversation with routing result ----
      if (routeResult?.routed_entity_id) {
        try {
          const convUpdate: any = {};
          if (routeResult.routed_entity_type === 'landlord') {
            convUpdate.landlord_id = routeResult.routed_entity_id;
          } else if (routeResult.routed_entity_type === 'lead') {
            convUpdate.lead_id = routeResult.routed_entity_id;
          }
          if (routeResult.assigned_agent_email) {
            convUpdate.assigned_agent_email = routeResult.assigned_agent_email;
            convUpdate.assigned_at = timestamp;
          }
          if (routeResult.classification) {
            convUpdate.detected_language = routeResult.classification.language;
            convUpdate.ai_priority = routeResult.classification.urgency === 'urgent' ? 'urgent' :
                                     routeResult.classification.urgency === 'high' ? 'high' :
                                     routeResult.classification.urgency === 'low' ? 'low' : 'medium';
            convUpdate.ai_intent = routeResult.classification.intent;
            convUpdate.tags = ['auto_routed', routeResult.routed_entity_type, routeResult.classification.intent].filter(Boolean);
          }
          if (Object.keys(convUpdate).length > 0) {
            await base44.asServiceRole.entities.WhatsAppConversation.update(conv.id, convUpdate);
          }
        } catch (err) { console.warn('conversation routing update failed', err); }
      }

      // ---- Voice transcription (fire-and-forget) ----
      if (isVoiceMessage && msg.audio?.id && messageRecord) {
        const audioUrl = `https://graph.facebook.com/v21.0/${msg.audio.id}?access_token=${Deno.env.get('WHATSAPP_ACCESS_TOKEN')}`;
        base44.asServiceRole.functions.invoke('processVoiceMessage', {
          conversation_id: conv.id,
          message_id: messageRecord.id,
          audio_url: audioUrl,
          from_number: e164Phone
        }).catch(() => {});
      }

      // ---- Background AI enrichment ----
      base44.asServiceRole.functions.invoke('enrichConversation', { conversation_id: conv.id }).catch(() => {});
      base44.asServiceRole.functions.invoke('executeAutomationRules', { conversation_id: conv.id }).catch(() => {});

      results.push({
        wa_message_id: waMessageId,
        status: 'routed',
        routed_entity_type: routeResult?.routed_entity_type,
        routed_entity_id: routeResult?.routed_entity_id,
        created: routeResult?.created,
        action: routeResult?.action_taken
      });
    } catch (err: any) {
      console.error('per-message processing failed', err);
      results.push({ error: err.message });
    }
  }

  return Response.json({ status: 'ok', processed: results.length, results });
});