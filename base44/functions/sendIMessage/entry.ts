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

    // Resolve the destination address. Priority:
    //   1. explicit address from the caller
    //   2. the resolved primary iMessage handle (resolveLandlordIMessage)
    //   3. the landlord's phone / whatsapp (legacy fallback)
    let landlord = null;
    if (landlord_id) {
      landlord = await base44.entities.Landlord.get(landlord_id).catch(() => null);
      if (!address && landlord) address = landlord.imessage_handle || landlord.phone || landlord.whatsapp;
    }
    if (!address) {
      return Response.json({ error: 'No destination address (phone or Apple ID) found' }, { status: 400 });
    }

    // Graceful fallback signal: when the landlord has been resolved and NO handle is
    // iMessage-available, tell the caller so the UI can route to WhatsApp/SMS instead.
    if (landlord && landlord.imessage_resolved_at && !landlord.imessage_handle && !body.address) {
      return Response.json({
        error: 'No iMessage-available handle for this landlord',
        imessage_status: landlord.imessage_status || 'not_available',
        fallback: 'whatsapp',
      }, { status: 409 });
    }

    address = normalizeAddress(address);

    const serverUrl = (Deno.env.get('BLUEBUBBLES_SERVER_URL') || '').replace(/\/+$/, '');
    const password = Deno.env.get('BLUEBUBBLES_PASSWORD') || '';
    if (!serverUrl || !password) {
      return Response.json({ error: 'BlueBubbles server is not configured' }, { status: 500 });
    }

    // Pull the plain-text signature + banner URL from CompanySettings (single source of truth).
    let signatureText = '';
    let bannerUrl = '';
    try {
      const settings = await base44.asServiceRole.entities.CompanySettings.list('', 1);
      signatureText = settings?.[0]?.imessage_signature_text || '';
      bannerUrl = settings?.[0]?.signature_banner_url || '';
    } catch (_) { /* signature/banner are best-effort */ }

    // Append the signature on agent-composed sends (default). Automated callers can pass
    // skip_signature: true to opt out. Guard against double-stamping.
    let messageBody = String(text);
    if (signatureText && !body.skip_signature && !messageBody.trimEnd().endsWith(signatureText.trimEnd())) {
      messageBody = messageBody.trimEnd() + '\n\n' + signatureText;
    }

    // First-contact detection: send the branded banner only on the FIRST outbound iMessage to
    // this address. Subsequent messages are text + signature only.
    let isFirstContact = false;
    if (bannerUrl && !body.skip_signature) {
      try {
        const prior = await base44.asServiceRole.entities.IMessage.filter(
          { address, direction: 'outbound' }, '-sent_at', 1
        );
        isFirstContact = !prior || prior.length === 0;
      } catch (_) { isFirstContact = false; }
    }

    // BlueBubbles Private API send-text endpoint.
    const url = `${serverUrl}/api/v1/message/text?password=${encodeURIComponent(password)}`;
    const payload = {
      chatGuid: `iMessage;-;${address}`,
      tempGuid: `crm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message: messageBody,
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

    // First-contact: forward the branded banner as a multipart attachment (best-effort —
    // never blocks the text send response).
    let bannerSent = false;
    if (isFirstContact && bannerUrl) {
      try {
        const imgResp = await fetch(bannerUrl);
        if (imgResp.ok) {
          const blob = await imgResp.blob();
          const ext = (bannerUrl.split('.').pop() || 'png').split('?')[0].toLowerCase();
          const form = new FormData();
          form.append('chatGuid', `iMessage;-;${address}`);
          form.append('tempGuid', `crm-banner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
          form.append('name', `erudite-banner.${ext}`);
          form.append('method', 'private-api');
          form.append('attachment', blob, `erudite-banner.${ext}`);
          const attResp = await fetch(
            `${serverUrl}/api/v1/message/attachment?password=${encodeURIComponent(password)}`,
            { method: 'POST', headers: { 'skip_zrok_interstitial': 'true' }, body: form }
          );
          bannerSent = attResp.ok;
        }
      } catch (_) { bannerSent = false; }
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
          body: messageBody,
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
          text: messageBody,
          timestamp: nowIso,
          status: 'sent',
          channel: 'imessage',
          wa_message_id: guid || undefined,
        });
      } catch (_) { /* best-effort mirror */ }
    }

    return Response.json({ success: true, address, logged, bannerSent, firstContact: isFirstContact, guid: data?.data?.guid || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});