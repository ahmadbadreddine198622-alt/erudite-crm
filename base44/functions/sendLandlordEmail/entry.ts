// sendLandlordEmail — Assemble a branded HTML email (white background,
// black signature + blue Erudite stamp) and SEND it directly via Gmail.
//
// SENDS IMMEDIATELY using the gmail.send scope. Mirror of createLandlordGmailDraft,
// but hits messages.send instead of drafts.create.
//
// Input (JSON):
//   to          (string, required) — recipient email, already chosen by the agent in the UI
//   subject     (string, required)
//   body_native (string, required) — body text in the landlord's language, no signature
//   landlord_id (string, required) — logging/threading context only
//
// Output:
//   { ok: true, message_id, to, subject }  on success
//   { ok: false, error }                    on failure (non-200)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const COMPANY = {
  principal:  'Ahmad Badreddine',
  title:      'CEO',
  name:       'Erudite Real Estate',
  address:    'The Burlington Tower, Business Bay, Dubai, U.A.E.',
  orn:        '29322',
  phone:      '+971 58 180 6000',
  email:      'ahmad@erudite-estate.com',
  website:    'https://eruditeproperty.com',
  // Verify-me / who-we-are links — all clickable in the signature.
  links: {
    team:        'https://eruditeproperty.com/pages-folder/team',
    pf_broker:   'https://www.propertyfinder.ae/en/broker/erudite-real-estate-5308?properties%5Bfilter%5Bcategory_id%5D%5D=1',
    pf_agent:    'https://www.propertyfinder.ae/en/agent/ahmad-badreddine-206264',
    instagram:   'https://www.instagram.com/eruditeproperty7/',
    linkedin:    'https://www.linkedin.com/in/badreddine-ahmad-34b4679b',
  },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bodyToHtml(text) {
  const escaped = escapeHtml(text).replace(/\r\n/g, '\n');
  return escaped
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 16px;">${para.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

// A vibrant brand-colored "card pill" link — accent gradient, emoji glyph, title + sublabel.
// `accent` = { from, to, text } gradient colors; `glyph` = leading emoji icon.
function linkPill(href, title, sub, accent, glyph) {
  return `<td style="padding:0 8px 8px 0;vertical-align:top;">
    <a href="${href}" style="display:block;text-decoration:none;background:linear-gradient(135deg, ${accent.from} 0%, ${accent.to} 100%);border-radius:10px;padding:10px 13px;min-width:186px;box-shadow:0 2px 6px rgba(15,23,42,0.18);">
      <span style="display:block;color:${accent.text};font-size:12.5px;font-weight:700;line-height:1.3;">
        <span style="display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;background:rgba(255,255,255,0.18);border-radius:6px;font-size:12px;margin-right:7px;vertical-align:middle;">${glyph}</span>${title}&nbsp;&rarr;
      </span>
      <span style="display:block;color:${accent.text};opacity:0.78;font-size:10.5px;font-weight:500;line-height:1.4;margin-top:3px;">${sub}</span>
    </a>
  </td>`;
}

function buildHtml(bodyNative, bannerUrl) {
  const site = COMPANY.website.replace(/^https?:\/\//, '');
  const bannerRow = bannerUrl
    ? `<tr>
            <td style="padding:0 8px 14px;">
              <img src="${bannerUrl}" alt="${COMPANY.name}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:8px;"/>
            </td>
          </tr>`
    : '';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1e293b;font-size:15px;line-height:1.6;">
          <tr>
            <td style="padding:0 8px 8px;">
              ${bodyToHtml(bodyNative)}
            </td>
          </tr>
          ${bannerRow}
          <tr>
            <td style="padding:4px 8px 0;border-top:1px solid #e2e8f0;">
              <p style="margin:14px 0 8px;font-size:12px;font-weight:700;color:#b8860b;letter-spacing:0.01em;">🏆 AED 100M+ closed in Peninsula</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
                <tr>
                  ${linkPill(COMPANY.links.pf_agent, 'Ahmad on Property Finder', 'SuperAgent · 4.3★ · 56 deals · AED 100M+', { from: '#1a2744', to: '#2d4060', text: '#ffffff' }, '⭐')}
                  ${linkPill(COMPANY.links.pf_broker, 'Erudite Listings', 'All live listings for sale', { from: '#b8860b', to: '#d4af37', text: '#1a1205' }, '🏛')}
                </tr>
                <tr>
                  ${linkPill(COMPANY.links.team, 'Meet the Team', 'eruditeproperty.com', { from: '#0f766e', to: '#14b8a6', text: '#ffffff' }, '👥')}
                  ${linkPill(COMPANY.links.instagram, 'Instagram', '@eruditeproperty7', { from: '#c026d3', to: '#f43f5e', text: '#ffffff' }, '📸')}
                </tr>
                <tr>
                  ${linkPill(COMPANY.links.linkedin, 'LinkedIn', "Ahmad's profile", { from: '#0a66c2', to: '#378fe9', text: '#ffffff' }, '💼')}
                  <td></td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeSubject(subject) {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const to = String(body.to || '').trim();
    const from = String(body.from || user.email || '').trim();
    const subject = String(body.subject || '').trim();
    const bodyNative = String(body.body_native || '');
    const landlordId = String(body.landlord_id || '');

    if (!to || !EMAIL_RE.test(to)) {
      return Response.json({ ok: false, error: 'invalid recipient' }, { status: 400 });
    }
    if (!from || !EMAIL_RE.test(from)) {
      return Response.json({ ok: false, error: 'invalid from email' }, { status: 400 });
    }
    if (!subject) {
      return Response.json({ ok: false, error: 'subject is required' }, { status: 400 });
    }
    if (!bodyNative.trim()) {
      return Response.json({ ok: false, error: 'body_native is required' }, { status: 400 });
    }
    if (!landlordId) {
      return Response.json({ ok: false, error: 'landlord_id is required' }, { status: 400 });
    }

    // Pull the signature banner URL from CompanySettings — single source of truth.
    let bannerUrl = '';
    try {
      const settings = await base44.asServiceRole.entities.CompanySettings.list('', 1);
      bannerUrl = settings?.[0]?.signature_banner_url || '';
    } catch (_) { /* banner is best-effort */ }

    const html = buildHtml(bodyNative, bannerUrl);

    const mime = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${encodeSubject(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      html,
    ].join('\r\n');

    const raw = toBase64Url(mime);

    // SEND directly — messages.send.
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = data?.error?.message || `Gmail send failed (${resp.status})`;
      return Response.json({ ok: false, error: msg }, { status: 502 });
    }

    // Read the sent message back to confirm Gmail accepted it for delivery.
    // labelIds containing SENT means Gmail queued/handed it off to the recipient's MX.
    let delivery = 'accepted';
    try {
      const getResp = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${data.id}?format=metadata&metadataHeaders=To`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      const msgData = await getResp.json().catch(() => ({}));
      const labels = Array.isArray(msgData.labelIds) ? msgData.labelIds : [];
      if (labels.includes('SENT')) delivery = 'sent';
    } catch (_) { /* best-effort confirmation */ }

    // Best-effort: log the sent email to the Email entity so it appears in the stream.
    try {
      await base44.asServiceRole.entities.Email.create({
        landlord_id: landlordId,
        from_email: from,
        to_email: to,
        subject,
        body: bodyNative,
        direction: 'outbound',
        status: 'sent',
        sent_at: new Date().toISOString(),
        agent_email: user.email || null,
        gmail_message_id: data.id || null,
      });
    } catch (_) { /* best-effort log */ }

    // Mirror into the unified Message entity so landlordOrchestrator — which reads the landlord
    // conversation ONLY from Message — can see emails the agent sends. Same outbound-channel
    // convention as sendMultiChannelWhatsApp / sendWhatsAppMessage (direction 'outgoing', the
    // readable text, a timestamp, channel). landlord_id is required and validated above, so it always
    // links; email here is outbound-only (inbound email is lead-side via handleGmailWebhook), so there
    // is no inbound counterpart to dedupe against. Best-effort + non-fatal — never block the send.
    try {
      await base44.asServiceRole.entities.Message.create({
        landlord_id: landlordId,
        direction: 'outgoing',
        channel: 'email',
        message_type: 'email',
        text: subject ? `${subject}\n\n${bodyNative}` : bodyNative,
        timestamp: new Date().toISOString(),
        status: 'sent',
      });
    } catch (_) { /* best-effort mirror */ }

    return Response.json({ ok: true, message_id: data.id, thread_id: data.threadId || null, to, subject, delivery });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});