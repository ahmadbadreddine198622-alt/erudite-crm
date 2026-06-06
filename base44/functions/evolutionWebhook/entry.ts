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
  const text =
    msgObj.conversation ||
    msgObj.extendedTextMessage?.text ||
    msgObj.imageMessage?.caption ||
    msgObj.videoMessage?.caption ||
    msgObj.documentMessage?.caption ||
    (msgObj.audioMessage ? '🎤 Voice message' : null) ||
    '[media]';

  console.log(`[evolutionWebhook] from=${digitsPhone} msgId=${waMessageId} text="${text.slice(0, 80)}"`);

  // Deduplicate by wa_message_id
  if (waMessageId) {
    const existing = await serviceRole.entities.Message.filter({ wa_message_id: waMessageId });
    if (existing?.length > 0) {
      return Response.json({ status: 'duplicate', wa_message_id: waMessageId });
    }
  }

  // Match landlord across all three phone fields
  const landlord = await findLandlordByPhone(serviceRole, digitsPhone);

  if (!landlord) {
    console.log(`[evolutionWebhook] No landlord matched for phone ${digitsPhone}`);
    return Response.json({ status: 'no_landlord_match', phone: digitsPhone });
  }

  console.log(`[evolutionWebhook] Matched landlord ${landlord.id} (${landlord.full_name_en})`);

  // Create Message record
  const message = await serviceRole.entities.Message.create({
    landlord_id: landlord.id,
    phone: digitsPhone,
    direction: 'incoming',
    text,
    timestamp,
    status: 'received',
    wa_message_id: waMessageId || null,
  });

  console.log(`[evolutionWebhook] Created Message ${message.id} for landlord ${landlord.id}`);

  return Response.json({
    status: 'ok',
    message_id: message.id,
    landlord_id: landlord.id,
    landlord_name: landlord.full_name_en,
  });
});