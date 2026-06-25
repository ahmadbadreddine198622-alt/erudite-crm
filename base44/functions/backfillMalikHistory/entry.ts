import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Backfills WhatsApp conversation history for the Malik Evolution instance.
 * Uses /chat/findChats to get all chats, then /chat/findMessages for each chat.
 */

const MALIK_INSTANCE = 'Malik';
const MALIK_NUMBER = '+971529871277';
const MALIK_CHANNEL = 'malik';

function toE164(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits || digits.length < 7) return null;
  return '+' + digits;
}

function getPhoneFromJid(jid, altJid) {
  // Prefer @s.whatsapp.net JID (real phone), fallback to altJid
  if (jid && jid.includes('@s.whatsapp.net')) return toE164(jid.split('@')[0]);
  if (altJid && altJid.includes('@s.whatsapp.net')) return toE164(altJid.split('@')[0]);
  // @lid JIDs are internal IDs, not phone numbers — skip them
  return null;
}

function tsToIso(ts) {
  if (!ts) return new Date().toISOString();
  const n = typeof ts === 'string' ? parseInt(ts, 10) : Number(ts);
  if (isNaN(n) || n <= 0) return new Date().toISOString();
  const ms = n > 1e10 ? n : n * 1000;
  return new Date(ms).toISOString();
}

