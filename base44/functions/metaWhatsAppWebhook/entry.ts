import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * metaWhatsAppWebhook — Meta Cloud API webhook handler for business number +971582806000
 *
 * GET  → Meta verification handshake
 * POST → Inbound messages → WhatsAppConversation (channel=business) + WhatsAppMessage
 *
 * IMPORTANT: Processing is done SYNCHRONOUSLY (not in background) so the SDK client
 * remains valid. We still return 200 immediately via a streaming trick — but actually
 * the simplest fix is just to process synchronously and return 200 after. Meta allows
 * up to 20 seconds before it retries; our processing takes < 2s.
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

function stripPlus(raw) {
  if (!raw) return '';
  return String(raw).replace(/^\+/, '').trim();
}

// Own WhatsApp line numbers (digits-only) — used to filter self-echo and noise.
const OWN_LINE_NUMBERS = new Set([
  '971582806000', '971581806000', '971529871277', '971522869064', '971559508545',
]);

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

  // ── GET: Meta verification handshake ──────────────────────────────────────
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const verifyToken = (url.searchParams.get('hub.verify_token') || '').trim();
    const challenge = url.searchParams.get('hub.challenge');
    const expectedVerifyToken = (Deno.env.get('META_VERIFY_TOKEN') || '').trim();
    console.log(`[metaWhatsAppWebhook] GET verify: mode=${mode} token_match=${verifyToken === expectedVerifyToken}`);
    if (mode === 'subscribe' && verifyToken === expectedVerifyToken && challenge) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // ── POST: Parse body first ─────────────────────────────────────────────────
  let body;
  try { body = await req.json(); } catch {
    return new Response('OK', { status: 200 });
  }

  // Create SDK client from the LIVE request (must be done before any await that could lose context)
  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;

  // Process SYNCHRONOUSLY — avoids SDK client expiring in background IIFE
  // Meta allows up to 20s; our processing is well under that
  try {
    const entries = body?.entry || [];
    for (const entry of entries) {
      for (const change of (entry?.changes || [])) {
        const value = change?.value || {};

        // ── phone_number_id safety check ─────────────────────────────────────
        const incomingPhoneNumberId = value?.metadata?.phone_number_id;
        const expectedPhoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
        if (incomingPhoneNumberId && expectedPhoneNumberId && incomingPhoneNumberId !== expectedPhoneNumberId) {
          console.log(`[metaWhatsAppWebhook] Skipping — phone_number_id mismatch: got ${incomingPhoneNumberId}, expected ${expectedPhoneNumberId}`);
          continue;
        }

        // ── Status updates ────────────────────────────────────────────────────
        for (const status of (value?.statuses || [])) {
          try {
            const msgs = await svc.entities.WhatsAppMessage.filter({ wa_message_id: status.id });
            if (msgs.length > 0) {
              await svc.entities.WhatsAppMessage.update(msgs[0].id, { status: status.status });
            }
          } catch (err) { console.warn('[metaWhatsAppWebhook] status update failed', err?.message); }
        }

        if (!value?.messages?.length) continue;

        // ── Inbound messages ──────────────────────────────────────────────────
        for (const msg of value.messages) {
          try {
            const fromNumber = msg.from; // digits only from Meta (no +)
            const waMessageId = msg.id;
            const timestamp = new Date(parseInt(msg.timestamp) * 1000).toISOString();
            const isVoice = msg.type === 'audio' && msg.audio;
            const bodyText = msg.text?.body || msg.caption ||
              (isVoice ? '🎤 Voice message' : `[${msg.type}]`);

            const e164Phone = normalizePhone(fromNumber);
            const digitsPhone = stripPlus(e164Phone);
            const senderProfile = value?.contacts?.find(c => c.wa_id === fromNumber);
            const waDisplayName = senderProfile?.profile?.name || '';

            // ── Noise filter: skip own line numbers, shortcodes, UAE landlines ──
            const senderDigits = digitsPhone.replace(/\D/g, '');
            if (OWN_LINE_NUMBERS.has(senderDigits)) {
              console.log(`[metaWhatsAppWebhook] Skipping self-echo from own line: ${senderDigits}`);
              continue;
            }
            if (senderDigits.length < 9) {
              console.log(`[metaWhatsAppWebhook] Skipping shortcode sender: ${senderDigits}`);
              continue;
            }
            if (senderDigits.startsWith('9714')) {
              console.log(`[metaWhatsAppWebhook] Skipping UAE landline: ${senderDigits}`);
              continue;
            }

            console.log(`[metaWhatsAppWebhook] INBOUND from=${e164Phone} type=${msg.type} msgId=${waMessageId}`);

            // ── Dedupe by wa_message_id ──────────────────────────────────────
            const dupWA = await svc.entities.WhatsAppMessage.filter({ wa_message_id: waMessageId }).catch(() => []);
            if (dupWA.length > 0) {
              console.log(`[metaWhatsAppWebhook] Duplicate msgId=${waMessageId}, skipping`);
              continue;
            }

            // ── Find or create WhatsAppConversation (STRICTLY channel=business) ──
            let conv = null;
            const existing = await svc.entities.WhatsAppConversation.filter({ wa_phone_e164: e164Phone, channel: 'business' }).catch(() => []);
            conv = existing?.[0] || null;

            if (!conv) {
              conv = await svc.entities.WhatsAppConversation.create({
                wa_phone_e164: e164Phone,
                phone_number: e164Phone,
                wa_display_name: waDisplayName || e164Phone,
                channel: 'business',
                status: 'new',
                first_message_at: timestamp,
                last_inbound_at: timestamp,
                last_message: bodyText,
                last_message_at: timestamp,
                unread_count: 1,
              });
              console.log(`[metaWhatsAppWebhook] ✅ Created new business conversation id=${conv.id} for ${e164Phone}`);
            } else {
              await svc.entities.WhatsAppConversation.update(conv.id, {
                channel: 'business',
                status: conv.status === 'resolved' ? 'open' : (conv.status || 'open'),
                wa_display_name: waDisplayName || conv.wa_display_name,
                last_inbound_at: timestamp,
                last_message: bodyText,
                last_message_at: timestamp,
                unread_count: (conv.unread_count || 0) + 1,
              }).catch(err => console.warn('[metaWhatsAppWebhook] conv update failed', err?.message));
              console.log(`[metaWhatsAppWebhook] ✅ Updated existing business conversation id=${conv.id}`);
            }

            // ── Save WhatsAppMessage ─────────────────────────────────────────
            const waMsg = await svc.entities.WhatsAppMessage.create({
              conversation_id: conv.id,
              wa_message_id: waMessageId,
              direction: 'inbound',
              body: bodyText,
              status: 'delivered',
              timestamp,
              from_number: e164Phone,
              to_number: value.metadata?.display_phone_number || '+971582806000',
              media_type: msg.type !== 'text' ? msg.type : 'none',
              channel: 'business',
              assigned_agent_email: conv.assigned_agent_email || null,
            });
            console.log(`[metaWhatsAppWebhook] ✅ WhatsAppMessage saved id=${waMsg.id} conv=${conv.id}`);

            // ── Identity resolution + legacy Message write (with dedup) ──────
            let landlordId = null, leadId = null, agentEmail = null;
            try {
              const idRes = await svc.functions.invoke('resolveMessageIdentity', { digits_phone: digitsPhone });
              const idData = idRes?.data ?? idRes;
              landlordId = idData?.landlord_id || null;
              leadId = idData?.lead_id || null;
              agentEmail = idData?.agent_email || null;
            } catch (e) { console.warn('[metaWhatsAppWebhook] Identity resolution failed:', e?.message); }

            if (landlordId) {
              // Dedup: skip if a Message with this wa_message_id already exists
              const existingMsg = waMessageId
                ? await svc.entities.Message.filter({ wa_message_id: waMessageId }).catch(() => [])
                : [];
              if (existingMsg?.length === 0) {
                const brainMsg = await svc.entities.Message.create({
                  landlord_id: landlordId,
                  lead_id: leadId,
                  phone: digitsPhone,
                  direction: 'incoming',
                  text: bodyText,
                  timestamp,
                  status: 'received',
                  wa_message_id: waMessageId,
                  channel: 'business',
                  instance_name: 'erudite',
                  agent_email: agentEmail || conv?.assigned_agent_email || null,
                  ...(isVoice ? { media_type: 'audio', is_voice_note: true, media_mime: msg.audio?.mime_type || 'audio/ogg', media_status: 'pending_download' } : {}),
                }).catch(() => null);
                if (isVoice && brainMsg?.id && msg.audio?.id) {
                  svc.functions.invoke('metaDownloadVoice', { message_id: brainMsg.id, media_id: msg.audio.id }).catch(() => {});
                }
              }
              svc.functions.invoke('analyzeLandlordConversation', { landlord_id: landlordId }).catch(() => {});
            }

            // ── Background: enrich + routing (fire-and-forget) ───────────────
            svc.functions.invoke('enrichConversation', { conversation_id: conv.id }).catch(() => {});
            svc.functions.invoke('executeAutomationRules', { conversation_id: conv.id }).catch(() => {});

          } catch (err) {
            console.error('[metaWhatsAppWebhook] per-message error:', err?.message || err);
          }
        }
      }
    }
  } catch (err) {
    console.error('[metaWhatsAppWebhook] processing error:', err?.message || err);
  }

  return new Response('OK', { status: 200 });
});