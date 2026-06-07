import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function stripPlus(raw) {
  if (!raw) return '';
  return String(raw).replace(/^\+/, '').trim();
}

async function findContact(serviceRole, digitsPhone) {
  // Match landlord
  const landlords = await serviceRole.entities.Landlord.list('-created_date', 2000);
  for (const l of landlords) {
    if (stripPlus(l.phone) === digitsPhone) return { type: 'landlord', record: l };
    if (stripPlus(l.whatsapp) === digitsPhone) return { type: 'landlord', record: l };
    const extras = Array.isArray(l.additional_phones) ? l.additional_phones : [];
    if (extras.some(e => stripPlus(e) === digitsPhone)) return { type: 'landlord', record: l };
  }
  // Match lead
  const leads = await serviceRole.entities.Lead.list('-created_date', 2000);
  for (const l of leads) {
    if (stripPlus(l.phone) === digitsPhone) return { type: 'lead', record: l };
    if (stripPlus(l.whatsapp) === digitsPhone) return { type: 'lead', record: l };
  }
  return null;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // ── GET: webhook verification ─────────────────────────────────────────────
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = (url.searchParams.get('hub.verify_token') || '').trim();
    const challenge = url.searchParams.get('hub.challenge');
    // Accept either of the two stored verify tokens (trimmed)
    const expectedToken = (Deno.env.get('META_VERIFY_TOKEN') || '').trim();
    const fallbackToken = (Deno.env.get('WHATSAPP_VERIFY_TOKEN') || '').trim();

    console.log(`[metaWhatsAppWebhook] GET verify: mode=${mode} token="${token}" expected="${expectedToken}"`);

    if (mode === 'subscribe' && (token === expectedToken || (fallbackToken && token === fallbackToken)) && challenge) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // ── POST: incoming events ─────────────────────────────────────────────────
  // Always respond 200 quickly so Meta doesn't disable the webhook
  const base44 = createClientFromRequest(req);
  const serviceRole = base44.asServiceRole;

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('OK', { status: 200 });
  }

  // Process in background — don't block the 200 response
  (async () => {
    try {
      const entries = body?.entry || [];
      for (const entry of entries) {
        const changes = entry?.changes || [];
        for (const change of changes) {
          const value = change?.value || {};

          // Handle status updates — just log, don't crash
          const statuses = value?.statuses || [];
          for (const s of statuses) {
            console.log(`[metaWhatsAppWebhook] status update: msgId=${s.id} status=${s.status} recipient=${s.recipient_id}`);
          }

          // Handle incoming messages
          const messages = value?.messages || [];
          for (const msg of messages) {
            const waId = msg.from || '';
            const digitsPhone = waId.replace(/^\+/, '').trim();
            if (!digitsPhone) continue;

            const msgType = msg.type || 'unknown';
            const text =
              msg.text?.body ||
              msg.image?.caption ||
              msg.video?.caption ||
              msg.document?.caption ||
              (msg.audio ? '🎤 Voice message' : null) ||
              `[${msgType}]`;

            const rawTs = msg.timestamp;
            const receivedAt = rawTs
              ? new Date(parseInt(rawTs) * 1000).toISOString()
              : new Date().toISOString();

            console.log(`[metaWhatsAppWebhook] from=${digitsPhone} type=${msgType} text="${text.slice(0, 80)}"`);

            // Contact matching
            const match = await findContact(serviceRole, digitsPhone);

            await serviceRole.entities.ApiInboxMessage.create({
              sender_phone: digitsPhone,
              message_text: text,
              message_type: msgType,
              received_at: receivedAt,
              instance_name: 'meta_direct',
              raw_payload: body,
              status: 'new',
              linked_landlord_id: match?.type === 'landlord' ? match.record.id : null,
              linked_landlord_name: match?.type === 'landlord' ? (match.record.full_name_en || match.record.full_name) : null,
              linked_lead_id: match?.type === 'lead' ? match.record.id : null,
              linked_lead_name: match?.type === 'lead' ? match.record.full_name : null,
            });
          }
        }
      }
    } catch (err) {
      console.error('[metaWhatsAppWebhook] processing error:', err.message);
    }
  })();

  return new Response('OK', { status: 200 });
});