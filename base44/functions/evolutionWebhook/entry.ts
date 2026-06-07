import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Evolution API (VPS) webhook receiver — PHASE 1: bulletproof ingestion.
 *
 * Handles ALL Evolution/Baileys event types (not just text):
 *   - messages.upsert  → text, image, video, audio/ptt, document, location,
 *                        contact (vCard), sticker, reply/quote, reaction, view-once
 *   - messages.update  → delivery status pipeline (sent/delivered/read/failed)
 *   - messages.delete / protocolMessage(REVOKE) → mark message deleted
 *
 * Two instances:
 *   - "erudite"          → business line (Meta Cloud API)  → ApiInboxMessage
 *   - "erudite_whatsapp" → personal line (Baileys)         → Message
 *
 * Resilience: secret-gated, idempotent (dedupe on wa_message_id), structured
 * logging per event with instance name, and a dead-letter record (WebhookDeadLetter)
 * for any payload that throws during parsing — never a silent drop.
 *
 * NOTE: media bytes are NOT downloaded inline (keeps the webhook fast and
 * retry-safe). The message is saved with media metadata + media_status='pending',
 * then processInboundMedia is fired async to download + persist + (for audio)
 * trigger transcription.
 */

// ── helpers ────────────────────────────────────────────────────────────────
function stripPlus(raw) {
  if (!raw) return '';
  return String(raw).replace(/^\+/, '').replace(/\s+/g, '').trim();
}

function jidToDigits(jid) {
  if (!jid) return '';
  return String(jid).split('@')[0].split(':')[0]; // strip @s.whatsapp.net and device suffix ":12"
}

function tsToIso(rawTimestamp) {
  if (!rawTimestamp) return new Date().toISOString();
  const n = typeof rawTimestamp === 'number' ? rawTimestamp : parseInt(rawTimestamp, 10);
  if (!isNaN(n)) return new Date(n * 1000).toISOString();
  return new Date(rawTimestamp).toISOString();
}

async function findLandlordByPhone(serviceRole, digitsPhone) {
  const all = await serviceRole.entities.Landlord.list('-created_date', 2000);
  for (const landlord of all) {
    if (stripPlus(landlord.phone) === digitsPhone) return landlord;
    if (stripPlus(landlord.whatsapp) === digitsPhone) return landlord;
    const extras = Array.isArray(landlord.additional_phones) ? landlord.additional_phones : [];
    for (const extra of extras) if (stripPlus(extra) === digitsPhone) return landlord;
  }
  return null;
}

async function findLeadByPhone(serviceRole, digitsPhone) {
  const all = await serviceRole.entities.Lead.list('-created_date', 2000);
  for (const lead of all) {
    if (stripPlus(lead.phone) === digitsPhone) return lead;
    if (stripPlus(lead.whatsapp) === digitsPhone) return lead;
  }
  return null;
}

/**
 * Parse a Baileys/Evolution `message` object into a normalized shape.
 * Unwraps ephemeral / view-once / edited wrappers first.
 */
