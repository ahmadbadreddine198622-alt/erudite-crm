import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Proxies a Twilio recording URL with HTTP Basic Auth (Account SID + Auth Token).
 * Twilio recordings are NOT publicly accessible — the browser <audio> element
 * can't send auth headers, so we fetch server-side and return base64 audio.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { url: recordingUrl } = body;
    if (!recordingUrl) return Response.json({ error: 'url required' }, { status: 400 });

    // Security: only proxy Twilio recording URLs
    if (!/twilio\.com/i.test(recordingUrl)) {
      return Response.json({ error: 'Only Twilio URLs are allowed' }, { status: 400 });
    }

    const creds = await base44.asServiceRole.entities.TwilioCredential.list();
    const c = creds?.[0];
    if (!c?.account_sid || !c?.auth_token) {
      return Response.json({ error: 'Twilio not configured' }, { status: 400 });
    }

    const authHeader = `Basic ${btoa(`${c.account_sid}:${c.auth_token}`)}`;
    const res = await fetch(recordingUrl, { headers: { Authorization: authHeader } });
    if (!res.ok) {
      return Response.json({ error: `Twilio fetch failed: ${res.status}` }, { status: 400 });
    }

    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    const contentType = res.headers.get('content-type') || 'audio/mpeg';
    return Response.json({ base64: `data:${contentType};base64,${base64}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});