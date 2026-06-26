import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * testIMessageSend — Diagnostic: sends a test iMessage to a specified address
 * (defaults to the BlueBubbles server owner's detected iCloud). Bypasses the
 * normal auth-gated sendIMessage so we can test from the dashboard.
 * Admin only.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let user = null;
  try { user = await base44.auth.me(); } catch (_) {}
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const address = (body.address || 'badreddine2022@icloud.com').trim();
  const text = body.text || '🧪 iMessage test from Erudite CRM — BlueBubbles tunnel is working!';

  const serverUrl = (Deno.env.get('BLUEBUBBLES_SERVER_URL') || '').replace(/\/+$/, '');
  const password = Deno.env.get('BLUEBUBBLES_PASSWORD') || '';
  if (!serverUrl || !password) {
    return Response.json({ error: 'BlueBubbles secrets missing' }, { status: 500 });
  }

  // 1. Check iMessage availability first
  let availability = null;
  try {
    const avResp = await fetch(`${serverUrl}/api/v1/checkAvailability?password=${encodeURIComponent(password)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'skip_zrok_interstitial': 'true' },
      body: JSON.stringify({ addresses: [address] }),
      signal: AbortSignal.timeout(15000),
    });
    availability = { status: avResp.status, ok: avResp.ok, body: (await avResp.text()).slice(0, 500) };
  } catch (e) {
    availability = { error: e.message || String(e) };
  }

  // 2. Send the test message
  const url = `${serverUrl}/api/v1/message/text?password=${encodeURIComponent(password)}`;
  const payload = {
    chatGuid: `iMessage;-;${address}`,
    tempGuid: `crm-test-${Date.now()}`,
    message: text,
    method: 'private-api',
  };

  let sendResult = null;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'skip_zrok_interstitial': 'true' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    const raw = await resp.text();
    let parsed; try { parsed = JSON.parse(raw); } catch { parsed = null; }
    sendResult = {
      status: resp.status,
      ok: resp.ok,
      guid: parsed?.data?.guid || null,
      body: raw.slice(0, 800),
    };
  } catch (e) {
    sendResult = { error: e.message || String(e) };
  }

  return Response.json({
    address,
    availability,
    sendResult,
  });
});