function parseMessage(rawMsgObj) {
  let m = rawMsgObj || {};
  m = m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message
    || m.documentWithCaptionMessage?.message || m;

  const type = Object.keys(m)[0] || 'unknown';
  const out = {
    msgType: type,
    text: '',
    caption: '',
    media: null,            // { kind, mime, duration, fileName, isVoiceNote }
    reply_to_wa_id: '',
    reaction: null,         // { emoji, target_wa_id }
    deletion_target: '',    // wa_message_id being revoked
    location: null,         // { lat, lng, name }
    contacts: null,         // [{ name, vcard }]
  };

  const ctxOf = (x) => x?.contextInfo?.stanzaId || '';

  switch (type) {
    case 'conversation':
      out.text = m.conversation || '';
      break;
    case 'extendedTextMessage':
      out.text = m.extendedTextMessage?.text || '';
      out.reply_to_wa_id = ctxOf(m.extendedTextMessage);
      break;
    case 'imageMessage':
      out.caption = m.imageMessage?.caption || '';
      out.text = out.caption || '📷 Photo';
      out.reply_to_wa_id = ctxOf(m.imageMessage);
      out.media = { kind: 'image', mime: m.imageMessage?.mimetype || 'image/jpeg' };
      break;
    case 'videoMessage':
      out.caption = m.videoMessage?.caption || '';
      out.text = out.caption || '🎥 Video';
      out.reply_to_wa_id = ctxOf(m.videoMessage);
      out.media = { kind: 'video', mime: m.videoMessage?.mimetype || 'video/mp4', duration: m.videoMessage?.seconds || null };
      break;
    case 'audioMessage':
      out.media = {
        kind: 'audio',
        mime: m.audioMessage?.mimetype || 'audio/ogg',
        duration: m.audioMessage?.seconds || null,
        isVoiceNote: m.audioMessage?.ptt === true,
      };
      out.text = m.audioMessage?.ptt ? '🎤 Voice message' : '🎵 Audio';
      out.reply_to_wa_id = ctxOf(m.audioMessage);
      break;
    case 'documentMessage':
      out.caption = m.documentMessage?.caption || '';
      out.media = {
        kind: 'document',
        mime: m.documentMessage?.mimetype || 'application/octet-stream',
        fileName: m.documentMessage?.fileName || 'document',
      };
      out.text = out.caption || ('📄 ' + out.media.fileName);
      out.reply_to_wa_id = ctxOf(m.documentMessage);
      break;
    case 'stickerMessage':
      out.media = { kind: 'sticker', mime: m.stickerMessage?.mimetype || 'image/webp' };
      out.text = '🩷 Sticker';
      break;
    case 'locationMessage':
      out.location = {
        lat: m.locationMessage?.degreesLatitude,
        lng: m.locationMessage?.degreesLongitude,
        name: m.locationMessage?.name || m.locationMessage?.address || '',
      };
      out.text = `📍 Location${out.location.name ? ': ' + out.location.name : ''} (${out.location.lat}, ${out.location.lng})`;
      break;
    case 'contactMessage':
      out.contacts = [{ name: m.contactMessage?.displayName || '', vcard: m.contactMessage?.vcard || '' }];
      out.text = `👤 Contact: ${out.contacts[0].name}`;
      break;
    case 'contactsArrayMessage':
      out.contacts = (m.contactsArrayMessage?.contacts || []).map((c) => ({ name: c.displayName || '', vcard: c.vcard || '' }));
      out.text = `👤 ${out.contacts.length} contact(s)`;
      break;
    case 'reactionMessage':
      out.reaction = { emoji: m.reactionMessage?.text || '', target_wa_id: m.reactionMessage?.key?.id || '' };
      out.text = `Reacted ${out.reaction.emoji}`;
      break;
    case 'protocolMessage':
      if (m.protocolMessage?.type === 'REVOKE' || m.protocolMessage?.type === 0) {
        out.deletion_target = m.protocolMessage?.key?.id || '';
      }
      out.text = '';
      break;
    default:
      out.text = '[unsupported message type]';
  }
  return out;
}

// Baileys numeric/string status → our Message.status enum
function mapStatus(s) {
  if (s == null) return null;
  const v = String(s).toUpperCase();
  if (v === '0' || v === 'ERROR' || v === 'PENDING_ERROR') return 'failed';
  if (v === '1' || v === 'PENDING') return 'sent';
  if (v === '2' || v === 'SERVER_ACK' || v === 'SENT') return 'sent';
  if (v === '3' || v === 'DELIVERY_ACK' || v === 'DELIVERED') return 'delivered';
  if (v === '4' || v === 'READ' || v === 'PLAYED') return 'read';
  return null;
}

/**
 * Retry a Base44 operation with exponential backoff on 429 rate limit.
 * @param {Function} operation - Async function to retry
 * @param {number} maxAttempts - Maximum retry attempts (default: 3)
 * @returns {Promise<any>} - Result of the operation
 */
