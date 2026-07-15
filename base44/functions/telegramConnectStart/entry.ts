import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// telegramConnectStart — starts a Telegram login flow via the relay.
//
// Input: { phone }
// POSTs to TELEGRAM_RELAY_URL + "/login/start" with X-Relay-Secret header
// and JSON { phone, label: current user's full_name }. On success, upserts a
// TelegramSession record for the current user's email with the returned
// session_id, phone, status "connecting". Returns { login_id, session_id }.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const input = await req.json().catch(() => ({}));
    const { phone } = input;
    if (!phone || !String(phone).trim()) {
      return Response.json({ error: 'phone is required' }, { status: 400 });
    }

    const relayUrl = (Deno.env.get('TELEGRAM_RELAY_URL') || '').replace(/\/$/, '');
    const relaySecret = Deno.env.get('TELEGRAM_RELAY_SECRET') || '';
    if (!relayUrl || !relaySecret) {
      return Response.json({ error: 'Telegram relay not configured' }, { status: 500 });
    }

    const cleanPhone = String(phone).trim();
    const digits = cleanPhone.replace(/[^0-9]/g, '');

    // First attempt — let the relay generate the default session_id (tg_<digits>)
    let relayResp = await fetch(`${relayUrl}/login/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Relay-Secret': relaySecret },
      body: JSON.stringify({ phone: cleanPhone, label: user.full_name || user.email }),
    });
    let relayData = await relayResp.json().catch(() => ({}));

    // If the relay says this session is already connected, retry with a
    // unique session_id suffix so the relay creates a fresh session.
    if ((!relayResp.ok || relayData?.error) && /already connected/i.test(relayData?.error || '')) {
      const uniqueSuffix = Date.now().toString(36);
      relayResp = await fetch(`${relayUrl}/login/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Relay-Secret': relaySecret },
        body: JSON.stringify({
          phone: cleanPhone,
          label: user.full_name || user.email,
          session_id: `tg_${digits}_${uniqueSuffix}`,
        }),
      });
      relayData = await relayResp.json().catch(() => ({}));
    }

    if (!relayResp.ok || relayData?.error) {
      return Response.json(
        { error: relayData?.error || `Relay returned ${relayResp.status}` },
        { status: 502 }
      );
    }

    const sessionId = relayData?.session_id ? String(relayData.session_id) : '';
    const loginId = relayData?.login_id ? String(relayData.login_id) : null;

    // Upsert TelegramSession for the current user
    const existing = await base44.entities.TelegramSession.filter(
      { agent_email: user.email }, '-updated_date', 1
    ).catch(() => []);

    if (existing && existing.length) {
      await base44.entities.TelegramSession.update(existing[0].id, {
        session_id: sessionId || existing[0].session_id,
        login_id: loginId || existing[0].login_id,
        phone: String(phone).trim(),
        label: user.full_name || user.email,
        status: 'connecting',
        connected_at: null,
        telegram_username: null,
      });
    } else {
      await base44.entities.TelegramSession.create({
        agent_email: user.email,
        session_id: sessionId,
        login_id: loginId,
        phone: String(phone).trim(),
        label: user.full_name || user.email,
        status: 'connecting',
      });
    }

    return Response.json({ login_id: loginId, session_id: sessionId });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});