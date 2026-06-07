import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Evolution API (VPS) webhook receiver.
 *
 * POST body from Evolution:
 * {
 *   event: "messages.upsert",
 *   instance: "...",
 *   data: {
 *     key: { remoteJid: "971544661177@s.whatsapp.net", fromMe: false, id: "ABCD..." },
 *     message: { conversation: "Hello" },
 *     messageTimestamp: 1717600000,
 *     pushName: "John"
 *   }
 * }
 *
 * Matching rule:
 *   remoteJid  →  strip "@s.whatsapp.net"  →  digits-only phone (e.g. "971544661177")
 *   Landlord.phone     "+971544661177" →  strip "+"  → "971544661177"  ✓
 *   Landlord.whatsapp  "+971544661177" →  strip "+"  → "971544661177"  ✓
 *   Landlord.additional_phones[]       →  strip "+"  → check each     ✓
 */

function stripPlus(raw) {
  if (!raw) return '';
  return String(raw).replace(/^\+/, '').trim();
}

function jidToDigits(jid) {
  if (!jid) return '';
  // "971544661177@s.whatsapp.net"  →  "971544661177"
  // "971544661177@g.us" (groups) → also handled, though we skip groups below
  return jid.split('@')[0];
}

async function findLandlordByPhone(serviceRole, digitsPhone) {
  // 1. Match on primary phone field (strip + from stored E.164)
  const all = await serviceRole.entities.Landlord.list('-created_date', 2000);
  for (const landlord of all) {
    const primary = stripPlus(landlord.phone);
    if (primary && primary === digitsPhone) return landlord;

    const wa = stripPlus(landlord.whatsapp);
    if (wa && wa === digitsPhone) return landlord;

    const extras = Array.isArray(landlord.additional_phones) ? landlord.additional_phones : [];
    for (const extra of extras) {
      if (stripPlus(extra) === digitsPhone) return landlord;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  // Evolution sends a shared secret as a query param or header — verify it
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret') || req.headers.get('x-evolution-secret') || '';
  const expectedSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET') || '';
  if (!expectedSecret || secret !== expectedSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (req.method !== 'POST') {
    return new Response('OK', { status: 200 });
  }

  const body = await req.json();
  const base44 = createClientFromRequest(req);
  const serviceRole = base44.asServiceRole;

  const event = body?.event;

  // Only handle incoming text/media messages
  if (event !== 'messages.upsert') {
    return Response.json({ status: 'ignored', event });
  }

  const data = body?.data;
  if (!data) return Response.json({ status: 'no_data' });

  const key = data.key || {};
  const remoteJid = key.remoteJid || '';
  const fromMe = key.fromMe === true;
  const waMessageId = key.id || '';

  // Skip group messages and outgoing messages
  if (remoteJid.includes('@g.us')) return Response.json({ status: 'skipped_group' });
  if (fromMe) return Response.json({ status: 'skipped_outgoing' });

  const digitsPhone = jidToDigits(remoteJid);
  if (!digitsPhone) return Response.json({ status: 'no_phone' });

  const rawTimestamp = data.messageTimestamp;
  const timestamp = rawTimestamp
    ? new Date(typeof rawTimestamp === 'number' ? rawTimestamp * 1000 : rawTimestamp).toISOString()
    : new Date().toISOString();

  // Extract message text from various Evolution message types
  const msgObj = data.message || {};
  const msgType = Object.keys(msgObj)[0] || 'unknown';
  const text =
    msgObj.conversation ||
    msgObj.extendedTextMessage?.text ||
    msgObj.imageMessage?.caption ||
    msgObj.videoMessage?.caption ||
    msgObj.documentMessage?.caption ||
    (msgObj.audioMessage ? '🎤 Voice message' : null) ||
    '[media]';

  const instanceName = (body?.instance || '').toLowerCase();

  console.log(`[evolutionWebhook] instance=${instanceName} from=${digitsPhone} msgId=${waMessageId} text="${text.slice(0, 80)}"`);

  // ── API channel: erudite instance (+971582806000) ────────────────────────
  // Save to ApiInboxMessage and stop — do NOT touch Message or landlord chat.
  if (instanceName === 'erudite') {
    // Try to match landlord
    const landlordMatch = await findLandlordByPhone(serviceRole, digitsPhone);

    // Try to match lead
    let leadMatch = null;
    if (!landlordMatch) {
      const allLeads = await serviceRole.entities.Lead.list('-created_date', 2000);
      for (const lead of allLeads) {
        const lp = stripPlus(lead.phone);
        const lw = stripPlus(lead.whatsapp);
        if ((lp && lp === digitsPhone) || (lw && lw === digitsPhone)) {
          leadMatch = lead;
          break;
        }
      }
    }

    await serviceRole.entities.ApiInboxMessage.create({
      sender_phone: digitsPhone,
      message_text: text,
      message_type: msgType,
      received_at: timestamp,
      instance_name: instanceName,
      raw_payload: body,
      status: 'new',
      linked_landlord_id: landlordMatch ? landlordMatch.id : null,
      linked_landlord_name: landlordMatch ? (landlordMatch.full_name_en || landlordMatch.full_name) : null,
      linked_lead_id: leadMatch ? leadMatch.id : null,
      linked_lead_name: leadMatch ? leadMatch.full_name : null,
    });

    return Response.json({
      status: 'api_inbox_saved',
      matched_landlord: !!landlordMatch,
      matched_lead: !!leadMatch,
    });
  }

  // ── Personal channel: erudite_whatsapp instance ──────────────────────────
  // Deduplicate by wa_message_id
  if (waMessageId) {
    const existing = await serviceRole.entities.Message.filter({ wa_message_id: waMessageId });
    if (existing?.length > 0) {
      return Response.json({ status: 'duplicate', wa_message_id: waMessageId });
    }
  }

  // Match landlord across all three phone fields
  const landlord = await findLandlordByPhone(serviceRole, digitsPhone);

  // No-match is no longer a drop: we still record the message with landlord_id=null
  // so it shows in the global inbox as "Unmatched". Matching logic above is unchanged.
  if (landlord) {
    console.log(`[evolutionWebhook] Matched landlord ${landlord.id} (${landlord.full_name_en})`);
  } else {
    console.log(`[evolutionWebhook] No landlord matched for phone ${digitsPhone} — recording as Unmatched`);
  }

  // Create a Message record for EVERY incoming message (matched or not).
  const message = await serviceRole.entities.Message.create({
    landlord_id: landlord ? landlord.id : null,
    phone: digitsPhone,
    direction: 'incoming',
    text,
    timestamp,
    status: 'received',
    wa_message_id: waMessageId || null,
  });

  console.log(`[evolutionWebhook] Created Message ${message.id} (landlord ${landlord ? landlord.id : 'none'})`);

  // Fire-and-forget AI analysis trigger (matched landlords only). NOT awaited:
  // message save already succeeded above; analysis runs separately and is
  // debounced inside analyzeLandlordConversation. Never blocks/fails the webhook.
  if (landlord) {
    serviceRole.functions.invoke('analyzeLandlordConversation', { landlord_id: landlord.id }).catch(() => {});
  }

  return Response.json({
    status: 'ok',
    matched: !!landlord,
    message_id: message.id,
    landlord_id: landlord ? landlord.id : null,
    landlord_name: landlord ? landlord.full_name_en : null,
  });
});