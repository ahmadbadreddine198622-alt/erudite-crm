import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * diagBb2 — Diagnostic for the bb2 (Operations Line) BlueBubbles server.
 * Pings bb2 and checks iMessage availability for a given address WITHOUT sending.
 * Admin only.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user = null;
  try { user = await base44.auth.me(); } catch (_) {}
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const address = (body.address || '').trim();
  const serverUrl = (Deno.env.get('BB2_URL') || '').replace(/\/+$/, '');
  const password = Deno.env.get('BB2_PASSWORD') || '';
  if (!serverUrl || !password) {
    return Response.json({ error: 'BB2_URL / BB2_PASSWORD not configured' }, { status: 500 });
  }

  // 1. Ping bb2
  let ping = null;
  try {
    const r = await fetch(`${serverUrl}/api/v1/ping?password=${encodeURIComponent(password)}`, {
      headers: { 'skip_zrok_interstitial': 'true' },
      signal: AbortSignal.timeout(15000),
    });
    ping = { status: r.status, ok: r.ok, body: (await r.text()).slice(0, 300) };
  } catch (e) { ping = { error: e.message }; }

  // 2. Server info
  let info = null;
  try {
    const r = await fetch(`${serverUrl}/api/v1/server/info?password=${encodeURIComponent(password)}`, {
      headers: { 'skip_zrok_interstitial': 'true' },
      signal: AbortSignal.timeout(15000),
    });
    info = { status: r.status, ok: r.ok, body: (await r.text()).slice(0, 500) };
  } catch (e) { info = { error: e.message }; }

  // 3. iMessage availability for the address (no message sent)
  let availability = null;
  if (address && ping?.ok) {
    try {
      const r = await fetch(`${serverUrl}/api/v1/checkAvailability?password=${encodeURIComponent(password)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'skip_zrok_interstitial': 'true' },
        body: JSON.stringify({ addresses: [address] }),
        signal: AbortSignal.timeout(20000),
      });
      availability = { status: r.status, ok: r.ok, body: (await r.text()).slice(0, 600) };
    } catch (e) { availability = { error: e.message }; }
  }

  // 4. Attempt chat/new + send a short diagnostic test message (only if send_test=true)
  let sendTest = null;
  if (address && ping?.ok && body.send_test) {
    const text = body.text || '🧪 Erudite CRM iMessage diagnostic — please ignore.';
    try {
      // chat/new WITH message (BlueBubbles recommended for new conversations)
      const r = await fetch(`${serverUrl}/api/v1/chat/new?password=${encodeURIComponent(password)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'skip_zrok_interstitial': 'true' },
        body: JSON.stringify({ addresses: [address], message: text, tempGuid: `crm-diag-${Date.now()}` }),
        signal: AbortSignal.timeout(30000),
      });
      const raw = await r.text();
      let parsed; try { parsed = JSON.parse(raw); } catch { parsed = null; }
      sendTest = { status: r.status, ok: r.ok, guid: parsed?.data?.guid || null, body: raw.slice(0, 600) };
    } catch (e) { sendTest = { error: e.message }; }
  }

  return Response.json({
    server_url: serverUrl.slice(0, 40) + '…',
    address,
    ping,
    info,
    availability,
    sendTest,
  });
});