function parseBody(msg) {
  if (!msg) return { text: null, mediaType: 'none' };
  const m = msg.message || msg;
  if (!m) return { text: null, mediaType: 'none' };
  if (m.conversation) return { text: m.conversation, mediaType: 'none' };
  if (m.extendedTextMessage?.text) return { text: m.extendedTextMessage.text, mediaType: 'none' };
  if (m.imageMessage) return { text: m.imageMessage.caption || null, mediaType: 'image' };
  if (m.videoMessage) return { text: m.videoMessage.caption || null, mediaType: 'video' };
  if (m.audioMessage) return { text: null, mediaType: 'audio' };
  if (m.documentMessage) return { text: m.documentMessage.title || null, mediaType: 'document' };
  if (m.stickerMessage) return { text: null, mediaType: 'sticker' };
  if (m.locationMessage) return { text: null, mediaType: 'location' };
  if (m.reactionMessage) return { text: m.reactionMessage.text || null, mediaType: 'reaction' };
  if (m.protocolMessage) return { text: null, mediaType: 'protocol' };
  if (m.ephemeralMessage) return parseBody(m.ephemeralMessage.message);
  return { text: null, mediaType: 'unknown' };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    if (!apiUrl || !apiKey) return Response.json({ error: 'EVOLUTION_API_URL or EVOLUTION_API_KEY missing' }, { status: 500 });

    const svc = base44.asServiceRole;
    let body = {};
    try { body = await req.json(); } catch {}

    const maxChats = body.max_chats || 100;
    const messagesPerChat = body.messages_per_chat || 200;
    const stats = { chats_found: 0, chats_processed: 0, messages_imported: 0, messages_skipped: 0, errors: [] };

    // Step 1: Get all chats from Malik instance
    const chatsRes = await fetch(`${apiUrl}/chat/findChats/${MALIK_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({}),
    });

    if (!chatsRes.ok) {
      const errText = await chatsRes.text();
      return Response.json({ error: `findChats failed: ${chatsRes.status} ${errText.slice(0,200)}` }, { status: 502 });
    }

    let chats = [];
    try { chats = await chatsRes.json(); } catch {}
    if (!Array.isArray(chats)) return Response.json({ error: 'findChats did not return array', chats }, { status: 502 });

    stats.chats_found = chats.length;

    // Filter to only real phone JIDs (not @lid, not groups)
    const validChats = chats.filter(c => {
      const jid = c.remoteJid || '';
      if (!jid) return false;
      if (jid.includes('@g.us') || jid.includes('@broadcast')) return false;
      // Only use @s.whatsapp.net JIDs — @lid are internal IDs without phone numbers
      return jid.includes('@s.whatsapp.net');
    }).slice(0, maxChats);

    stats.valid_chats = validChats.length;

    // Step 2: For each chat, fetch messages and upsert
    for (const chat of validChats) {
      const remoteJid = chat.remoteJid;
      const contactPhone = toE164(remoteJid.split('@')[0]);
      if (!contactPhone) continue;

      // Skip our own number
      if (contactPhone === MALIK_NUMBER) continue;

      try {
        // Fetch messages using findMessages endpoint
        const msgsRes = await fetch(`${apiUrl}/chat/findMessages/${MALIK_INSTANCE}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: apiKey },
          body: JSON.stringify({
            where: { key: { remoteJid } },
            page: { limit: messagesPerChat, offset: 0 },
          }),
        });

        if (!msgsRes.ok) {
          stats.errors.push(`findMessages failed for ${contactPhone}: ${msgsRes.status}`);
          continue;
        }

        let msgsData = null;
        try { msgsData = await msgsRes.json(); } catch { continue; }

        // API may return { messages: [...] } or directly an array
        const messages = Array.isArray(msgsData) ? msgsData
          : Array.isArray(msgsData?.messages) ? msgsData.messages
          : Array.isArray(msgsData?.records) ? msgsData.records
          : [];

        if (messages.length === 0) continue;

        // Find or create conversation for this contact+channel
        let conv = null;
        const existingConvs = await svc.entities.WhatsAppConversation.filter({ wa_phone_e164: contactPhone, channel: MALIK_CHANNEL });
        conv = existingConvs?.[0] || null;

        if (!conv) {
          // Sort to get timestamps
          const sorted = [...messages].sort((a, b) => (a.messageTimestamp || 0) - (b.messageTimestamp || 0));
          const firstTs = tsToIso(sorted[0]?.messageTimestamp);
          const lastTs = tsToIso(sorted[sorted.length - 1]?.messageTimestamp);
          const { text: lastText } = parseBody(sorted[sorted.length - 1]);

          conv = await svc.entities.WhatsAppConversation.create({
            wa_phone_e164: contactPhone,
            phone_number: contactPhone,
            wa_display_name: chat.pushName || chat.name || '',
            status: 'open',
            channel: MALIK_CHANNEL,
            first_message_at: firstTs,
            last_message_at: lastTs,
            last_message: lastText,
            unread_count: 0,
          });
        }

        // Step 3: Import each message
        for (const rawMsg of messages) {
          const key = rawMsg.key || {};
          const waId = key.id || rawMsg.id;
          if (!waId) continue;

          const { text, mediaType } = parseBody(rawMsg);
          if (mediaType === 'reaction' || mediaType === 'protocol') continue;

          // Dedupe check
          const existing = await svc.entities.WhatsAppMessage.filter({ wa_message_id: waId });
          if (existing?.length > 0) {
            stats.messages_skipped++;
            continue;
          }

          const fromMe = key.fromMe === true;
          const timestamp = tsToIso(rawMsg.messageTimestamp);

          await svc.entities.WhatsAppMessage.create({
            conversation_id: conv.id,
            wa_message_id: waId,
            direction: fromMe ? 'outbound' : 'inbound',
            body: text,
            status: fromMe ? 'sent' : 'delivered',
            timestamp,
            from_number: fromMe ? MALIK_NUMBER : contactPhone,
            to_number: fromMe ? contactPhone : MALIK_NUMBER,
            channel: MALIK_CHANNEL,
            media_type: mediaType === 'none' ? 'none' : mediaType,
          });

          stats.messages_imported++;
        }

        // Update conversation last message
        const latestMsg = messages.reduce((latest, m) => {
          return (m.messageTimestamp || 0) > (latest?.messageTimestamp || 0) ? m : latest;
        }, null);
        if (latestMsg) {
          const { text: lastText } = parseBody(latestMsg);
          await svc.entities.WhatsAppConversation.update(conv.id, {
            last_message: lastText,
            last_message_at: tsToIso(latestMsg.messageTimestamp),
          });
        }

        stats.chats_processed++;
      } catch (err) {
        stats.errors.push(`Error for ${contactPhone}: ${err.message}`);
      }
    }

    return Response.json({ status: 'ok', stats });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});