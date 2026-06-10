import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Temporary webhook logger — configure this URL in Meta as a SECOND webhook
 * (or swap it in temporarily) to see exactly what Meta is sending.
 * 
 * GET  → verification (accepts any token for testing)
 * POST → logs the full payload and saves the first message to DB if valid
 */

function normalizePhone(raw) {
  if (!raw) return '';
  let c = String(raw).replace(/[^\d+]/g, '');
  if (!c) return '';
  if (c.startsWith('+')) return c;
  if (c.length >= 10) return '+' + c;
  return c;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // GET: verification — accept any token so we can test quickly
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const challenge = url.searchParams.get('hub.challenge');
    const token = url.searchParams.get('hub.verify_token');
    const expectedToken = (Deno.env.get('WHATSAPP_VERIFY_TOKEN') || Deno.env.get('META_VERIFY_TOKEN') || '').trim();
    console.log(`[metaWebhookLogger] GET verify: mode=${mode} token=${token} expected=${expectedToken} challenge=${challenge}`);
    if (mode === 'subscribe' && challenge && token === expectedToken) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    // Also accept if no expected token is configured (for testing)
    if (mode === 'subscribe' && challenge) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // POST: log everything
  let rawBody = '';
  let body = null;
  try {
    rawBody = await req.text();
    body = JSON.parse(rawBody);
  } catch (_) {}

  console.log('[metaWebhookLogger] ===== INCOMING WEBHOOK =====');
  console.log('[metaWebhookLogger] Headers:', JSON.stringify(Object.fromEntries(req.headers.entries())));
  console.log('[metaWebhookLogger] Body:', rawBody.slice(0, 3000));

  if (!body) {
    return new Response('OK', { status: 200 });
  }

  // Extract key info
  const entries = body?.entry || [];
  for (const entry of entries) {
    for (const change of (entry?.changes || [])) {
      const value = change?.value || {};
      const phoneNumberId = value?.metadata?.phone_number_id;
      const displayPhone = value?.metadata?.display_phone_number;
      console.log(`[metaWebhookLogger] phone_number_id=${phoneNumberId} display=${displayPhone}`);
      
      for (const status of (value?.statuses || [])) {
        console.log(`[metaWebhookLogger] STATUS UPDATE: id=${status.id} status=${status.status} recipient=${status.recipient_id}`);
      }
      
      for (const msg of (value?.messages || [])) {
        const fromNumber = msg.from;
        const waMessageId = msg.id;
        const timestamp = new Date(parseInt(msg.timestamp) * 1000).toISOString();
        const bodyText = msg.text?.body || msg.caption || `[${msg.type}]`;
        const e164Phone = normalizePhone(fromNumber);
        console.log(`[metaWebhookLogger] ✅ INBOUND MESSAGE: from=${e164Phone} type=${msg.type} body="${bodyText}" msgId=${waMessageId} ts=${timestamp}`);

        // Save it to DB using the real webhook logic
        try {
          const base44 = createClientFromRequest(req);
          const svc = base44.asServiceRole;

          // Dedupe
          const dup = await svc.entities.WhatsAppMessage.filter({ wa_message_id: waMessageId }).catch(() => []);
          if (dup.length > 0) {
            console.log(`[metaWebhookLogger] Duplicate, skipping save`);
            continue;
          }

          // Find or create conversation
          let conv = null;
          const existing = await svc.entities.WhatsAppConversation.filter({ wa_phone_e164: e164Phone, channel: 'business' }).catch(() => []);
          conv = existing?.[0] || null;

          if (!conv) {
            const waDisplayName = value?.contacts?.find(c => c.wa_id === fromNumber)?.profile?.name || '';
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
            console.log(`[metaWebhookLogger] Created conv id=${conv.id}`);
          } else {
            await svc.entities.WhatsAppConversation.update(conv.id, {
              last_inbound_at: timestamp,
              last_message: bodyText,
              last_message_at: timestamp,
              unread_count: (conv.unread_count || 0) + 1,
            });
            console.log(`[metaWebhookLogger] Updated conv id=${conv.id}`);
          }

          const waMsg = await svc.entities.WhatsAppMessage.create({
            conversation_id: conv.id,
            wa_message_id: waMessageId,
            direction: 'inbound',
            body: bodyText,
            status: 'delivered',
            timestamp,
            from_number: e164Phone,
            to_number: displayPhone || '+971582806000',
            media_type: msg.type !== 'text' ? msg.type : 'none',
            channel: 'business',
          });
          console.log(`[metaWebhookLogger] ✅ Saved WhatsAppMessage id=${waMsg.id}`);
        } catch (err) {
          console.error(`[metaWebhookLogger] DB save error: ${err?.message}`);
        }
      }
    }
  }

  return new Response('OK', { status: 200 });
});