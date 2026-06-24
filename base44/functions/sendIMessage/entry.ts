import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Normalize a phone number to E.164-ish digits with a leading + for iMessage addressing.
function normalizeAddress(raw) {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  // Email address (iMessage to Apple ID) — pass through as-is.
  if (trimmed.includes('@')) return trimmed;
  let digits = trimmed.replace(/[^\d+]/g, '');
  if (!digits.startsWith('+')) digits = '+' + digits;
  return digits;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { landlord_id, text } = body;
    let address = body.address;

    if (!text || !String(text).trim()) {
      return Response.json({ error: 'Message text is required' }, { status: 400 });
    }

    // Resolve the destination address: explicit address wins, else landlord's phone.
    let landlord = null;
    if (landlord_id) {
      landlord = await base44.entities.Landlord.get(landlord_id).catch(() => null);
      if (!address && landlord) address = landlord.phone || landlord.whatsapp;
    }
    if (!address) {
      return Response.json({ error: 'No destination address (phone or Apple ID) found' }, { status: 400 });
    }
    address = normalizeAddress(address);

    const serverUrl = (Deno.env.get('BLUEBUBBLES_SERVER_URL') || '').replace(/\/+$/, '');
    const password = Deno.env.get('BLUEBUBBLES_PASSWORD') || '';
    if (!serverUrl || !password) {
      return Response.json({ error: 'BlueBubbles server is not configured' }, { status: 500 });
    }

    // BlueBubbles Private API send-text endpoint.
    const url = `${serverUrl}/api/v1/message/text?password=${encodeURIComponent(password)}`;
    const payload = {
      chatGuid: `iMessage;-;${address}`,
      tempGuid: `crm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message: String(text),
      method: 'private-api',
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'skip_zrok_interstitial': 'true' },
      body: JSON.stringify(payload),
    });

    const raw = await resp.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = { raw }; }

    if (!resp.ok) {
      return Response.json({
        error: 'BlueBubbles send failed',
        status: resp.status,
        detail: data?.message || data?.error?.message || raw?.slice(0, 500),
      }, { status: 502 });
    }

    // Log the sent message to the conversation stream (best-effort).
    let logged = false;
    if (landlord_id) {
      const nowIso = new Date().toISOString();
      const guid = data?.data?.guid || null;
      try {
        await base44.entities.IMessage.create({
          landlord_id,
          direction: 'outbound',
          address,
          body: String(text),
          status: 'sent',
          sent_at: nowIso,
          agent_email: user.email || null,
          bb_guid: guid,
        });
        logged = true;
      } catch (logErr) {
        logged = false;
      }
      // Mirror into the unified Message entity (direction 'outgoing') so landlordOrchestrator — which
      // reads conversation history ONLY from Message — sees outbound iMessages, exactly as
      // sendMultiChannelWhatsApp does for WhatsApp. Best-effort; never blocks the send response.
      try {
        await base44.asServiceRole.entities.Message.create({
          landlord_id,
          phone: address,
          direction: 'outgoing',
          text: String(text),
          timestamp: nowIso,
          status: 'sent',
          channel: 'imessage',
          wa_message_id: guid || undefined,
        });
      } catch (_) { /* best-effort mirror */ }
    }

    return Response.json({ success: true, address, logged, guid: data?.data?.guid || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});