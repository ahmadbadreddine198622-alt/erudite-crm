import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// telegramWebhook — public HTTP endpoint that receives inbound Telegram messages
// from our external Telegram relay service.
//
// The relay POSTs JSON: { event, session_id, chat_id, tg_message_id, from_phone,
//   from_username, from_name, body, sent_at }
//
// Security: rejects with 401 unless the X-Relay-Secret header matches
// TELEGRAM_RELAY_SECRET.
//
// Flow: dedup by tg_message_id → match sender to a Landlord → create a
// TelegramMessage record → auto-capture chat_id/username on the landlord →
// the TelegramMessage record IS the timeline entry (buildLandlordStream pulls
// from the TelegramMessage entity directly). On any processing error, a
// WebhookDeadLetter is created and 500 is returned.

function digits(raw) {
  return String(raw || '').replace(/\D/g, '');
}

Deno.serve(async (req) => {
  let payload: any = {};
  try {
    // ── Security: validate relay secret ──
    const relaySecret = Deno.env.get('TELEGRAM_RELAY_SECRET') || '';
    const providedSecret = req.headers.get('X-Relay-Secret') || '';
    if (!relaySecret || providedSecret !== relaySecret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    payload = await req.json().catch(() => ({}));
    const { event, chat_id, tg_message_id, from_phone, from_username, body, sent_at } = payload;

    const base44 = createClientFromRequest(req);

    // (a) Dedup by tg_message_id
    if (tg_message_id) {
      try {
        const existing = await base44.asServiceRole.entities.TelegramMessage.filter(
          { tg_message_id: String(tg_message_id) }, '-created_date', 1
        );
        if (existing && existing.length) {
          return Response.json({ ok: true, duplicate: true });
        }
      } catch (_) { /* ignore dedup check failure */ }
    }

    // (b) Match the sender to a Landlord
    let landlord: any = null;

    // 1) By telegram_chat_id
    if (chat_id) {
      try {
        const byChat = await base44.asServiceRole.entities.Landlord.filter(
          { telegram_chat_id: String(chat_id) }, '-updated_date', 1
        );
        if (byChat && byChat.length) landlord = byChat[0];
      } catch (_) { /* ignore */ }
    }

    // 2) By phone match on from_phone against landlord phone fields
    if (!landlord && from_phone) {
      const phoneDigits = digits(from_phone);
      if (phoneDigits) {
        try {
          const all = await base44.asServiceRole.entities.Landlord.list('-updated_date', 500);
          landlord = (all || []).find((l: any) => {
            const cands = [l.phone, l.whatsapp, ...(Array.isArray(l.additional_phones) ? l.additional_phones : [])];
            return cands.some((p: any) => {
              const d = digits(p);
              return d && (d.endsWith(phoneDigits.slice(-9)) || phoneDigits.endsWith(d.slice(-9)));
            });
          }) || null;
        } catch (_) { /* ignore */ }
      }
    }

    // 3) By telegram_username
    if (!landlord && from_username) {
      try {
        const byUser = await base44.asServiceRole.entities.Landlord.filter(
          { telegram_username: String(from_username) }, '-updated_date', 1
        );
        if (byUser && byUser.length) landlord = byUser[0];
      } catch (_) { /* ignore */ }
    }

    // (c) Create TelegramMessage (inbound) — this IS the activity/timeline entry
    await base44.asServiceRole.entities.TelegramMessage.create({
      landlord_id: landlord?.id || undefined,
      direction: 'inbound',
      chat_id: String(chat_id || ''),
      body: body || '',
      tg_message_id: tg_message_id ? String(tg_message_id) : undefined,
      sent_at: sent_at || new Date().toISOString(),
      status: 'delivered',
    });

    // BRAIN V4 P3 LEARN: inbound reply → outcome ledger (non-fatal).
    if (landlord?.id) {
      try {
        await base44.asServiceRole.functions.invoke('recordOutcomeEvent', {
          landlord_id: landlord.id,
          kind: 'reply_received',
          channel: 'telegram',
          source_ref: tg_message_id ? `TelegramMessage:${tg_message_id}` : '',
          text: body || '',
          responded_at: sent_at || new Date().toISOString(),
        }).catch(() => {});
      } catch (_) { /* best-effort */ }
    }

    // (d) Auto-capture chat_id and username on the landlord
    if (landlord && !landlord.telegram_chat_id) {
      const patch: any = { telegram_chat_id: String(chat_id) };
      if (from_username && !landlord.telegram_username) {
        patch.telegram_username = String(from_username);
      }
      try {
        await base44.asServiceRole.entities.Landlord.update(landlord.id, patch);
      } catch (_) { /* best-effort */ }
    }

    return Response.json({ ok: true });
  } catch (error) {
    // (f) Create a WebhookDeadLetter and return 500
    try {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.WebhookDeadLetter.create({
        source: 'telegram',
        event: payload?.event || 'message.inbound',
        stage: 'process',
        error: String(error?.message || error).slice(0, 1000),
        raw_payload: payload,
      });
    } catch (_) { /* best-effort */ }
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});