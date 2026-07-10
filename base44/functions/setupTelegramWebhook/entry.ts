import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// setupTelegramWebhook — one-time (admin) helper to point Telegram at our telegramWebhook
// function and to read the bot's identity. Telegram delivers all inbound messages to the
// registered webhook URL; we attach ?token=<TELEGRAM_WEBHOOK_SECRET> so only Telegram's
// calls are accepted.
//
// Input (JSON): { webhook_url }  — the public URL of the telegramWebhook function
//   (Code → Functions → telegramWebhook → copy the endpoint URL).
// Returns the bot info (so you get the @username for the t.me link) and the setWebhook result.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const token = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
    const secret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '';
    if (!token) return Response.json({ error: 'TELEGRAM_BOT_TOKEN is not set' }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const webhookUrl = (body.webhook_url || '').trim();

    // Always fetch bot identity (gives you the @username for the t.me link).
    const meResp = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const me = await meResp.json().catch(() => ({}));
    const botUsername = me?.result?.username || null;

    let setResult = null;
    if (webhookUrl) {
      const full = webhookUrl + (webhookUrl.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(secret);
      const setResp = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: full, allowed_updates: ['message', 'edited_message'] }),
      });
      setResult = await setResp.json().catch(() => ({}));
    }

    // Current webhook status (for verification).
    const infoResp = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const info = await infoResp.json().catch(() => ({}));

    return Response.json({
      ok: true,
      bot: { username: botUsername, link: botUsername ? `https://t.me/${botUsername}` : null, raw: me?.result || null },
      setWebhook: setResult,
      webhookInfo: info?.result || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});