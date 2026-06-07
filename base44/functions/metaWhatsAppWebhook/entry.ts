import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * metaWhatsAppWebhook — THE single Meta Cloud API webhook handler.
 *
 * Replaces the old whatsappWebhook. Handles all events from +971582806000.
 *
 * GET  → Meta verification handshake (uses META_VERIFY_TOKEN)
 * POST → Full WhatsApp Inbox pipeline:
 *         - P5 safety: verify phone_number_id matches WHATSAPP_PHONE_NUMBER_ID
 *         - Status updates → update WhatsAppMessage.status
 *         - Inbound messages → create/update WhatsAppConversation + WhatsAppMessage
 *                           → routeWhatsAppMessage (lead matching, auto-reply, agent assignment)
 *         - Voice → processVoiceMessage (transcription)
 *         - Background: enrichConversation, executeAutomationRules
 *
 * Auth: secret query param (same as evolutionWebhook) — required on all calls.
 */

function normalizePhone(raw) {
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

// Strip leading + so we can compare against stored E.164 digits (same logic as evolutionWebhook)
function stripPlus(raw) {
  if (!raw) return '';
  return String(raw).replace(/^\+/, '').trim();
}

// Priority: match sender against Landlord records (phone, whatsapp, additional_phones)
async function findLandlordByDigits(svc, digitsPhone) {
  const all = await svc.entities.Landlord.list('-created_date', 2000).catch(() => []);
  for (const landlord of all) {
    if (stripPlus(landlord.phone) === digitsPhone) return landlord;
    if (stripPlus(landlord.whatsapp) === digitsPhone) return landlord;
    const extras = Array.isArray(landlord.additional_phones) ? landlord.additional_phones : [];
    if (extras.some(e => stripPlus(e) === digitsPhone)) return landlord;
  }
  return null;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // ── Auth: secret query param ───────────────────────────────────────────────
  const secret = (url.searchParams.get('secret') || '').trim();
  const expectedSecret = (Deno.env.get('META_WEBHOOK_SECRET') || '').trim();
  if (!expectedSecret || secret !== expectedSecret) {
    console.log(`[metaWhatsAppWebhook] Unauthorized: secret="${secret}"`);
    return new Response('Unauthorized', { status: 401 });
  }

  // ── GET: Meta verification handshake ──────────────────────────────────────
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const verifyToken = (url.searchParams.get('hub.verify_token') || '').trim();
    const challenge = url.searchParams.get('hub.challenge');
    const expectedVerifyToken = (Deno.env.get('META_VERIFY_TOKEN') || '').trim();
    console.log(`[metaWhatsAppWebhook] GET verify: mode=${mode} token="${verifyToken}"`);
    if (mode === 'subscribe' && verifyToken === expectedVerifyToken && challenge) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // ── POST: message events ───────────────────────────────────────────────────
  // Always respond 200 immediately so Meta doesn't disable the webhook
  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;

  let body;
  try { body = await req.json(); } catch {
    return new Response('OK', { status: 200 });
  }

  // Process in background — never block Meta's 200
  (async () => {
    try {
      const entries = body?.entry || [];
      for (const entry of entries) {
        const changes = entry?.changes || [];
        for (const change of changes) {
          const value = change?.value || {};

          // ── P5: phone_number_id safety check ──────────────────────────────
          const incomingPhoneNumberId = value?.metadata?.phone_number_id;
          const expectedPhoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
          if (incomingPhoneNumberId && expectedPhoneNumberId && incomingPhoneNumberId !== expectedPhoneNumberId) {
            console.log(`[metaWhatsAppWebhook] Skipping — phone_number_id mismatch: got ${incomingPhoneNumberId}, expected ${expectedPhoneNumberId}`);
            continue;
          }

          // ── Status updates → update WhatsAppMessage.status ─────────────────
          for (const status of (value?.statuses || [])) {
            try {
              const msgs = await svc.entities.WhatsAppMessage.filter({ wa_message_id: status.id });
              if (msgs.length > 0) {
                await svc.entities.WhatsAppMessage.update(msgs[0].id, { status: status.status });
              }
            } catch (err) { console.warn('[metaWhatsAppWebhook] status update failed', err); }
          }

          if (!value?.messages?.length) continue;

          // ── Inbound messages ───────────────────────────────────────────────
          for (const msg of value.messages) {
            try {
              const fromNumber = msg.from;
              const waMessageId = msg.id;
              const timestamp = new Date(parseInt(msg.timestamp) * 1000).toISOString();
              const isVoiceMessage = msg.type === 'audio' && msg.audio;
              const bodyText = msg.text?.body || msg.caption ||
                (isVoiceMessage ? '🎤 Voice message (transcribing…)' : `[${msg.type}]`);

              const e164Phone = normalizePhone(fromNumber);
              const senderProfile = value?.contacts?.find(c => c.wa_id === fromNumber);
              const waDisplayName = senderProfile?.profile?.name || '';

              console.log(`[metaWhatsAppWebhook] from=${e164Phone} type=${msg.type} text="${bodyText.slice(0, 80)}"`);

              // ── PRIORITY: landlord match → Message entity, skip lead inbox ──
              const digitsPhone = fromNumber.replace(/^\+/, '').trim();
              const matchedLandlord = await findLandlordByDigits(svc, digitsPhone);
              if (matchedLandlord) {
                console.log(`[metaWhatsAppWebhook] Landlord match ${matchedLandlord.id} (${matchedLandlord.full_name_en}) — routing to Message entity, skipping lead inbox`);
                // Dedupe by wa_message_id in Message entity
                const dupMsg = await svc.entities.Message.filter({ wa_message_id: waMessageId }).catch(() => []);
                if (dupMsg.length > 0) {
                  console.log(`[metaWhatsAppWebhook] duplicate wa_message_id=${waMessageId} in Message, skipping`);
                  continue;
                }
                await svc.entities.Message.create({
                  landlord_id: matchedLandlord.id,
                  phone: digitsPhone,
                  direction: 'incoming',
                  text: bodyText,
                  timestamp,
                  status: 'received',
                  wa_message_id: waMessageId || null,
                  channel: 'api',
                });
                console.log(`[metaWhatsAppWebhook] ✅ Landlord Message saved (api channel) for landlord ${matchedLandlord.id}`);
                // Fire AI analysis but NO auto-reply — landlords must not receive the lead welcome message
                svc.functions.invoke('analyzeLandlordConversation', { landlord_id: matchedLandlord.id }).catch(() => {});
                continue; // skip the entire lead-inbox pipeline below
              }

              // ── Dedupe (lead inbox path) ──────────────────────────────────
              const dup = await svc.entities.WhatsAppMessage.filter({ wa_message_id: waMessageId });
              if (dup.length > 0) {
                console.log(`[metaWhatsAppWebhook] duplicate wa_message_id=${waMessageId}, skipping`);
                continue;
              }

              // ── Find or create WhatsAppConversation ───────────────────────
              let conv = null;
              const convsByE164 = await svc.entities.WhatsAppConversation.filter({ wa_phone_e164: e164Phone }).catch(() => []);
              conv = convsByE164?.[0] || null;
              if (!conv) {
                const convsByPhone = await svc.entities.WhatsAppConversation.filter({ phone_number: e164Phone }).catch(() => []);
                conv = convsByPhone?.[0] || null;
              }

              if (!conv) {
                conv = await svc.entities.WhatsAppConversation.create({
                  wa_phone_e164: e164Phone,
                  phone_number: e164Phone,
                  wa_display_name: waDisplayName,
                  status: 'new',
                  first_message_at: timestamp,
                  last_inbound_at: timestamp,
                  last_message: bodyText,
                  last_message_at: timestamp,
                  unread_count: 1,
                });
              } else {
                await svc.entities.WhatsAppConversation.update(conv.id, {
                  status: conv.status === 'resolved' ? 'open' : (conv.status || 'open'),
                  wa_display_name: waDisplayName || conv.wa_display_name,
                  last_inbound_at: timestamp,
                  last_message: bodyText,
                  last_message_at: timestamp,
                  unread_count: (conv.unread_count || 0) + 1,
                }).catch(err => console.warn('conv update failed', err));
              }

              // ── Route through Aurora ───────────────────────────────────────
              let recentThread = [];
              try {
                const prior = await svc.entities.WhatsAppMessage.filter({ conversation_id: conv.id }, '-timestamp', 10);
                recentThread = prior.reverse().map(m => `[${m.direction}] ${m.body}`);
              } catch {}

              let routeResult = null;
              try {
                const r = await svc.functions.invoke('routeWhatsAppMessage', {
                  phone_e164: e164Phone,
                  message_text: bodyText,
                  message_id: waMessageId,
                  timestamp,
                  conversation_id: conv.id,
                  recent_thread: recentThread,
                });
                routeResult = r?.data || r;
              } catch (err) {
                console.error('[metaWhatsAppWebhook] routeWhatsAppMessage failed', err);
              }

              // ── Persist WhatsAppMessage ────────────────────────────────────
              const inboundRecord = {
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
              const messageRecord = await svc.entities.WhatsAppMessage.create(inboundRecord);
              console.log(`[metaWhatsAppWebhook] ✅ Message ${messageRecord.id} saved, conv=${conv.id}`);

              // ── Update conversation with routing result ────────────────────
              if (routeResult?.routed_entity_id) {
                const convUpdate = {};
                if (routeResult.routed_entity_type === 'landlord') convUpdate.landlord_id = routeResult.routed_entity_id;
                else if (routeResult.routed_entity_type === 'lead') convUpdate.lead_id = routeResult.routed_entity_id;
                if (routeResult.assigned_agent_email) {
                  convUpdate.assigned_agent_email = routeResult.assigned_agent_email;
                  convUpdate.assigned_at = timestamp;
                }
                if (routeResult.classification) {
                  convUpdate.detected_language = routeResult.classification.language;
                  convUpdate.ai_priority = routeResult.classification.urgency === 'urgent' ? 'urgent' :
                                           routeResult.classification.urgency === 'high' ? 'high' : 'medium';
                  convUpdate.ai_intent = routeResult.classification.intent;
                  convUpdate.tags = ['auto_routed', routeResult.routed_entity_type, routeResult.classification.intent].filter(Boolean);
                }
                if (Object.keys(convUpdate).length > 0) {
                  await svc.entities.WhatsAppConversation.update(conv.id, convUpdate).catch(err => console.warn('conv routing update failed', err));
                }
              }

              // ── Voice transcription DISABLED — re-enable when OPENAI_API_KEY is configured ─────────────────────
              // if (isVoiceMessage && msg.audio?.id && messageRecord) {
              //   const audioUrl = `https://graph.facebook.com/v21.0/${msg.audio.id}?access_token=${Deno.env.get('WHATSAPP_ACCESS_TOKEN')}`;
              //   svc.functions.invoke('processVoiceMessage', {
              //     conversation_id: conv.id,
              //     message_id: messageRecord.id,
              //     audio_url: audioUrl,
              //     from_number: e164Phone,
              //   }).catch(() => {});
              // }

              // ── Background enrichment ──────────────────────────────────────
              svc.functions.invoke('enrichConversation', { conversation_id: conv.id }).catch(() => {});
              svc.functions.invoke('executeAutomationRules', { conversation_id: conv.id }).catch(() => {});

            } catch (err) {
              console.error('[metaWhatsAppWebhook] per-message error:', err.message);
            }
          }
        }
      }
    } catch (err) {
      console.error('[metaWhatsAppWebhook] processing error:', err.message);
    }
  })();

  return new Response('OK', { status: 200 });
});