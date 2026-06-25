import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Backfills Malik WhatsApp conversations from Evolution findChats.
 * Uses bulkCreate for speed — processes up to 20 chats per run.
 * Run multiple times with offset to process all 263 new conversations.
 */

const MALIK_OWN_NUMBER = '971529871277';
const MALIK_EMAIL = 'malik@erudite-estate.com';

function toDigits(raw) {
  return String(raw || '').replace(/\D/g, '');
}

function extractPhone(remoteJid) {
  if (!remoteJid) return null;
  if (remoteJid.includes('@lid')) return null;
  const digits = remoteJid.split('@')[0];
  if (!digits || digits.length < 7 || digits.includes('-')) return null;
  return digits;
}

function extractText(msg) {
  if (!msg) return null;
  const m = msg.message || msg;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    null
  );
}

function mediaType(t) {
  if (!t) return 'none';
  if (t.includes('image')) return 'image';
  if (t.includes('video')) return 'video';
  if (t.includes('audio') || t.includes('voice')) return 'audio';
  if (t.includes('document')) return 'document';
  return 'none';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const limit = Math.min(body.limit || 20, 20); // max 20 per run
    const offset = body.offset || 0;

    const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    const instance = 'Malik';
    const svc = base44.asServiceRole;

    // 1. Fetch chats from Evolution
    const chatsResp = await fetch(`${apiUrl}/chat/findChats/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ page: { limit: 846, offset: 0 } }),
    });
    if (!chatsResp.ok) {
      return Response.json({ error: `findChats HTTP ${chatsResp.status}` }, { status: 502 });
    }
    const chatsData = await chatsResp.json();
    const allChats = Array.isArray(chatsData) ? chatsData : (chatsData.chats || []);

    // 2. Filter to phone-resolvable, non-self chats
    const validChats = allChats.filter(c => {
      const jid = c.remoteJid || c.id;
      const phone = extractPhone(jid);
      return phone && phone !== MALIK_OWN_NUMBER;
    });

    // 3. Load existing malik conversations into memory
    const existingConvs = await svc.entities.WhatsAppConversation.filter({ channel: 'malik' });
    const existingPhones = new Set((existingConvs || []).map(c => toDigits(c.wa_phone_e164 || c.phone_number)));

    // 4. Only process chats that don't have a conversation yet
    const newChats = validChats.filter(c => {
      const phone = extractPhone(c.remoteJid || c.id);
      return !existingPhones.has(phone);
    });

    // 5. Apply pagination
    const batch = newChats.slice(offset, offset + limit);

    if (dryRun) {
      return Response.json({
        status: 'ok',
        dry_run: true,
        total_valid: validChats.length,
        total_new: newChats.length,
        batch_size: batch.length,
        offset,
        limit,
        remaining: Math.max(0, newChats.length - offset - batch.length),
        sample: batch.slice(0, 3).map(c => ({ jid: c.remoteJid, name: c.pushName })),
      });
    }

    // 6. Load landlords for matching
    const landlords = await svc.entities.Landlord.list('-created_date', 500);
    const landlordByPhone = {};
    for (const ll of (landlords || [])) {
      if (ll.phone) landlordByPhone[toDigits(ll.phone)] = ll;
    }

    // 7. Build conversation records for bulk create
    const convsToCreate = batch.map(chat => {
      const jid = chat.remoteJid || chat.id;
      const phone = extractPhone(jid);
      const e164 = '+' + phone;
      const landlord = landlordByPhone[phone] || null;
      const displayName = chat.pushName || chat.name || landlord?.full_name || null;
      const lastMsgText = extractText(chat.lastMessage);
      const lastMsgAt = chat.updatedAt ||
        (chat.lastMessage?.messageTimestamp
          ? new Date(chat.lastMessage.messageTimestamp * 1000).toISOString()
          : new Date().toISOString());
      return {
        wa_phone_e164: e164,
        phone_number: e164,
        channel: 'malik',
        status: 'open',
        assigned_agent_email: MALIK_EMAIL,
        landlord_id: landlord?.id || null,
        wa_display_name: displayName,
        wa_saved_name: displayName,
        last_message: lastMsgText,
        last_message_at: lastMsgAt,
        first_message_at: lastMsgAt,
        unread_count: 0,
        _phone: phone, // temp for message linking
        _chat: chat,   // temp for message linking
      };
    });

    // 8. Bulk create conversations
    const createdConvs = await svc.entities.WhatsAppConversation.bulkCreate(
      convsToCreate.map(({ _phone, _chat, ...c }) => c)
    );

    // 9. Build message records for bulk create
    const msgsToCreate = [];
    for (let i = 0; i < convsToCreate.length; i++) {
      const chat = convsToCreate[i]._chat;
      const conv = createdConvs[i];
      if (!conv?.id) continue;

      const lastMsg = chat.lastMessage;
      const waId = lastMsg?.key?.id;
      if (!waId) continue;

      const direction = lastMsg.key?.fromMe ? 'outbound' : 'inbound';
      const phone = convsToCreate[i]._phone;
      const e164 = '+' + phone;
      const ts = lastMsg.messageTimestamp
        ? new Date(lastMsg.messageTimestamp * 1000).toISOString()
        : new Date().toISOString();

      msgsToCreate.push({
        conversation_id: conv.id,
        direction,
        body: extractText(lastMsg) || '',
        timestamp: ts,
        status: direction === 'outbound' ? 'sent' : 'received',
        wa_message_id: waId,
        from_number: direction === 'inbound' ? e164 : '+' + MALIK_OWN_NUMBER,
        to_number: direction === 'inbound' ? '+' + MALIK_OWN_NUMBER : e164,
        channel: 'malik',
        media_type: mediaType(lastMsg.messageType),
        assigned_agent_email: MALIK_EMAIL,
        landlord_id: conv.landlord_id || null,
      });
    }

    let msgCreated = 0;
    if (msgsToCreate.length > 0) {
      await svc.entities.WhatsAppMessage.bulkCreate(msgsToCreate);
      msgCreated = msgsToCreate.length;
    }

    return Response.json({
      status: 'ok',
      total_new: newChats.length,
      batch_processed: batch.length,
      conv_created: createdConvs.length,
      msg_created: msgCreated,
      offset,
      next_offset: offset + batch.length,
      remaining: Math.max(0, newChats.length - offset - batch.length),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});