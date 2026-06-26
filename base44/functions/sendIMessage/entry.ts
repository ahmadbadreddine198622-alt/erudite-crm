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

    // ── Build the body: text → optional link → signature ──
    // The link is inserted exactly ONCE. If the caller passes an explicit `link` field,
    // or if the banner URL is available, we append it inline (before the signature) — but
    // ONLY if it doesn't already appear in the message text. This prevents the
    // "URLURL" duplication bug where the same link appears twice.
    let messageBody = String(text).trim();

    // Resolve the link to append (explicit link > banner URL). Validate with new URL().
    let linkToAppend = null;
    const candidateLink = body.link || bannerUrl || '';
    if (candidateLink && !body.skip_signature) {
      const trimmedLink = String(candidateLink).trim();
      try {
        const parsed = new URL(trimmedLink);
        linkToAppend = parsed.toString(); // normalised
      } catch (_) {
        // Invalid URL — abort the send instead of pushing a malformed link.
        return Response.json({
          error: 'Invalid link URL — aborting send to prevent malformed message',
          invalid_url: trimmedLink,
        }, { status: 400 });
      }
    }

    // Guard: only append the link if it is NOT already contained in the message text.
    if (linkToAppend && !messageBody.includes(linkToAppend)) {
      messageBody = messageBody + '\n' + linkToAppend;
    }

    // Append the signature (guard against double-stamping).
    if (signatureText && !body.skip_signature && !messageBody.trimEnd().endsWith(signatureText.trimEnd())) {
      messageBody = messageBody.trimEnd() + '\n\n' + signatureText;
    }

    // Log the final body so we can verify the URL appears exactly once.
    console.log('[sendIMessage] final body:', JSON.stringify(messageBody));
    console.log('[sendIMessage] linkToAppend:', linkToAppend, '| already in text:', linkToAppend ? messageBody.includes(linkToAppend) : 'n/a');

    // First-contact detection: send the branded banner only on the FIRST outbound iMessage to
    // this address. Subsequent messages are text + signature only.
    // NOTE: the banner is now appended INLINE (above), so we no longer send it as a separate
    // bare-URL message — that was the source of the duplication.
    let isFirstContact = false;

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

    // Banner is now appended inline to the body (above), not sent as a separate message.
    // The old separate-bare-URL approach caused the "URLURL" duplication bug.
    const bannerSent = false;

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