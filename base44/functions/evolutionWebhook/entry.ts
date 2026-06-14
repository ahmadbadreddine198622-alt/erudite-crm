import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Evolution API (VPS) webhook receiver.
 *
 * Handles TWO instances:
 *   - "erudite"           → business WhatsApp number (+971582806000)
 *   - "erudite_whatsapp"  → personal WhatsApp number (+971581806000)
 *
 * ALL inbound messages from both instances are stored in:
 *   - WhatsAppMessage  (used by ChatThread / inbox UI)
 *   - WhatsAppConversation  (one per contact phone number, per channel)
 *   - Message  (legacy, kept for backward compat)
 */

const BUSINESS_NUMBER = '+971582806000';
const PERSONAL_NUMBER = '+971581806000';

function stripPlus(raw) {
  if (!raw) return '';
  return String(raw).replace(/^\+/, '').replace(/\s+/g, '').trim();
}

function jidToDigits(jid) {
  if (!jid) return '';
  return String(jid).split('@')[0].split(':')[0];
}

function normalizePhone(digits) {
  if (!digits) return '';
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  if (digits.startsWith('05') && digits.length === 10) return '+971' + digits.slice(1);
  if (digits.startsWith('5') && digits.length === 9) return '+971' + digits;
  if (digits.length >= 10) return '+' + digits;
  return digits;
}

function tsToIso(rawTimestamp) {
  if (!rawTimestamp) return new Date().toISOString();
  const n = typeof rawTimestamp === 'number' ? rawTimestamp : parseInt(rawTimestamp, 10);
  if (!isNaN(n)) return new Date(n * 1000).toISOString();
  return new Date(rawTimestamp).toISOString();
}

function parseMessage(rawMsgObj) {
  let m = rawMsgObj || {};
  // Unwrap common wrapper types
  m = m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message
    || m.documentWithCaptionMessage?.message || m;

  // Filter out noise-only keys so we get the actual content key
  const NOISE_KEYS = new Set([
    'messageContextInfo', 'senderKeyDistributionMessage', 'deviceSentMessage',
    'messageStubType', 'messageStubParameters', 'clearChatMessage',
  ]);
  const keys = Object.keys(m).filter(k => !NOISE_KEYS.has(k));
  const type = keys[0] || 'unknown';
  const out = {
    msgType: type, text: '', caption: '', media: null,
    reply_to_wa_id: '', reaction: null, deletion_target: '', location: null, contacts: null,
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
    case 'templateMessage': {
      // Property Finder and other WhatsApp template messages
      const tmpl = m.templateMessage?.hydratedTemplate || m.templateMessage?.hydratedFourRowTemplate;
      if (tmpl) {
        const lines = [];
        // Prepend title if present
        if (tmpl.hydratedTitleText?.trim()) {
          lines.push(tmpl.hydratedTitleText.trim());
        }
        // Main content text
        if (tmpl.hydratedContentText?.trim()) {
          lines.push(tmpl.hydratedContentText.trim());
        }
        // Extract button URLs (urlButton type)
        const buttons = tmpl.hydratedButtons || [];
        for (const btn of buttons) {
          if (btn.urlButton) {
            const displayText = btn.urlButton.displayText || 'Link';
            const url = btn.urlButton.url || '';
            if (url) {
              lines.push(`${displayText}: ${url}`);
            }
          } else if (btn.quickReplyButton) {
            // Fallback: quick reply button text
            if (btn.quickReplyButton.displayText) {
              lines.push(btn.quickReplyButton.displayText);
            }
          } else if (btn.callButton) {
            // Fallback: call button
            if (btn.callButton.displayText && btn.callButton.phoneNumber) {
              lines.push(`${btn.callButton.displayText}: ${btn.callButton.phoneNumber}`);
            }
          }
        }
        out.text = lines.join('\n') || '[template message]';
      } else {
        out.text = '[template message]';
      }
      break;
    }
    default:
      out.text = '[unsupported message type]';
  }
  return out;
}

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

