import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// setupTelegram — one-time (admin) setup + status check for the Telegram bot.
//
// Run it once after the bot token is set. It:
//   1. Reads the bot's identity (getMe) so you get the @username for the t.me share link.
//   2. Registers the inbound webhook with Telegram (setWebhook) pointing at telegramWebhook,
//      secured with TELEGRAM_WEBHOOK_SECRET in the URL.
//   3. Returns the current webhook status (getWebhookInfo) for verification.
//
// The webhook URL is derived from this function's own request URL (same functions host),
// so it always points at the right deployment. Admin-only.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const token = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
    const secret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '';
    if (!token) return Response.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 });

    const api = (method) => `https://api.telegram.org/bot${token}/${method}`;

    // 1) Bot identity → @username for the share link.
    const meResp = await fetch(api('getMe'));
    const me = await meResp.json().catch(() => ({}));
    if (!me?.ok) return Response.json({ error: 'getMe failed', detail: me?.description }, { status: 502 });
    const botUsername = me.result?.username || '';

    // 2) Register the webhook. Derive the host from this request; swap the function name.
    const here = new URL(req.url);
    const webhookUrl = `${here.origin}${here.pathname.replace(/setupTelegram$/, 'telegramWebhook')}` +
      (secret ? `?token=${encodeURIComponent(secret)}` : '');

    const setResp = await fetch(api('setWebhook'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'edited_message'],
        drop_pending_updates: true,
      }),
    });
    const setData = await setResp.json().catch(() => ({}));

    // 3) Verify.
    const infoResp = await fetch(api('getWebhookInfo'));
    const info = await infoResp.json().catch(() => ({}));

    return Response.json({
      ok: true,
      bot_username: botUsername,
      share_link: botUsername ? `https://t.me/${botUsername}` : null,
      webhook_set: !!setData?.ok,
      webhook_url: webhookUrl,
      webhook_info: info?.result || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});