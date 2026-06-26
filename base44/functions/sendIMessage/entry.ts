import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Normalize a phone number to E.164-ish digits with a leading + for iMessage addressing.
function normalizeAddress(raw) {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (trimmed.includes('@')) return trimmed;
  let digits = trimmed.replace(/[^\d+]/g, '');
  if (!digits.startsWith('+')) digits = '+' + digits;
  return digits;
}

// URL detection: matches http(s):// URLs and www. URLs.
// Schemeless bare domains like "eruditeproperty.com" are intentionally NOT matched —
// they stay as plain text in the signature block.
const URL_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/g;
function findUrls(str) {
  return String(str).match(URL_RE) || [];
}

// Slug → destination map (mirrors pages/ShortLinkRedirect.jsx).
const SHORT_LINK_SLUGS = ['ahmad', 'linkedin'];

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

    // Pull the plain-text signature from CompanySettings (single source of truth).
    let signatureText = '';
    try {
      const settings = await base44.asServiceRole.entities.CompanySettings.list('', 1);
      signatureText = settings?.[0]?.imessage_signature_text || '';
    } catch (_) { /* signature is best-effort */ }

    // ──────────────────────────────────────────────────────────────────────
    // BODY ASSEMBLY: text → signature → single short URL (last element)
    //
    // iMessage renders a rich link preview ONLY when the body contains exactly
    // ONE URL. We strip every URL from the agent's text, append the signature
    // (plain text — no clickable URLs), then place the short URL on its own
    // line as the LAST element so iMessage's Private API auto-scraper picks
    // it up and renders the OG card served at /u/:slug.
    // ──────────────────────────────────────────────────────────────────────

    // 1. Start with the agent's message text.
    let messageBody = String(text).trim();

    // 2. Strip ALL URLs from the message text.
    const urlsStripped = findUrls(messageBody);
    if (urlsStripped.length > 0) {
      messageBody = messageBody
        .replace(URL_RE, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      console.log('[sendIMessage] stripped URLs from text:', urlsStripped);
    }

    // 3. Append the signature (plain text — no URLs in the signature block).
    if (signatureText && !body.skip_signature) {
      messageBody = messageBody.trimEnd() + '\n\n' + signatureText;
    }

    // 4. Construct the short URL and append it as the LAST element on its own line.
    let shortUrl = null;
    if (!body.skip_signature) {
      const slug = body.link_slug && SHORT_LINK_SLUGS.includes(body.link_slug)
        ? body.link_slug
        : 'ahmad';
      const appOrigin =
        req.headers.get('origin') ||
        (req.headers.get('referer') ? new URL(req.headers.get('referer')).origin : new URL(req.url).origin);
      shortUrl = `${appOrigin.replace(/\/+$/, '')}/u/${slug}`;
      messageBody = messageBody.trimEnd() + '\n\n' + shortUrl;
    }

    // 5. Final URL count check — enforce exactly one URL.
    let finalUrls = findUrls(messageBody);
    if (finalUrls.length > 1) {
      console.warn('[sendIMessage] WARNING: multiple URLs detected in final body! Stripping all but the short URL.');
      messageBody = messageBody
        .replace(URL_RE, (match) => (match === shortUrl ? match : ''))
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      if (shortUrl) messageBody = messageBody.trimEnd() + '\n\n' + shortUrl;
    }
    finalUrls = findUrls(messageBody);

    // ── Logging ──
    console.log('[sendIMessage] final body:', JSON.stringify(messageBody));
    console.log('[sendIMessage] URL count:', finalUrls.length);
    console.log('[sendIMessage] URLs:', finalUrls);
    console.log('[sendIMessage] short URL:', shortUrl);
    console.log(
      '[sendIMessage] preview metadata: not attached via payload — BlueBubbles REST API has no rich-link field; ' +
        'relying on Private API auto-scraping of the single URL. OG tags served by index.html at /u/:slug'
    );

    // ── BlueBubbles Private API send-text ──
    // The BlueBubbles REST API /api/v1/message/text endpoint does NOT support an
    // explicit rich-link / preview-metadata field. With method: 'private-api',
    // iMessage auto-scrapes the single URL in the body and renders a preview
    // using the OG tags from the target page.
    const sendUrl = `${serverUrl}/api/v1/message/text?password=${encodeURIComponent(password)}`;
    const payload = {
      chatGuid: `iMessage;-;${address}`,
      tempGuid: `crm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message: messageBody,
      method: 'private-api',
    };

    const resp = await fetch(sendUrl, {
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
      // Mirror into the unified Message entity so landlordOrchestrator sees outbound iMessages.
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

    return Response.json({
      success: true,
      address,
      logged,
      guid: data?.data?.guid || null,
      urlCount: finalUrls.length,
      shortUrl,
      previewAttached: false, // BlueBubbles REST API has no rich-link field; relies on Private API auto-scraping
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});