async function deadLetter(serviceRole, payload) {
  try {
    await serviceRole.entities.WebhookDeadLetter.create({
      source: 'evolution',
      event: payload.event || '',
      instance: payload.instance || '',
      wa_message_id: payload.wa_message_id || '',
      stage: payload.stage || '',
      error: String(payload.error || '').slice(0, 1000),
      raw_payload: payload.raw || null,
    });
  } catch (e) {
    console.error('[evolutionWebhook][DEAD-LETTER-FALLBACK]', JSON.stringify({ err: String(e), origErr: payload.error }));
  }
}

async function withRetry(fn, attempts = 6) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      const is429 = e?.status === 429 || /rate limit|429|too many requests/i.test(msg);
      if (!is429 || i === attempts) {
        console.warn(`[withRetry] failed after ${i} attempts: ${msg}`);
        throw e;
      }
      const delay = 500 * Math.pow(2, i - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/**
 * Find or create a WhatsAppConversation for the given phone + channel.
 * Returns the conversation record.
 */
async function upsertConversation(serviceRole, { e164Phone, digitsPhone, channel, bodyText, timestamp, waDisplayName }) {
  // Try to find existing conversation for this phone on this channel
  let conv = null;
  try {
    const convs = await serviceRole.entities.WhatsAppConversation.filter({ wa_phone_e164: e164Phone, channel });
    conv = convs?.[0] || null;
  } catch {}

  // No fallback to channel-less legacy records — always create a new one per channel
  // (avoids business messages being swallowed by an old personal conversation)

  if (!conv) {
    // Create new
    try {
      conv = await serviceRole.entities.WhatsAppConversation.create({
        wa_phone_e164: e164Phone,
        phone_number: e164Phone,
        wa_display_name: waDisplayName,
        status: 'new',
        channel,
        first_message_at: timestamp,
        last_inbound_at: timestamp,
        last_message: bodyText,
        last_message_at: timestamp,
        unread_count: 1,
      });
      // NEW CONVERSATION: trigger one-time profile photo fetch (best-effort, non-blocking)
      // Also set wa_display_name from inbound if empty (handled above on create)
      serviceRole.functions.invoke('fetchWhatsAppProfilePics', { phone: e164Phone }).catch(() => {});
    } catch (err) {
      console.error('[evolutionWebhook] conversation create failed:', err?.message);
      return null;
    }
  } else {
    try {
      await serviceRole.entities.WhatsAppConversation.update(conv.id, {
        status: conv.status === 'resolved' ? 'open' : (conv.status || 'open'),
        wa_display_name: conv.wa_display_name || waDisplayName, // Only fill if empty, never overwrite
        last_inbound_at: timestamp,
        last_message: bodyText,
        last_message_at: timestamp,
        last_message_channel: channel,
        channel: conv.channel || channel,
        unread_count: (conv.unread_count || 0) + 1,
      });
    } catch (err) {
      console.warn('[evolutionWebhook] conversation update failed:', err?.message);
    }
  }
  return conv;
}

/**
 * Detect if message body is a Property Finder lead notification.
 * Returns parsed { title, reference, url1, url2 } or null.
 */
function parsePropertyFinderLead(body) {
  if (!body || typeof body !== 'string') return null;
  // Must contain both markers
  if (!body.includes('Property Finder') || !body.includes('Reference number:')) return null;

  // Extract title: text after "*Title:*" up to "*Reference number:*"
  const titleMatch = body.match(/\*Title:\*\s*(.+?)\s*\*Reference number:/s);
  const title = titleMatch ? titleMatch[1].trim() : null;

  // Extract reference: text after "*Reference number:*" up to "Use this link" or end
  const refMatch = body.match(/\*Reference number:\*\s*(.+?)\s*(?:Use this link|$)/s);
  const reference = refMatch ? refMatch[1].trim() : null;

  if (!title || !reference) return null;

  // Extract URLs
  const urls = [];
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  let match;
  while ((match = urlRegex.exec(body)) !== null) {
    urls.push(match[1]);
  }

  // url1 = propertyfinder.ae/leads/... (respond link)
  // url2 = propertyfinder.ae/to/... (view listing)
  const url1 = urls.find(u => u.includes('propertyfinder.ae/leads/')) || urls[0];
  const url2 = urls.find(u => u.includes('propertyfinder.ae/to/')) || urls[1];

  return { title, reference, url1, url2 };
}

/**
 * Auto-create a Lead from a Property Finder lead notification.
 * Dedupes by closing_property_ref (reference number).
 * Returns { created: boolean, lead_id: string, reference: string, title: string } or null.
 */
async function createLeadFromPFMessage(serviceRole, { body, conv, channel }) {
  const parsed = parsePropertyFinderLead(body);
  if (!parsed) return null;

  const { title, reference, url1, url2 } = parsed;

  // DEDUPE: check if Lead already exists with this reference
  try {
    const existingLeads = await serviceRole.entities.Lead.filter({ closing_property_ref: reference });
    if (existingLeads?.length > 0) {
      const existingLead = existingLeads[0];
      console.log(`[PF Lead] Dedupe: Lead ${existingLead.id} already exists for reference ${reference}`);
      
      // Ensure conversation is linked to existing lead
      if (conv && !conv.lead_id) {
        try {
          await serviceRole.entities.WhatsAppConversation.update(conv.id, { lead_id: existingLead.id });
          console.log(`[PF Lead] Linked conversation ${conv.id} to existing Lead ${existingLead.id}`);
        } catch (err) {
          console.warn('[PF Lead] Failed to link conversation to existing lead:', err?.message);
        }
      }
      
      return { created: false, lead_id: existingLead.id, reference, title };
    }
  } catch (err) {
    console.error('[PF Lead] Dedupe check failed:', err?.message);
  }

  // Determine assigned agent
  let assignedAgentEmail = conv?.assigned_agent_email || null;
  if (!assignedAgentEmail) {
    // Fallback to default agent
    assignedAgentEmail = 'ahmad.badreddine198622@gmail.com';
  }

  // Build notes
  const notesParts = [`Property Finder lead. Reference: ${reference}`];
  if (url1) notesParts.push(`Respond: ${url1}`);
  if (url2) notesParts.push(`Listing: ${url2}`);
  const notes = notesParts.join('\n');

  // Create Lead
  try {
    const newLead = await serviceRole.entities.Lead.create({
      full_name: title,
      source: 'property_finder',
      stage: 'intake_clarify',
      closing_property_ref: reference,
      notes,
      assigned_agent_email: assignedAgentEmail,
      intent: 'buyer',
      status: 'active',
    });
    console.log(`[PF Lead] Created Lead ${newLead.id} for reference ${reference}`);

    // Link conversation to new lead
    if (conv && conv.id) {
      try {
        await serviceRole.entities.WhatsAppConversation.update(conv.id, { lead_id: newLead.id });
        console.log(`[PF Lead] Linked conversation ${conv.id} to new Lead ${newLead.id}`);
      } catch (err) {
        console.warn('[PF Lead] Failed to link conversation to new lead:', err?.message);
      }
    }

    return { created: true, lead_id: newLead.id, reference, title };
  } catch (err) {
    console.error('[PF Lead] Lead creation failed:', err?.message);
    return null;
  }
}

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
  // Both "erudite" (business Meta number) and "erudite_whatsapp" (personal) are handled
  const channel = instanceName === 'erudite' ? 'business' : 'personal';
  const myNumber = channel === 'business' ? BUSINESS_NUMBER : PERSONAL_NUMBER;

  try {
    // ---- Status updates ----
    if (event === 'messages.update' || event === 'messages.edit') {
      const updates = Array.isArray(body.data) ? body.data : [body.data];
      let touched = 0;
      for (const u of updates) {
        const waId = u?.key?.id || u?.keyId || u?.id;
        const rawStatus = u?.update?.status ?? u?.status;
        const mapped = mapStatus(rawStatus);
        if (!waId || !mapped) continue;
        // Update in both Message and WhatsAppMessage
        const [existing, existingWA] = await Promise.all([
          withRetry(() => serviceRole.entities.Message.filter({ wa_message_id: waId })).catch(() => []),
          withRetry(() => serviceRole.entities.WhatsAppMessage.filter({ wa_message_id: waId })).catch(() => []),
        ]);
        if (existing?.[0]) {
          await withRetry(() => serviceRole.entities.Message.update(existing[0].id, { status: mapped })).catch(() => {});
          touched++;
        }
        if (existingWA?.[0]) {
          await withRetry(() => serviceRole.entities.WhatsAppMessage.update(existingWA[0].id, { status: mapped })).catch(() => {});
        }
      }
      return Response.json({ status: 'status_updated', count: touched });
    }

    if (event === 'messages.delete') {
      const dels = Array.isArray(body.data) ? body.data : [body.data];
      for (const d of dels) {
        const waId = d?.key?.id || d?.id;
        if (!waId) continue;
        const [existing, existingWA] = await Promise.all([
          serviceRole.entities.Message.filter({ wa_message_id: waId }).catch(() => []),
          serviceRole.entities.WhatsAppMessage.filter({ wa_message_id: waId }).catch(() => []),
        ]);
        if (existing?.[0]) await serviceRole.entities.Message.update(existing[0].id, { is_deleted: true }).catch(() => {});
        if (existingWA?.[0]) await serviceRole.entities.WhatsAppMessage.update(existingWA[0].id, { is_deleted: true }).catch(() => {});
      }
      return Response.json({ status: 'deleted' });
    }

    // Log ALL event types for diagnostic purposes (Stage 2 label detection)
    console.log(`[evolutionWebhook][EVENT_RECEIVED] event=${event} instance=${instanceName} channel=${channel}`);

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

    const digitsPhone = jidToDigits(remoteJid);
    if (!digitsPhone) return Response.json({ status: 'no_phone' });

    const e164Phone = normalizePhone(digitsPhone);
    const timestamp = tsToIso(data.messageTimestamp);
    const parsed = parseMessage(data.message);

    // Extract display name from pushName (Evolution provides this)
    const waDisplayName = data.pushName || data.verifiedBizName || '';

    console.log(`[evolutionWebhook] event=upsert instance=${instanceName} channel=${channel} from=${digitsPhone} fromMe=${fromMe} type=${parsed.msgType} msgId=${waMessageId}`);

    // Handle reactions and deletions from message content
    if (parsed.reaction?.target_wa_id) {
      const [tgt, tgtWA] = await Promise.all([
        serviceRole.entities.Message.filter({ wa_message_id: parsed.reaction.target_wa_id }).catch(() => []),
        serviceRole.entities.WhatsAppMessage.filter({ wa_message_id: parsed.reaction.target_wa_id }).catch(() => []),
      ]);
      if (tgt?.[0]) await serviceRole.entities.Message.update(tgt[0].id, { reaction: parsed.reaction.emoji }).catch(() => {});
      if (tgtWA?.[0]) await serviceRole.entities.WhatsAppMessage.update(tgtWA[0].id, { reaction: parsed.reaction.emoji }).catch(() => {});
      return Response.json({ status: 'reaction_recorded', emoji: parsed.reaction.emoji });
    }
    if (parsed.deletion_target) {
      const [tgt, tgtWA] = await Promise.all([
        serviceRole.entities.Message.filter({ wa_message_id: parsed.deletion_target }).catch(() => []),
        serviceRole.entities.WhatsAppMessage.filter({ wa_message_id: parsed.deletion_target }).catch(() => []),
      ]);
      if (tgt?.[0]) await serviceRole.entities.Message.update(tgt[0].id, { is_deleted: true }).catch(() => {});
      if (tgtWA?.[0]) await serviceRole.entities.WhatsAppMessage.update(tgtWA[0].id, { is_deleted: true }).catch(() => {});
      return Response.json({ status: 'deletion_recorded' });
    }

    // ---- Dedupe by wa_message_id ----
    if (waMessageId) {
      const existingWA = await serviceRole.entities.WhatsAppMessage.filter({ wa_message_id: waMessageId }).catch(() => []);
      if (existingWA?.length > 0) return Response.json({ status: 'duplicate', wa_message_id: waMessageId });
    }

    // ---- Find/create WhatsAppConversation ----
    // For outbound (fromMe), still find conv by e164 but don't bump unread
    let conv = null;
    if (fromMe) {
      // For sent messages, find the conversation matching this exact channel only
      try {
        const convs = await serviceRole.entities.WhatsAppConversation.filter({ wa_phone_e164: e164Phone, channel });
        conv = convs?.[0] || null;
      } catch {}
    } else {
      conv = await upsertConversation(serviceRole, {
        e164Phone,
        digitsPhone,
        channel,
        bodyText: parsed.text,
        timestamp,
        waDisplayName,
      });
    }

    if (!conv && fromMe) {
      // Outbound without a conversation — skip recording in WhatsAppMessage
      // (sendMultiChannelWhatsApp already records outbound)
      console.log('[evolutionWebhook] Outbound message, no conversation found — skipping WA record');
    }

    // ---- Persist WhatsAppMessage (the main inbox record) ----
    let waMessage = null;
    if (conv) {
      try {
        const waRecord = {
          conversation_id: conv.id,
          wa_message_id: waMessageId || null,
          direction: fromMe ? 'outbound' : 'inbound',
          body: parsed.text,
          status: fromMe ? 'sent' : 'delivered',
          timestamp,
          from_number: fromMe ? myNumber : e164Phone,
          to_number: fromMe ? e164Phone : myNumber,
          channel,
          media_type: parsed.media?.kind || 'none',
        };
        if (parsed.media?.kind === 'audio') {
          waRecord.is_voice_note = parsed.media.isVoiceNote === true;
        }
        if (parsed.location) {
          waRecord.location_json = JSON.stringify(parsed.location);
        }
        if (parsed.caption) {
          waRecord.caption = parsed.caption;
        }
        // Store raw Evolution payload for ALL inbound messages (for debugging unsupported types)
        if (!fromMe && data) {
          waRecord.raw_payload = {
            messageType: data.messageType || parsed.msgType,
            message: data.message || null,
            key: data.key || null,
            pushName: data.pushName || '',
          };
        }
        // Skip recording outbound if sendMultiChannelWhatsApp already stored it
        if (!fromMe) {
          waMessage = await serviceRole.entities.WhatsAppMessage.create(waRecord);
          console.log(`[evolutionWebhook] ✅ WhatsAppMessage created: ${waMessage.id} conv=${conv.id} channel=${channel}`);
        }
      } catch (err) {
        console.error('[evolutionWebhook] WhatsAppMessage create failed:', err?.message);
      }
    }

    // ---- Legacy Message record (backward compat) ----
    let legacyMessage = null;
    if (!fromMe) {
      try {
        const existing = waMessageId
          ? await serviceRole.entities.Message.filter({ wa_message_id: waMessageId }).catch(() => [])
          : [];
        if (!existing?.length) {
          legacyMessage = await serviceRole.entities.Message.create({
            landlord_id: null,
            phone: digitsPhone,
            direction: 'incoming',
            text: parsed.text,
            timestamp,
            status: 'received',
            wa_message_id: waMessageId || null,
            channel,
            message_type: parsed.msgType,
          });
        }
      } catch (err) {
        console.warn('[evolutionWebhook] Legacy Message create failed:', err?.message);
      }
    }

    // ---- Background: route + enrich for inbound messages ----
    if (!fromMe && conv?.id) {
      serviceRole.functions.invoke('routeWhatsAppMessage', {
        phone_e164: e164Phone,
        message_text: parsed.text,
        message_id: waMessageId,
        timestamp,
        conversation_id: conv.id,
        wa_display_name: waDisplayName || '',
      }).catch(() => {});
      serviceRole.functions.invoke('enrichConversation', { conversation_id: conv.id }).catch(() => {});
      
      // NOTE: Property Finder Lead auto-creation DISABLED — replaced with direct PF API poll.
      // Template message parsing (parsePropertyFinderLead) remains active for display purposes.
    }

    return Response.json({
      status: 'ok',
      channel,
      conversation_id: conv?.id || null,
      wa_message_id: waMessage?.id || null,
      legacy_message_id: legacyMessage?.id || null,
      from_me: fromMe,
      type: parsed.msgType,
    });
  } catch (e) {
    await deadLetter(serviceRole, {
      stage: 'process', event, instance: instanceName,
      wa_message_id: body?.data?.key?.id || '',
      error: e?.stack || e?.message || String(e), raw: body,
    });
    console.error(`[evolutionWebhook][ERROR] event=${event} instance=${instanceName}: ${e?.message || e}`);
    return Response.json({ status: 'dead_lettered', stage: 'process', error: e?.message || String(e) }, { status: 200 });
  }
});