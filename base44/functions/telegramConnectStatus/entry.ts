import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// telegramConnectStatus — polls the relay for the current login status and
// updates the TelegramSession when the login completes.
//
// Input: { login_id }
// GETs relay "/login/status/" + login_id with the X-Relay-Secret header and
// returns the JSON. Updates the TelegramSession to "connected" when the
// status is complete (same as telegramConnectSubmit).

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const input = await req.json().catch(() => ({}));
    const { login_id } = input;
    if (!login_id) return Response.json({ error: 'login_id is required' }, { status: 400 });

    const relayUrl = (Deno.env.get('TELEGRAM_RELAY_URL') || '').replace(/\/$/, '');
    const relaySecret = Deno.env.get('TELEGRAM_RELAY_SECRET') || '';
    if (!relayUrl || !relaySecret) {
      return Response.json({ error: 'Telegram relay not configured' }, { status: 500 });
    }

    const statusResp = await fetch(
      `${relayUrl}/login/status/${encodeURIComponent(String(login_id))}`,
      { headers: { 'X-Relay-Secret': relaySecret } }
    );
    const statusData = await statusResp.json().catch(() => ({}));

    // Update the TelegramSession if complete
    if (statusData?.status === 'complete' || statusData?.status === 'connected') {
      const existing = await base44.entities.TelegramSession.filter(
        { agent_email: user.email }, '-updated_date', 1
      ).catch(() => []);

      if (existing && existing.length) {
        await base44.entities.TelegramSession.update(existing[0].id, {
          status: 'connected',
          connected_at: new Date().toISOString(),
          telegram_username: statusData?.username || statusData?.telegram_username || existing[0].telegram_username || null,
        });
      }
    }

    return Response.json(statusData || { status: 'unknown' });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});