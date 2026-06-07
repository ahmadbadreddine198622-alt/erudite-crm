import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * backfillMessagesToWhatsAppMessage — copy Message backup → WhatsAppMessage stack
 * (rate-limit safe, resume-safe), then reconcile WhatsAppConversation.channel from
 * each conversation's messages (ambiguous => left empty + reported).
 * Requires WhatsAppConversation.channel field.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CREATE_DELAY_MS = 100;
const PAGE = 100;

function mapMediaType(t) { return ['image', 'audio', 'video', 'document'].includes(t) ? t : 'none'; }
function mapStatus(s) { return ['sent', 'delivered', 'read', 'failed'].includes(s) ? s : 'delivered'; }
function mapDirection(d) { return d === 'outgoing' ? 'outbound' : 'inbound'; }

async function withRetry(fn, attempts = 6) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(); }
    catch (e) {
      last = e;
      const msg = String(e?.message || e);
      const is429 = e?.status === 429 || /rate limit|429|too many requests/i.test(msg);
      if (!is429 || i === attempts) {
        console.warn('[withRetry] failed after ' + i + ' attempts: ' + msg);
        throw e;
      }
      const delay = 500 * Math.pow(2, i - 1);
      console.log('[withRetry] 429 detected, waiting ' + delay + 'ms (attempt ' + i + '/' + attempts + ')');
      await sleep(delay);
    }
  }
  throw last;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;

  let copied = 0, skipped_existing = 0, skipped_no_waid = 0, errors = 0, scanned = 0;
  const convCache = new Map();

  // PHASE 1: Message -> WhatsAppMessage
  let offset = 0;
  let batchFailures = 0;
  while (true) {
    let batch;
    try {
      batch = await withRetry(() => svc.entities.Message.filter({}, 'timestamp', PAGE, offset));
      batchFailures = 0;
    }
    catch (e) {
      batchFailures++;
      console.error('[backfill p1] batch fetch failed (' + batchFailures + '), retrying...');
      if (batchFailures >= 3) { errors++; break; }
      await sleep(2000);
      continue;
    }
    if (!batch || !batch.length) break;
    offset += batch.length;

    for (const m of batch) {
      scanned++;
      const waId = m.wa_message_id;
      if (!waId) { skipped_no_waid++; continue; }
      try {
        let dup;
        try {
          dup = await withRetry(() => svc.entities.WhatsAppMessage.filter({ wa_message_id: waId }));
        }
        catch (dedupeErr) {
          const errMsg = String(dedupeErr?.message || dedupeErr);
          const is429 = dedupeErr?.status === 429 || /rate limit|429|too many requests/i.test(errMsg);
          if (is429) {
            console.warn('[backfill p1] SKIP ' + waId + ' - dedupe rate limited, will retry later');
            errors++;
            await sleep(100);
            continue;
          }
          throw dedupeErr;
        }
        if (dup?.length) { skipped_existing++; continue; }

        const digits = String(m.phone || '').replace(/\D/g, '');
        if (!digits) { skipped_no_waid++; continue; }
        const e164 = '+' + digits;
        const channel = (m.channel === 'business' || m.channel === 'personal') ? m.channel : null;
        const ts = m.timestamp || new Date().toISOString();
        const dir = mapDirection(m.direction);

        let conv = convCache.get(e164);
        if (!conv) conv = (await withRetry(() => svc.entities.WhatsAppConversation.filter({ wa_phone_e164: e164 })))?.[0] || null;
        if (!conv) {
          conv = await withRetry(() => svc.entities.WhatsAppConversation.create({
            wa_phone_e164: e164, phone_number: digits, status: 'new',
            last_message: m.text || '', last_message_at: ts,
            [dir === 'inbound' ? 'last_inbound_at' : 'last_outbound_at']: ts,
            first_message_at: ts, unread_count: 0,
          }));
          await sleep(CREATE_DELAY_MS);
        }
        convCache.set(e164, conv);

        await withRetry(() => svc.entities.WhatsAppMessage.create({
          conversation_id: conv.id, direction: dir, body: m.text || '', timestamp: ts,
          wa_message_id: waId, media_url: m.media_url || undefined, media_type: mapMediaType(m.media_type),
          status: dir === 'inbound' ? (m.status === 'received' ? 'delivered' : mapStatus(m.status)) : mapStatus(m.status),
          channel: channel || undefined,
          from_number: dir === 'inbound' ? digits : undefined,
          to_number: dir === 'outbound' ? digits : undefined,
          transcription: m.transcript || undefined, detected_language: m.transcript_lang || undefined,
          is_deleted: m.is_deleted === true, reaction: m.reaction || undefined,
        }));
        copied++;
        await sleep(CREATE_DELAY_MS);
      } catch (e) { errors++; console.error('[backfill p1] ' + waId + ': ' + (e?.message || e)); }
    }
  }

  // PHASE 2: reconcile conversation.channel from its messages
  let conversations_updated = 0;
  const conversations_ambiguous = [];
  let coff = 0;
  while (true) {
    let convs;
    try { convs = await withRetry(() => svc.entities.WhatsAppConversation.filter({}, '-last_message_at', PAGE, coff)); }
    catch (e) { errors++; break; }
    if (!convs || !convs.length) break;
    coff += convs.length;

    for (const conv of convs) {
      if (conv.channel === 'business' || conv.channel === 'personal') continue;
      try {
        const msgs = await withRetry(() => svc.entities.WhatsAppMessage.filter({ conversation_id: conv.id }, '-timestamp', 200));
        const chans = new Set((msgs || []).map((x) => x.channel).filter((c) => c === 'business' || c === 'personal'));
        if (chans.size === 1) {
          await withRetry(() => svc.entities.WhatsAppConversation.update(conv.id, { channel: [...chans][0] }));
          conversations_updated++;
          await sleep(CREATE_DELAY_MS);
        } else if (chans.size >= 2) {
          conversations_ambiguous.push({ id: conv.id, phone: conv.phone_number || conv.wa_phone_e164 || '' });
          console.warn('[backfill] ambiguous channel — left empty: conv ' + conv.id);
        }
      } catch (e) { errors++; console.error('[backfill p2] ' + conv.id + ': ' + (e?.message || e)); }
    }
  }

  const result = { copied, skipped_existing, errors, conversations_updated, conversations_ambiguous, scanned, skipped_no_wa_message_id: skipped_no_waid };
  console.log('[backfillMessagesToWhatsAppMessage]', JSON.stringify(result));
  return Response.json(result);
});