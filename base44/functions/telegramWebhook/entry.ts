import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// telegramWebhook — receives inbound Telegram updates from the Bot API.
//
// Telegram delivers every message your bot receives to this URL (set once via setTelegramWebhook).
// For each inbound text message we:
//   1. Identify the sender (from.id = their numeric chat_id, from.username, contact phone).
//   2. Find the matching Landlord — by telegram_chat_id, telegram_username, or shared phone/contact.
//   3. Auto-capture telegram_chat_id (+ username) on that Landlord the first time they write,
//      so the agent can reply / initiate from the CRM afterwards.
//   4. Log the inbound message to TelegramMessage + mirror into the unified Message stream.
//
// Public endpoint (no app-user auth) — Telegram calls it. We authenticate the caller with a
// secret path token: the webhook URL carries ?token=<TELEGRAM_WEBHOOK_SECRET> and we reject
// any request without it. Always returns 200 so Telegram doesn't retry-storm on our errors.

const ok = () => Response.json({ ok: true });

// Normalize a phone to digits-only for loose matching (Telegram contacts come without '+').
function digits(raw) {
  return String(raw || '').replace(/\D/g, '');
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const provided = url.searchParams.get('token') || '';
    const expected = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '';
    // If a secret is configured, enforce it. (Still 200 so Telegram won't retry forever.)
    if (expected && provided !== expected) return ok();

    let base44;
    try {
      base44 = createClientFromRequest(req);
    } catch (_) {
      // Telegram POSTs carry no Base44 auth headers; if client creation throws, bail gracefully.
      return ok();
    }

    const update = await req.json().catch(() => ({}));

    const msg = update?.message || update?.edited_message;
    if (!msg) return ok();

    const from = msg.from || {};
    const chatId = String(msg.chat?.id ?? from.id ?? '').trim();
    if (!chatId) return ok();

    const username = from.username ? String(from.username) : '';
    const contactPhone = msg.contact?.phone_number ? digits(msg.contact.phone_number) : '';
    const text = msg.text || msg.caption || (msg.contact ? '[shared contact]' : '[non-text message]');
    const tgMessageId = msg.message_id ? String(msg.message_id) : null;
    const sentAt = msg.date ? new Date(msg.date * 1000).toISOString() : new Date().toISOString();

    // ── Resolve the landlord ──
    let landlord = null;

    // 1) Already linked by chat_id.
    try {
      const byChat = await base44.asServiceRole.entities.Landlord.filter({ telegram_chat_id: chatId }, '-updated_date', 1);
      if (byChat && byChat.length) landlord = byChat[0];
    } catch (_) { /* ignore */ }

    // 2) By @username.
    if (!landlord && username) {
      try {
        const byUser = await base44.asServiceRole.entities.Landlord.filter({ telegram_username: username }, '-updated_date', 1);
        if (byUser && byUser.length) landlord = byUser[0];
      } catch (_) { /* ignore */ }
    }

    // 3) By shared phone (only when the user sent a contact card with their number).
    if (!landlord && contactPhone) {
      try {
        // Pull a reasonable page of landlords and match on digits-suffix (handles +971 vs 0 vs raw).
        const all = await base44.asServiceRole.entities.Landlord.list('-updated_date', 500);
        landlord = (all || []).find((l) => {
          const cands = [l.phone, l.whatsapp, ...(Array.isArray(l.additional_phones) ? l.additional_phones : [])];
          return cands.some((p) => {
            const d = digits(p);
            return d && contactPhone && (d.endsWith(contactPhone.slice(-9)) || contactPhone.endsWith(d.slice(-9)));
          });
        }) || null;
      } catch (_) { /* ignore */ }
    }

    // ── Auto-capture chat_id / username on first contact ──
    if (landlord) {
      const patch = {};
      if (!landlord.telegram_chat_id) patch.telegram_chat_id = chatId;
      if (username && landlord.telegram_username !== username) patch.telegram_username = username;
      if (Object.keys(patch).length) {
        try { await base44.asServiceRole.entities.Landlord.update(landlord.id, patch); } catch (_) { /* best-effort */ }
      }
    }

    // ── Log the inbound message ──
    try {
      await base44.asServiceRole.entities.TelegramMessage.create({
        landlord_id: landlord?.id || undefined,
        direction: 'inbound',
        chat_id: chatId,
        body: text,
        status: 'delivered',
        sent_at: sentAt,
        tg_message_id: tgMessageId,
      });
    } catch (_) { /* best-effort */ }

    // Mirror into the unified Message stream so landlordOrchestrator sees inbound Telegram.
    if (landlord) {
      try {
        await base44.asServiceRole.entities.Message.create({
          landlord_id: landlord.id,
          phone: chatId,
          direction: 'incoming',
          text,
          timestamp: sentAt,
          status: 'received',
          channel: 'telegram',
          wa_message_id: tgMessageId || undefined,
        });
      } catch (_) { /* best-effort */ }
    }

    return ok();
  } catch (_) {
    // Always 200 so Telegram doesn't retry-storm.
    return ok();
  }
});