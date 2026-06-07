import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function stripPlus(raw) {
  if (!raw) return '';
  return String(raw).replace(/^\+/, '').trim();
}

async function findContact(serviceRole, digitsPhone) {
  const landlords = await serviceRole.entities.Landlord.list('-created_date', 2000);
  for (const l of landlords) {
    if (stripPlus(l.phone) === digitsPhone) return { type: 'landlord', record: l };
    if (stripPlus(l.whatsapp) === digitsPhone) return { type: 'landlord', record: l };
    const extras = Array.isArray(l.additional_phones) ? l.additional_phones : [];
    if (extras.some(e => stripPlus(e) === digitsPhone)) return { type: 'landlord', record: l };
  }
  const leads = await serviceRole.entities.Lead.list('-created_date', 2000);
  for (const l of leads) {
    if (stripPlus(l.phone) === digitsPhone) return { type: 'lead', record: l };
    if (stripPlus(l.whatsapp) === digitsPhone) return { type: 'lead', record: l };
  }
  return null;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // ── Auth: secret query param (same mechanism as evolutionWebhook) ──────────
  const secret = (url.searchParams.get('secret') || '').trim();
  const expectedSecret = (Deno.env.get('META_WEBHOOK_SECRET') || '').trim();

  if (!expectedSecret || secret !== expectedSecret) {
    console.log(`[metaWhatsAppWebhook] Unauthorized: secret="${secret}" expected="${expectedSecret}"`);
    return new Response('Unauthorized', { status: 401 });
  }

  // ── GET: Meta webhook verification handshake ───────────────────────────────
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const verifyToken = (url.searchParams.get('hub.verify_token') || '').trim();
    const challenge = url.searchParams.get('hub.challenge');
    const expectedVerifyToken = (Deno.env.get('META_VERIFY_TOKEN') || '').trim();

    const expLen = expectedVerifyToken.length;
    const expEdge = `${expectedVerifyToken.slice(0,2)}..${expectedVerifyToken.slice(-2)}`;
    const expCodes = `first=${expectedVerifyToken.charCodeAt(0)} last=${expectedVerifyToken.charCodeAt(expLen-1)}`;
    const incLen = verifyToken.length;
    const incEdge = `${verifyToken.slice(0,2)}..${verifyToken.slice(-2)}`;
    const incCodes = `first=${verifyToken.charCodeAt(0)} last=${verifyToken.charCodeAt(incLen-1)}`;
    console.log(`[metaWhatsAppWebhook] GET verify: mode=${mode} verify_token="${verifyToken}" challenge="${challenge}"`);
    console.log(`[DEBUG-expected] len=${expLen} edge="${expEdge}" codes=${expCodes}`);
    console.log(`[DEBUG-incoming] len=${incLen} edge="${incEdge}" codes=${incCodes}`);
    console.log(`[DEBUG-match] ${verifyToken === expectedVerifyToken}`);

    if (mode === 'subscribe' && verifyToken === expectedVerifyToken && challenge) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // ── POST: incoming message events ──────────────────────────────────────────
  // Always respond 200 immediately so Meta doesn't disable the webhook
  const base44 = createClientFromRequest(req);
  const serviceRole = base44.asServiceRole;

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('OK', { status: 200 });
  }

  // Process in background
  (async () => {
    try {
      const entries = body?.entry || [];
      for (const entry of entries) {
        const changes = entry?.changes || [];
        for (const change of changes) {
          const value = change?.value || {};

          // Status updates — log only
          for (const s of (value?.statuses || [])) {
            console.log(`[metaWhatsAppWebhook] status: msgId=${s.id} status=${s.status}`);
          }

          // Incoming messages
          for (const msg of (value?.messages || [])) {
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

            const receivedAt = msg.timestamp
              ? new Date(parseInt(msg.timestamp) * 1000).toISOString()
              : new Date().toISOString();

            console.log(`[metaWhatsAppWebhook] from=${digitsPhone} type=${msgType} text="${text.slice(0, 80)}"`);

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