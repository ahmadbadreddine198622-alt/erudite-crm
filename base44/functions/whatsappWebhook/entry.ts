import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * whatsappWebhook — Meta Cloud API webhook for business number +971582806000
 *
 * This is the URL registered in Meta Developer Console.
 * It saves messages to the DB FIRST, then fires background enrichment.
 *
 * GET  → Meta verification handshake (WHATSAPP_VERIFY_TOKEN)
 * POST → Saves WhatsAppConversation (channel=business) + WhatsAppMessage immediately,
 *        then fires routeWhatsAppMessage + enrichConversation in background.
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

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // ── GET: Meta verification handshake ──────────────────────────────────────
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = (url.searchParams.get('hub.verify_token') || '').trim();
    const challenge = url.searchParams.get('hub.challenge');
    const verifyToken = (Deno.env.get('WHATSAPP_VERIFY_TOKEN') || Deno.env.get('META_VERIFY_TOKEN') || '').trim();
    console.log(`[whatsappWebhook] GET verify: mode=${mode} token_match=${token === verifyToken}`);
    if (mode === 'subscribe' && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // ── POST: Parse body ───────────────────────────────────────────────────────
  let body;
  try { body = await req.json(); } catch {
    return new Response('OK', { status: 200 });
  }

  // Create SDK client from the live request
  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;

  // Process synchronously so SDK client stays valid
  // Meta allows up to 20s; we target < 3s by saving first and routing in background
  try {
    const entries = body?.entry || [];
    for (const entry of entries) {
      for (const change of (entry?.changes || [])) {
        const value = change?.value || {};

        // ── phone_number_id safety check ─────────────────────────────────────
        const incomingPhoneNumberId = value?.metadata?.phone_number_id;
        const expectedPhoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
        if (incomingPhoneNumberId && expectedPhoneNumberId && incomingPhoneNumberId !== expectedPhoneNumberId) {
          console.log(`[whatsappWebhook] Skipping — phone_number_id mismatch: got ${incomingPhoneNumberId}, expected ${expectedPhoneNumberId}`);
          continue;
        }

        // ── Status updates ────────────────────────────────────────────────────
        for (const status of (value?.statuses || [])) {
          try {
            const msgs = await svc.entities.WhatsAppMessage.filter({ wa_message_id: status.id });
            if (msgs.length > 0) {
              await svc.entities.WhatsAppMessage.update(msgs[0].id, { status: status.status });
            }
          } catch (err) { console.warn('[whatsappWebhook] status update failed:', err?.message); }
        }

        if (!value?.messages?.length) continue;

        // ── Inbound messages ──────────────────────────────────────────────────
        for (const msg of value.messages) {
          try {
            const fromNumber = msg.from; // Meta sends digits only, no +
            const waMessageId = msg.id;
            const timestamp = new Date(parseInt(msg.timestamp) * 1000).toISOString();
            const isVoice = msg.type === 'audio' && msg.audio;
            const bodyText = msg.text?.body || msg.caption ||
              (isVoice ? '🎤 Voice message' : `[${msg.type}]`);

            const e164Phone = normalizePhone(fromNumber);
            const senderProfile = value?.contacts?.find(c => c.wa_id === fromNumber);
            const waDisplayName = senderProfile?.profile?.name || '';

            console.log(`[whatsappWebhook] INBOUND from=${e164Phone} type=${msg.type} msgId=${waMessageId} text="${bodyText.slice(0, 60)}"`);

            // ── Dedupe by wa_message_id ──────────────────────────────────────
            const dupWA = await svc.entities.WhatsAppMessage.filter({ wa_message_id: waMessageId }).catch(() => []);
            if (dupWA.length > 0) {
              console.log(`[whatsappWebhook] Duplicate msgId=${waMessageId}, skipping`);
              continue;
            }

            // ── Find or create WhatsAppConversation — strictly channel=business ──
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
              console.log(`[whatsappWebhook] ✅ Created new business conversation id=${conv.id} for ${e164Phone}`);
            } else {
              await svc.entities.WhatsAppConversation.update(conv.id, {
                channel: 'business',
                status: conv.status === 'resolved' ? 'open' : (conv.status || 'open'),
                wa_display_name: waDisplayName || conv.wa_display_name,
                last_inbound_at: timestamp,
                last_message: bodyText,
                last_message_at: timestamp,
                unread_count: (conv.unread_count || 0) + 1,
              }).catch(err => console.warn('[whatsappWebhook] conv update failed:', err?.message));
              console.log(`[whatsappWebhook] ✅ Updated business conversation id=${conv.id}`);
            }

            // ── Save WhatsAppMessage IMMEDIATELY (critical — do this before any slow calls) ──
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
            });
            console.log(`[whatsappWebhook] ✅ WhatsAppMessage saved id=${waMsg.id} conv=${conv.id}`);

            // ── Background: route + enrich (slow AI calls — fire and forget) ────
            svc.functions.invoke('routeWhatsAppMessage', {
              phone_e164: e164Phone,
              message_text: bodyText,
              message_id: waMessageId,
              timestamp,
              conversation_id: conv.id,
            }).catch(() => {});
            svc.functions.invoke('enrichConversation', { conversation_id: conv.id }).catch(() => {});
            svc.functions.invoke('executeAutomationRules', { conversation_id: conv.id }).catch(() => {});

          } catch (err) {
            console.error('[whatsappWebhook] per-message error:', err?.message || err);
          }
        }
      }
    }
  } catch (err) {
    console.error('[whatsappWebhook] processing error:', err?.message || err);
  }

  return new Response('OK', { status: 200 });
});