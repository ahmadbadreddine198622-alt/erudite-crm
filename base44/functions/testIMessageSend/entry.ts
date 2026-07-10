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

  // 2. Create or retrieve chat, then send
  let sendResult = null;
  try {
    // Step A: create/get the chat
    const chatResp = await fetch(`${serverUrl}/api/v1/chat/new?password=${encodeURIComponent(password)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'skip_zrok_interstitial': 'true' },
      body: JSON.stringify({ addresses: [address], service: 'iMessage' }),
      signal: AbortSignal.timeout(20000),
    });
    const chatRaw = await chatResp.text();
    let chatData; try { chatData = JSON.parse(chatRaw); } catch { chatData = null; }
    const chatGuid = chatData?.data?.guid || `iMessage;-;${address}`;

    // Step B: send message into the chat
    const msgResp = await fetch(`${serverUrl}/api/v1/message/text?password=${encodeURIComponent(password)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'skip_zrok_interstitial': 'true' },
      body: JSON.stringify({
        chatGuid,
        tempGuid: `crm-test-${Date.now()}`,
        message: text,
        method: 'private-api',
      }),
      signal: AbortSignal.timeout(30000),
    });
    const msgRaw = await msgResp.text();
    let msgParsed; try { msgParsed = JSON.parse(msgRaw); } catch { msgParsed = null; }
    sendResult = {
      chatGuid,
      chatStatus: chatResp.status,
      status: msgResp.status,
      ok: msgResp.ok,
      guid: msgParsed?.data?.guid || null,
      body: msgRaw.slice(0, 800),
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