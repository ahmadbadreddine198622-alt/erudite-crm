import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// telegramConnectSubmit — submits a login code or 2FA password to the relay,
// then checks the login status and updates the TelegramSession accordingly.
//
// Input: { login_id, code (optional), password (optional) }
// If code provided, POSTs to relay "/login/code" with { login_id, code }.
// If password provided, POSTs to relay "/login/password" with { login_id, password }.
// Always includes the X-Relay-Secret header.
// Then GETs relay "/login/status/" + login_id and returns its JSON.
// If status is "complete", updates the current user's TelegramSession to
// status "connected", sets connected_at, and telegram_username from the
// status response. If status is "error", sets status "error".

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const input = await req.json().catch(() => ({}));
    const { login_id, code, password } = input;
    if (!login_id) return Response.json({ error: 'login_id is required' }, { status: 400 });

    const relayUrl = (Deno.env.get('TELEGRAM_RELAY_URL') || '').replace(/\/$/, '');
    const relaySecret = Deno.env.get('TELEGRAM_RELAY_SECRET') || '';
    if (!relayUrl || !relaySecret) {
      return Response.json({ error: 'Telegram relay not configured' }, { status: 500 });
    }

    const headers = { 'Content-Type': 'application/json', 'X-Relay-Secret': relaySecret };

    // Submit code if provided
    if (code && String(code).trim()) {
      await fetch(`${relayUrl}/login/code`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ login_id: String(login_id), code: String(code).trim() }),
      });
    }

    // Submit password if provided
    if (password && String(password).trim()) {
      await fetch(`${relayUrl}/login/password`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ login_id: String(login_id), password: String(password).trim() }),
      });
    }

    // GET status
    const statusResp = await fetch(
      `${relayUrl}/login/status/${encodeURIComponent(String(login_id))}`,
      { headers }
    );
    const statusData = await statusResp.json().catch(() => ({}));

    // Update the TelegramSession based on status
    const existing = await base44.entities.TelegramSession.filter(
      { agent_email: user.email }, '-updated_date', 1
    ).catch(() => []);

    if (existing && existing.length) {
      if (statusData?.status === 'complete' || statusData?.status === 'connected') {
        await base44.entities.TelegramSession.update(existing[0].id, {
          status: 'connected',
          connected_at: new Date().toISOString(),
          telegram_username: statusData?.username || statusData?.telegram_username || existing[0].telegram_username || null,
        });
      } else if (statusData?.status === 'error') {
        await base44.entities.TelegramSession.update(existing[0].id, { status: 'error' });
      }
    }

    return Response.json(statusData || { status: 'unknown' });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});