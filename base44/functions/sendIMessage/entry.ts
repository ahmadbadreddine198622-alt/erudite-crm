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
    const appOrigin = body.origin || '';

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
      const fallbackOrigin =
        req.headers.get('origin') ||
        (req.headers.get('referer') ? new URL(req.headers.get('referer')).origin : new URL(req.url).origin);
      const origin = appOrigin || fallbackOrigin;
      shortUrl = `${origin.replace(/\/+$/, '')}/u/${slug}`;
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
    // The REST API doesn't expose the ddScannerStrategy flag needed for inline link previews.
    // Solution: send TWO messages — (1) text + signature, (2) URL alone.
    // iMessage auto-generates rich previews for URL-only messages.
    const sendUrl = `${serverUrl}/api/v1/message/text?password=${encodeURIComponent(password)}`;

    // Split the body: text+signature vs the final URL
    const urlMatch = messageBody.match(/\n\n(https?:\/\/[^\s]+)$/);
    let textWithSignature = messageBody;
    let standaloneUrl = null;
    if (urlMatch) {
      standaloneUrl = urlMatch[1];
      textWithSignature = messageBody.slice(0, urlMatch.index).trimEnd();
    }

    // 1. Send text + signature (no URL)
    const payload1 = {
      chatGuid: `iMessage;-;${address}`,
      tempGuid: `crm-${Date.now()}-text`,
      message: textWithSignature,
      method: 'private-api',
    };

    const resp1 = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'skip_zrok_interstitial': 'true' },
      body: JSON.stringify(payload1),
    });

    const raw1 = await resp1.text();
    let data1;
    try { data1 = JSON.parse(raw1); } catch { data1 = { raw: raw1 }; }

    if (!resp1.ok) {
      return Response.json({
        error: 'BlueBubbles send failed (text)',
        status: resp1.status,
        detail: data1?.message || data1?.error?.message || raw1?.slice(0, 500),
      }, { status: 502 });
    }

    // 2. Send URL alone (triggers rich preview)
    let data2 = null;
    if (standaloneUrl) {
      console.log('[sendIMessage] Sending URL as separate message for rich preview:', standaloneUrl);
      const payload2 = {
        chatGuid: `iMessage;-;${address}`,
        tempGuid: `crm-${Date.now()}-url`,
        message: standaloneUrl,
        method: 'private-api',
      };
      const resp2 = await fetch(sendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'skip_zrok_interstitial': 'true' },
        body: JSON.stringify(payload2),
      });
      const raw2 = await resp2.text();
      try { data2 = JSON.parse(raw2); } catch { data2 = { raw: raw2 }; }
      if (!resp2.ok) {
        console.warn('[sendIMessage] URL message send failed:', resp2.status, raw2?.slice(0, 200));
      } else {
        console.log('[sendIMessage] URL message sent successfully, GUID:', data2?.data?.guid);
      }
    }

    // Log the sent message to the conversation stream (best-effort).
    // Combine both parts (text + URL) into one logical record.
    let logged = false;
    if (landlord_id) {
      const nowIso = new Date().toISOString();
      const guid = data1?.data?.guid || null;
      try {
        await base44.entities.IMessage.create({
          landlord_id,
          direction: 'outbound',
          address,
          body: messageBody, // Full combined body for the record
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
      guid: data1?.data?.guid || null,
      urlMessageGuid: data2?.data?.guid || null,
      splitSend: !!standaloneUrl,
      shortUrl,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});