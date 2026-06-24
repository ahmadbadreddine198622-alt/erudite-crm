import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// telegramDiag — one-off diagnostic: read webhook status, pull pending updates (chat_ids),
// and optionally send a test message to a given chat_id. Admin-only.
// Input: { send_to_chat_id?, text? }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
    if (!token) return Response.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const base = `https://api.telegram.org/bot${token}`;

    // 1) Who am I (bot identity)
    const meRes = await fetch(`${base}/getMe`).then((r) => r.json()).catch(() => ({}));

    // 2) Webhook status
    const whRes = await fetch(`${base}/getWebhookInfo`).then((r) => r.json()).catch(() => ({}));

    // 3) If a chat_id was provided, send the test message and return.
    if (body.send_to_chat_id) {
      const sendRes = await fetch(`${base}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: String(body.send_to_chat_id),
          text: body.text || 'Test message from ERUDITE CRM ✅',
        }),
      }).then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
      return Response.json({ me: meRes?.result, webhook: whRes?.result, sent: sendRes });
    }

    // 4) Temporarily drop the (broken) webhook so getUpdates exposes the pending chat_ids.
    if (body.drop_webhook) {
      await fetch(`${base}/deleteWebhook`).then((r) => r.json()).catch(() => ({}));
    }

    // Re-register the webhook to the live function URL.
    if (body.set_webhook_url) {
      const secret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '';
      const full = body.set_webhook_url + (body.set_webhook_url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(secret);
      const setRes = await fetch(`${base}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: full, allowed_updates: ['message', 'edited_message'], drop_pending_updates: false }),
      }).then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
      const info2 = await fetch(`${base}/getWebhookInfo`).then((r) => r.json()).catch(() => ({}));
      return Response.json({ setWebhook: setRes, webhookInfo: info2?.result });
    }

    // 5) Otherwise pull pending updates to surface chat_ids. This only works if NO webhook
    //    is set (Telegram won't return getUpdates while a webhook is active).
    const updRes = await fetch(`${base}/getUpdates`).then((r) => r.json()).catch(() => ({}));
    const chats = [];
    for (const u of (updRes?.result || [])) {
      const m = u.message || u.edited_message;
      if (!m) continue;
      chats.push({
        chat_id: m.chat?.id,
        from: m.from?.username || `${m.from?.first_name || ''} ${m.from?.last_name || ''}`.trim(),
        text: m.text || m.caption || '[non-text]',
      });
    }

    return Response.json({
      bot: meRes?.result?.username,
      webhook_url: whRes?.result?.url || null,
      webhook_pending: whRes?.result?.pending_update_count ?? null,
      webhook_last_error: whRes?.result?.last_error_message || null,
      pending_chats: chats,
      note: chats.length === 0 && whRes?.result?.url
        ? 'A webhook is active, so getUpdates returns nothing. The chat_id is being delivered to the webhook instead.'
        : undefined,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});