async function retryWithBackoff(operation, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (e) {
      lastError = e;
      const isRateLimit = e?.status === 429 || e?.data?.error_type === 'HTTPException' || String(e.message).includes('Rate limit');
      if (!isRateLimit || attempt === maxAttempts) {
        throw e;
      }
      const delayMs = Math.pow(2, attempt) * 100; // 200ms, 400ms, 800ms
      console.log(`[retryWithBackoff] attempt=${attempt}/${maxAttempts} rate_limit=true retry_in=${delayMs}ms`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

async function deadLetter(serviceRole, payload) {
  try {
    await retryWithBackoff(async () => {
      return serviceRole.entities.WebhookDeadLetter.create({
        source: 'evolution',
        event: payload.event || '',
        instance: payload.instance || '',
        wa_message_id: payload.wa_message_id || '',
        stage: payload.stage || '',
        error: String(payload.error || '').slice(0, 1000),
        raw_payload: payload.raw || null,
      });
    });
  } catch (e) {
    console.error('[evolutionWebhook][DEAD-LETTER-FALLBACK]', JSON.stringify({ err: String(e), origErr: payload.error }));
  }
}

// ── handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret') || req.headers.get('x-evolution-secret') || '';
  const expectedSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET') || '';
  if (!expectedSecret || secret !== expectedSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (req.method !== 'POST') return new Response('OK', { status: 200 });

  const base44 = createClientFromRequest(req);
  const serviceRole = base44.asServiceRole;

  let body;
  try {
    body = await req.json();
  } catch (e) {
    await deadLetter(serviceRole, { stage: 'parse_body', error: e?.message || String(e), raw: null });
    return Response.json({ status: 'dead_lettered', stage: 'parse_body' }, { status: 200 });
  }

  const event = body?.event || '';
  const instanceName = (body?.instance || '').toLowerCase();
  const channel = instanceName === 'erudite' ? 'business' : 'personal';

  try {
    // ── STATUS PIPELINE ──────────────────────────────────────────────────
    if (event === 'messages.update' || event === 'messages.edit') {
      const updates = Array.isArray(body.data) ? body.data : [body.data];
      let touched = 0;
      for (const u of updates) {
        const waId = u?.key?.id || u?.keyId || u?.id;
        const rawStatus = u?.update?.status ?? u?.status;
        const mapped = mapStatus(rawStatus);
        if (!waId || !mapped) continue;
        const existing = await serviceRole.entities.Message.filter({ wa_message_id: waId });
        if (existing?.[0]) {
          await retryWithBackoff(async () => {
            return serviceRole.entities.Message.update(existing[0].id, { status: mapped });
          });
          touched++;
        }
      }
      console.log(`[evolutionWebhook] event=${event} instance=${instanceName} status_updates=${touched}`);
      return Response.json({ status: 'status_updated', count: touched });
    }

    // ── DELETIONS ────────────────────────────────────────────────────────
    if (event === 'messages.delete') {
      const dels = Array.isArray(body.data) ? body.data : [body.data];
      let touched = 0;
      for (const d of dels) {
        const waId = d?.key?.id || d?.id;
        if (!waId) continue;
        const existing = await serviceRole.entities.Message.filter({ wa_message_id: waId });
        if (existing?.[0]) {
          await retryWithBackoff(async () => {
            return serviceRole.entities.Message.update(existing[0].id, { is_deleted: true });
          });
          touched++;
        }
      }
      console.log(`[evolutionWebhook] event=messages.delete instance=${instanceName} deleted=${touched}`);
      return Response.json({ status: 'deleted', count: touched });
    }

    // ── INCOMING MESSAGES ────────────────────────────────────────────────
    if (event !== 'messages.upsert') {
      return Response.json({ status: 'ignored', event });
    }

    const data = body?.data;
    if (!data) return Response.json({ status: 'no_data' });

    const key = data.key || {};
    const remoteJid = key.remoteJid || '';
    const fromMe = key.fromMe === true;
    const waMessageId = key.id || '';

    if (remoteJid.includes('@g.us')) return Response.json({ status: 'skipped_group' });
    if (remoteJid.includes('@broadcast') || remoteJid === 'status@broadcast') return Response.json({ status: 'skipped_broadcast' });
    if (fromMe) return Response.json({ status: 'skipped_outgoing' });

    const digitsPhone = jidToDigits(remoteJid);
    if (!digitsPhone) return Response.json({ status: 'no_phone' });

    const timestamp = tsToIso(data.messageTimestamp);
    const parsed = parseMessage(data.message);

    console.log(`[evolutionWebhook] event=upsert instance=${instanceName} channel=${channel} from=${digitsPhone} type=${parsed.msgType} msgId=${waMessageId} hasMedia=${!!parsed.media}`);

    // Reaction → attach to the target message, do not create a new row
    if (parsed.reaction?.target_wa_id) {
      const tgt = await serviceRole.entities.Message.filter({ wa_message_id: parsed.reaction.target_wa_id });
      if (tgt?.[0]) await serviceRole.entities.Message.update(tgt[0].id, { reaction: parsed.reaction.emoji });
      return Response.json({ status: 'reaction_recorded', emoji: parsed.reaction.emoji });
    }
    // Deletion via protocolMessage REVOKE
    if (parsed.deletion_target) {
      const tgt = await serviceRole.entities.Message.filter({ wa_message_id: parsed.deletion_target });
      if (tgt?.[0]) await serviceRole.entities.Message.update(tgt[0].id, { is_deleted: true });
      return Response.json({ status: 'deletion_recorded' });
    }

    // ── BUSINESS channel (erudite / Cloud API) → ApiInboxMessage ──────────
    if (instanceName === 'erudite') {
      const landlordMatch = await findLandlordByPhone(serviceRole, digitsPhone);
      const leadMatch = landlordMatch ? null : await findLeadByPhone(serviceRole, digitsPhone);
      await serviceRole.entities.ApiInboxMessage.create({
        sender_phone: digitsPhone,
        message_text: parsed.text,
        message_type: parsed.msgType,
        received_at: timestamp,
        instance_name: instanceName,
        raw_payload: body,
        status: 'new',
        linked_landlord_id: landlordMatch?.id || null,
        linked_landlord_name: landlordMatch ? (landlordMatch.full_name_en || landlordMatch.full_name) : null,
        linked_lead_id: leadMatch?.id || null,
        linked_lead_name: leadMatch?.full_name || null,
      });
      return Response.json({ status: 'api_inbox_saved', matched_landlord: !!landlordMatch, matched_lead: !!leadMatch });
    }

    // ── PERSONAL channel (erudite_whatsapp / Baileys) → Message ───────────
    if (waMessageId) {
      const existing = await serviceRole.entities.Message.filter({ wa_message_id: waMessageId });
      if (existing?.length > 0) return Response.json({ status: 'duplicate', wa_message_id: waMessageId });
    }

    const landlord = await findLandlordByPhone(serviceRole, digitsPhone);

    const record = {
      landlord_id: landlord ? landlord.id : null,
      phone: digitsPhone,
      direction: 'incoming',
      text: parsed.text,
      timestamp,
      status: 'received',
      wa_message_id: waMessageId || null,
      channel,
      msg_type: parsed.msgType,
    };
    if (parsed.caption) record.caption = parsed.caption;
    if (parsed.reply_to_wa_id) record.reply_to_wa_id = parsed.reply_to_wa_id;
    if (parsed.location) record.location_json = JSON.stringify(parsed.location);
    if (parsed.contacts) record.contacts_json = JSON.stringify(parsed.contacts);
    if (parsed.media) {
      record.media_type = parsed.media.kind;
      record.media_mime = parsed.media.mime || '';
      if (parsed.media.duration != null) record.media_duration = parsed.media.duration;
      if (parsed.media.fileName) record.media_filename = parsed.media.fileName;
      record.is_voice_note = parsed.media.isVoiceNote === true;
      record.media_status = 'pending';  // processInboundMedia will download + persist
    }

    const message = await retryWithBackoff(async () => {
      return serviceRole.entities.Message.create(record);
    });
    console.log(`[evolutionWebhook] Created Message ${message.id} (landlord=${landlord ? landlord.id : 'none'}, type=${parsed.msgType})`);

    // Async: download media (and, for voice notes, transcribe). Never blocks the webhook.
    if (parsed.media) {
      serviceRole.functions.invoke('processInboundMedia', {
        message_id: message.id,
        instance: instanceName,
        wa_message_id: waMessageId,
      }).catch(() => {});
    }

    // Async: AI analysis for matched landlords (debounced inside the function).
    if (landlord) {
      serviceRole.functions.invoke('analyzeLandlordConversation', { landlord_id: landlord.id }).catch(() => {});
    }

    return Response.json({
      status: 'ok',
      matched: !!landlord,
      message_id: message.id,
      landlord_id: landlord ? landlord.id : null,
      type: parsed.msgType,
      has_media: !!parsed.media,
    });
  } catch (e) {
    await deadLetter(serviceRole, {
      stage: 'process', event, instance: instanceName,
      wa_message_id: body?.data?.key?.id || '',
      error: e?.stack || e?.message || String(e), raw: body,
    });
    console.error(`[evolutionWebhook][ERROR] event=${event} instance=${instanceName}: ${e?.message || e}`);
    // Ack with 200 so Evolution doesn't hammer-retry; the dead-letter holds the payload for replay.
    return Response.json({ status: 'dead_lettered', stage: 'process', error: e?.message || String(e) }, { status: 200 });
  }
});