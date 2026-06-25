import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// One-off test: send a message from the malik_whatsapp Evolution instance
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user = null;
  try { user = await base44.auth.me(); } catch (_) {}
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const apiUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
  const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';

  if (!apiUrl || !apiKey) {
    return Response.json({ error: 'EVOLUTION_API_URL or EVOLUTION_API_KEY not set' }, { status: 500 });
  }

  const instance = 'Malik';
  const number = '971526330035';
  const text = 'Test message from Malik WhatsApp — ERUDITE CRM 👋';

  const sendUrl = `${apiUrl}/message/sendText/${instance}`;
  let status = 0;
  let body = null;

  try {
    const resp = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ number, text }),
    });
    status = resp.status;
    const raw = await resp.text();
    try { body = JSON.parse(raw); } catch { body = raw; }

    if (!resp.ok) {
      return Response.json({ error: 'Evolution send failed', status, body, send_url: sendUrl }, { status: 502 });
    }
  } catch (e) {
    return Response.json({ error: 'Could not reach Evolution API', detail: String(e?.message || e), send_url: sendUrl }, { status: 502 });
  }

  return Response.json({ status: 'ok', evolution_status: status, response: body, sent_to: number, instance });
});