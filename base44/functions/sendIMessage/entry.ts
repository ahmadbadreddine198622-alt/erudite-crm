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
const URL_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/g;
function findUrls(str) {
  return String(str).match(URL_RE) || [];
}

// Fetch image and convert to base64 in chunks (avoids stack overflow)
async function fetchImageAsBase64(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const contentType = resp.headers.get('content-type') || 'image/png';
    const arrayBuffer = await resp.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const CHUNK_SIZE = 0x8000;
    let base64 = '';
    for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
      const chunk = uint8Array.subarray(i, i + CHUNK_SIZE);
      base64 += btoa(String.fromCharCode(...chunk));
    }
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error('[fetchImageAsBase64] error:', error);
    return null;
  }
}

// Send an image attachment via BlueBubbles. Returns true on success.
async function sendBlueBubblesAttachment(serverUrl, password, address, base64, name = 'attachment.png') {
  try {
    const attachUrl = `${serverUrl}/api/v1/message/attachment?password=${encodeURIComponent(password)}`;
    const payload = {
      chatGuid: `iMessage;-;${address}`,
      tempGuid: `crm-att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      attachment: base64,
      name,
      method: 'private-api',
    };
    const resp = await fetch(attachUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'skip_zrok_interstitial': 'true' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const raw = await resp.text();
      console.warn('[sendBlueBubblesAttachment] failed:', raw.slice(0, 300));
    }
    return resp.ok;
  } catch (e) {
    console.error('[sendBlueBubblesAttachment] error:', e);
    return false;
  }
}

// Slug → destination map
const SHORT_LINK_SLUGS = ['ahmad', 'linkedin'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { landlord_id, text } = body;
    const attachment = body.attachment || null; // { file_url, file_name, media_type }
    let address = body.address;
    const appOrigin = body.origin || '';
    // iMessage server instance — bb2 = Operations Line (second server); bb1 = Erudite Main.
    // Routing is enforced below: bb1 is Ahmad-only, every other agent is forced to bb2.
    let instance = body.instance === 'bb2' ? 'bb2' : 'bb1';

    if ((!text || !String(text).trim()) && !attachment) {
      return Response.json({ error: 'Message text or attachment is required' }, { status: 400 });
    }

    // Resolve destination address
    let landlord = null;
    if (landlord_id) {
      landlord = await base44.entities.Landlord.get(landlord_id).catch(() => null);
      if (!address && landlord) address = landlord.imessage_handle || landlord.phone || landlord.whatsapp;
    }
    if (!address) {
      return Response.json({ error: 'No destination address (phone or Apple ID) found' }, { status: 400 });
    }

    // Fallback signal — only block when we've explicitly confirmed iMessage is NOT available.
    // (imessage_handle is often empty even when imessage_status is 'available', since the
    // phone-based availability check never populates it — don't use it to gate sending.)
    if (landlord && landlord.imessage_status === 'not_available' && !body.address) {
      return Response.json({
        error: 'No iMessage-available handle for this landlord',
        imessage_status: landlord.imessage_status,
        fallback: 'whatsapp',
      }, { status: 409 });
    }

    address = normalizeAddress(address);

    // Route to the correct BlueBubbles server by caller: Ahmad's two emails use the
    // primary server (his Apple ID); every other agent uses the secondary server.
    const AHMAD_EMAILS = new Set(['ahmad@erudite-estate.com', 'ahmad.badreddine198622@gmail.com']);
    const isAhmad = AHMAD_EMAILS.has(String(user.email || '').toLowerCase());
    // bb1 (Erudite Main) is Ahmad-only. Every other agent is routed to bb2 (Operations Line)
    // regardless of the requested instance — non-Ahmad callers cannot send via bb1.
    const useBb2 = instance === 'bb2' || !isAhmad;
    instance = useBb2 ? 'bb2' : 'bb1';
    let serverUrl, password;
    if (useBb2) {
      serverUrl = (Deno.env.get('BB2_URL') || '').replace(/\/+$/, '');
      password = Deno.env.get('BB2_PASSWORD') || '';
    } else {
      serverUrl = (Deno.env.get('BLUEBUBBLES_SERVER_URL') || '').replace(/\/+$/, '');
      password = Deno.env.get('BLUEBUBBLES_PASSWORD') || '';
    }
    if (!serverUrl || !password) {
      return Response.json({ error: useBb2 ? 'BlueBubbles bb2 server is not configured (BB2_URL / BB2_PASSWORD)' : 'BlueBubbles server is not configured' }, { status: 500 });
    }

    // Get plain-text signature (no image — never included in iMessage)
    let signatureText = '';
    try {
      const settings = await base44.asServiceRole.entities.CompanySettings.list('', 1);
      signatureText = settings?.[0]?.imessage_signature_text || '';
    } catch (_) { /* best-effort */ }

    const hasText = !!(text && String(text).trim());
    // Build message body: text + signature + ONE short URL
    let messageBody = hasText ? String(text).trim() : '';
    
    // Strip any URLs from the original text (we'll add our own short link)
    const urlsStripped = findUrls(messageBody);
    if (urlsStripped.length > 0) {
      messageBody = messageBody
        .replace(URL_RE, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    // Add plain-text signature (no HTML, just text)
    if (hasText && signatureText && !body.skip_signature) {
      messageBody = messageBody.trimEnd() + '\n\n' + signatureText;
    }

    // Append the branded CTA URL. eruditeproperty.com is already in the signature
    // text, so we only append the Property Finder agent-profile link here (avoids
    // the duplicate URL the user reported).
    // Ahmad's hardcoded Property Finder agent link is personal branding — only append
    // it when the sender is Ahmad. Other agents send plain text (no auto CTA).
    let shortUrl = null;
    if (hasText && !body.skip_signature && isAhmad) {
      const fixedUrls = ['https://www.propertyfinder.ae/en/agent/ahmad-badreddine-206264'];
      messageBody = messageBody.trimEnd() + '\n\n' + fixedUrls.join('\n');
      shortUrl = fixedUrls[0];
    }

    console.log('[sendIMessage] final body:', JSON.stringify(messageBody));

    let data = null;
    if (hasText) {
      // Send text message via BlueBubbles.
      // Strategy: try private-api first (preferred, works for existing chats). If it
      // fails with "Chat does not exist!" (new recipient), fall back to chat/new WITH
      // a message — on macOS Big Sur+ this creates the chat AND sends the message in
      // one call, which is the BlueBubbles-recommended way to start a new conversation.
      const sendUrl = `${serverUrl}/api/v1/message/text?password=${encodeURIComponent(password)}`;
      const tempGuid = `crm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const payload = {
        chatGuid: `iMessage;-;${address}`,
        tempGuid,
        message: messageBody,
        method: 'private-api',
      };

      let resp = await fetch(sendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'skip_zrok_interstitial': 'true' },
        body: JSON.stringify(payload),
      });

      let raw = await resp.text();
      try { data = JSON.parse(raw); } catch { data = { raw }; }

      // New recipient — private-api can't find the chat. Use chat/new WITH a message
      // to create the conversation and send the text in a single call.
      if (!resp.ok) {
        const errMsg = data?.error?.message || data?.message || '';
        if (errMsg.includes('Chat does not exist') || errMsg.includes('Message Send Error')) {
          console.warn('[sendIMessage] private-api failed, trying chat/new with message...');
          const chatNewUrl = `${serverUrl}/api/v1/chat/new?password=${encodeURIComponent(password)}`;
          const chatResp = await fetch(chatNewUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'skip_zrok_interstitial': 'true' },
            body: JSON.stringify({
              addresses: [address],
              message: messageBody,
              tempGuid: `crm-new-${tempGuid}`,
            }),
          });
          const chatRaw = await chatResp.text();
          let chatData;
          try { chatData = JSON.parse(chatRaw); } catch { chatData = { raw: chatRaw }; }
          console.log('[sendIMessage] chat/new status:', chatResp.status, chatRaw.slice(0, 200));

          if (chatResp.ok) {
            resp = chatResp;
            raw = chatRaw;
            data = chatData;
          } else {
            return Response.json({
              error: 'BlueBubbles send failed',
              status: chatResp.status,
              detail: chatData?.message || chatData?.error?.message || chatRaw?.slice(0, 500),
            }, { status: 502 });
          }
        } else {
          return Response.json({
            error: 'BlueBubbles send failed',
            status: resp.status,
            detail: errMsg || raw?.slice(0, 500),
          }, { status: 502 });
        }
      }
    }

    // ── USER ATTACHMENT (e.g. voice note) ──
    let attachmentSent = false;
    if (attachment && attachment.file_url) {
      try {
        const attBase64 = await fetchImageAsBase64(attachment.file_url);
        if (attBase64) {
          const attName = attachment.file_name || (attachment.media_type === 'audio' ? 'voice-note.m4a' : 'attachment');
          attachmentSent = await sendBlueBubblesAttachment(serverUrl, password, address, attBase64, attName);
          if (!attachmentSent) console.warn('[sendIMessage] user attachment failed to send');
        }
      } catch (attErr) {
        console.error('[sendIMessage] attachment error:', attErr);
      }
    }

    // ── BANNER ATTACHMENT (first contact only) ──
    let bannerSent = false;
    if (landlord_id && !body.skip_banner && !landlord?.imessage_banner_sent) {
      try {
        const settings = await base44.asServiceRole.entities.CompanySettings.list('', 1);
        const bannerUrl = settings?.[0]?.signature_banner_url;
        if (bannerUrl) {
          console.log('[sendIMessage] fetching banner for attachment:', bannerUrl);
          const bannerBase64 = await fetchImageAsBase64(bannerUrl);
          if (bannerBase64) {
            bannerSent = await sendBlueBubblesAttachment(serverUrl, password, address, bannerBase64, 'banner.png');
            if (bannerSent) {
              console.log('[sendIMessage] banner attached successfully');
              await base44.entities.Landlord.update(landlord_id, { imessage_banner_sent: true });
            }
          }
        } else {
          console.warn('[sendIMessage] no signature_banner_url in CompanySettings');
        }
      } catch (bannerErr) {
        console.error('[sendIMessage] banner attach error:', bannerErr);
      }
    }

    // Log the message
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
          instance,
        });
        logged = true;
      } catch (_) { logged = false; }
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
          agent_email: user.email || null,
        });
      } catch (_) { /* best-effort */ }

      // BRAIN V4 P3 LEARN: outcome ledger (non-fatal). The composer sends once per confirmed
      // handle — recordOutcomeEvent's 10-min same-text fan-out guard collapses those to ONE
      // draft_sent event. Signature/CTA appended above is tolerated by containment matching.
      try {
        await base44.asServiceRole.functions.invoke('recordOutcomeEvent', {
          landlord_id,
          kind: 'draft_sent',
          channel: 'imessage',
          source_ref: guid ? `IMessage:${guid}` : `IMessage:${landlord_id}:${nowIso}`,
          text: messageBody,
          sent_at: nowIso,
          writer_email: user.email || null,
        }).catch(() => {});
      } catch (_) { /* ledger must never break a send */ }
    }

    return Response.json({
      success: true,
      address,
      logged,
      guid: data?.data?.guid || null,
      shortUrl,
      bannerSent,
      attachmentSent,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});