import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Backfills Sameie (Samy instance) WhatsApp conversations.
 * 
 * The Samy instance stores contacts as @lid (Linked ID) — WhatsApp's privacy JID.
 * We resolve phone numbers via key.remoteJidAlt in findMessages responses.
 * 
 * Run with offset=0,10,20... until remaining===0.
 */

const SAMEIE_OWN_NUMBER = '971522869064';
const SAMEIE_EMAIL = 'sameie@erudite-estate.com';
const INSTANCE = 'Samy';

function toDigits(raw) {
  return String(raw || '').replace(/\D/g, '');
}

function extractPhoneFromJid(jid) {
  if (!jid) return null;
  if (jid.includes('@lid') || jid.includes('-')) return null;
  const digits = jid.split('@')[0];
  if (!digits || digits.length < 7) return null;
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

function mediaTypeFromMsg(msg) {
  if (!msg) return 'none';
  const t = msg.messageType || '';
  if (t.includes('image')) return 'image';
  if (t.includes('video')) return 'video';
  if (t.includes('audio') || t.includes('voice')) return 'audio';
  if (t.includes('document')) return 'document';
  return 'none';
}

/**
 * Resolve phone from @lid chat via findMessages — uses key.remoteJidAlt.
 */
async function resolvePhoneFromLid(apiUrl, apiKey, lidJid) {
  try {
    const resp = await fetch(`${apiUrl}/chat/findMessages/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ where: { key: { remoteJid: lidJid } }, limit: 5 }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const records = data?.messages?.records || data?.records || [];
    for (const msg of records) {
      // Primary: remoteJidAlt has the real phone JID
      const alt = msg.key?.remoteJidAlt;
      if (alt) {
        const phone = extractPhoneFromJid(alt);
        if (phone && phone !== SAMEIE_OWN_NUMBER) return { phone, pushName: msg.pushName || null };
      }
      // Fallback: participant
      const participant = msg.key?.participant;
      if (participant) {
        const phone = extractPhoneFromJid(participant);
        if (phone && phone !== SAMEIE_OWN_NUMBER) return { phone, pushName: msg.pushName || null };
      }
    }
    return null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const limit = Math.min(body.limit || 10, 10);
    const offset = body.offset || 0;

    const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    const svc = base44.asServiceRole;

    // 1. Fetch all chats from Samy
    const chatsResp = await fetch(`${apiUrl}/chat/findChats/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ page: { limit: 1000, offset: 0 } }),
    });
    if (!chatsResp.ok) {
      return Response.json({ error: `findChats HTTP ${chatsResp.status}` }, { status: 502 });
    }
    const chatsData = await chatsResp.json();
    const allChats = Array.isArray(chatsData) ? chatsData : (chatsData.chats || []);

    // 2. Load existing sameie conversations (phones already stored)
    const existingConvs = await svc.entities.WhatsAppConversation.filter({ channel: 'sameie' });
    const existingPhones = new Set((existingConvs || []).map(c => toDigits(c.wa_phone_e164 || c.phone_number || '')));

    // 3. Separate @lid from direct-phone chats
    const lidChats = allChats.filter(c => (c.remoteJid || c.id || '').includes('@lid'));
    const directChats = allChats.filter(c => {
      const jid = c.remoteJid || c.id || '';
      if (jid.includes('@lid') || jid.includes('-')) return false;
      const phone = extractPhoneFromJid(jid);
      return phone && phone !== SAMEIE_OWN_NUMBER && !existingPhones.has(phone);
    });

    // For @lid chats we don't know if they're already imported until we resolve phone.
    // We track by lid JID — if a conversation with that exact phone already exists, skip.
    // Process all lid chats each run (resolution is fast, only ~51 chats).
    const totalCandidates = lidChats.length + directChats.length;
    const allCandidates = [...directChats, ...lidChats];
    const batch = allCandidates.slice(offset, offset + limit);

    if (dryRun) {
      return Response.json({
        status: 'ok',
        dry_run: true,
        total_fetched: allChats.length,
        already_imported: existingPhones.size,
        direct_phone_new: directChats.length,
        lid_chats_total: lidChats.length,
        total_candidates: totalCandidates,
        batch_size: batch.length,
        offset,
        limit,
        remaining: Math.max(0, totalCandidates - offset - batch.length),
      });
    }

    // 4. Load landlords + leads for matching
    const [landlords, leads] = await Promise.all([
      svc.entities.Landlord.list('-created_date', 500),
      svc.entities.Lead.list('-created_date', 500),
    ]);
    const landlordByPhone = {};
    for (const ll of (landlords || [])) {
      if (ll.phone) landlordByPhone[toDigits(ll.phone)] = ll;
    }
    const leadByPhone = {};
    for (const l of (leads || [])) {
      if (l.phone) leadByPhone[toDigits(l.phone)] = l;
      if (l.whatsapp) leadByPhone[toDigits(l.whatsapp)] = l;
    }

    // 5. Process batch
    const msgsToCreate = [];
    let convCreated = 0;
    let skipped = 0;

    for (const chat of batch) {
      const jid = chat.remoteJid || chat.id || '';
      const isLid = jid.includes('@lid');

      let phone = null;
      let pushName = chat.pushName || chat.name || null;

      if (isLid) {
        const resolved = await resolvePhoneFromLid(apiUrl, apiKey, jid);
        if (!resolved) { skipped++; continue; }
        phone = resolved.phone;
        pushName = pushName || resolved.pushName;
        if (existingPhones.has(phone)) { skipped++; continue; }
      } else {
        phone = extractPhoneFromJid(jid);
        if (!phone || phone === SAMEIE_OWN_NUMBER) { skipped++; continue; }
      }

      const e164 = '+' + phone;
      const landlord = landlordByPhone[phone] || null;
      const lead = leadByPhone[phone] || null;
      const displayName = pushName || landlord?.full_name || lead?.full_name || null;

      const lastMsgText = extractText(chat.lastMessage);
      const lastMsgAt = chat.updatedAt ||
        (chat.lastMessage?.messageTimestamp
          ? new Date(chat.lastMessage.messageTimestamp * 1000).toISOString()
          : new Date().toISOString());

      const conv = await svc.entities.WhatsAppConversation.create({
        wa_phone_e164: e164,
        phone_number: e164,
        channel: 'sameie',
        status: 'open',
        assigned_agent_email: SAMEIE_EMAIL,
        landlord_id: landlord?.id || null,
        lead_id: lead?.id || null,
        wa_display_name: displayName,
        wa_saved_name: displayName,
        last_message: lastMsgText,
        last_message_at: lastMsgAt,
        first_message_at: lastMsgAt,
        unread_count: 0,
      });

      // Mark phone as imported to avoid same-batch duplicates (from resolved lids)
      existingPhones.add(phone);
      convCreated++;

      // Queue last message
      const lastMsg = chat.lastMessage;
      const waId = lastMsg?.key?.id;
      if (waId && conv?.id) {
        const direction = lastMsg.key?.fromMe ? 'outbound' : 'inbound';
        const ts = lastMsg.messageTimestamp
          ? new Date(lastMsg.messageTimestamp * 1000).toISOString()
          : lastMsgAt;
        msgsToCreate.push({
          conversation_id: conv.id,
          direction,
          body: extractText(lastMsg) || '',
          timestamp: ts,
          status: direction === 'outbound' ? 'sent' : 'received',
          wa_message_id: waId,
          from_number: direction === 'inbound' ? e164 : '+' + SAMEIE_OWN_NUMBER,
          to_number: direction === 'inbound' ? '+' + SAMEIE_OWN_NUMBER : e164,
          channel: 'sameie',
          media_type: mediaTypeFromMsg(lastMsg),
          assigned_agent_email: SAMEIE_EMAIL,
          landlord_id: conv.landlord_id || null,
          lead_id: conv.lead_id || null,
        });
      }

      if (isLid) await new Promise(r => setTimeout(r, 150));
    }

    let msgCreated = 0;
    if (msgsToCreate.length > 0) {
      await svc.entities.WhatsAppMessage.bulkCreate(msgsToCreate);
      msgCreated = msgsToCreate.length;
    }

    return Response.json({
      status: 'ok',
      total_candidates: totalCandidates,
      batch_processed: batch.length,
      conv_created: convCreated,
      msg_created: msgCreated,
      skipped,
      offset,
      next_offset: offset + batch.length,
      remaining: Math.max(0, totalCandidates - offset - batch.length),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});