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

const SIGNATURE_URL = 'https://base44.app/api/apps/69cabceaeeb8bb5e3a62ead3/files/mp/public/69cabceaeeb8bb5e3a62ead3/bb9f3a11f_erudite-signature.png';
const STAMP_URL     = 'https://base44.app/api/apps/69cabceaeeb8bb5e3a62ead3/files/mp/public/69cabceaeeb8bb5e3a62ead3/5db8f82f5_erudite-stamp.png';
// Full CEO signature banner (the dark Ahmad Badreddine / Erudite card).
const BANNER_URL    = 'https://media.base44.com/images/public/69cabceaeeb8bb5e3a62ead3/d1c825d23_image.png';

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

// A modern, professional "card pill" link — a title plus a sublabel describing what's behind it.
function linkPill(href, title, sub) {
  return `<td style="padding:0 10px 8px 0;vertical-align:top;">
    <a href="${href}" style="display:block;text-decoration:none;background:#f1f5f9;border:1px solid #e2e8f0;border-left:3px solid #1d4ed8;border-radius:8px;padding:7px 12px;min-width:178px;">
      <span style="display:block;color:#1d4ed8;font-size:12.5px;font-weight:700;line-height:1.3;">${title} &rarr;</span>
      <span style="display:block;color:#64748b;font-size:10.5px;font-weight:500;line-height:1.4;margin-top:1px;">${sub}</span>
    </a>
  </td>`;
}

function buildHtml(bodyNative) {
  const site = COMPANY.website.replace(/^https?:\/\//, '');
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
          <tr>
            <td style="padding:8px;">
              <img src="${SIGNATURE_URL}" alt="Signature" width="190" style="display:block;height:auto;max-width:190px;border:0;"/>
              <img src="${STAMP_URL}" alt="${COMPANY.name} stamp" width="96" style="display:block;height:auto;max-width:96px;margin-top:4px;border:0;"/>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 8px 0;border-top:1px solid #e2e8f0;">
              <a href="${COMPANY.website}" style="text-decoration:none;">
                <img src="${BANNER_URL}" alt="${COMPANY.principal} — ${COMPANY.title}, ${COMPANY.name}" width="468" style="display:block;width:100%;max-width:468px;height:auto;border:0;border-radius:8px;"/>
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 8px 0;">
              <p style="margin:0 0 1px;font-weight:bold;color:#1a2744;font-size:15px;">${COMPANY.principal}</p>
              <p style="margin:0 0 6px;color:#475569;font-size:12px;">${COMPANY.title}, ${COMPANY.name} &nbsp;&bull;&nbsp; ORN ${COMPANY.orn}</p>
              <p style="margin:0 0 10px;color:#475569;font-size:12px;line-height:1.7;">
                <a href="tel:${COMPANY.phone.replace(/\s/g, '')}" style="color:#1a2744;text-decoration:none;">${COMPANY.phone}</a>
                &nbsp;&bull;&nbsp;
                <a href="mailto:${COMPANY.email}" style="color:#1a2744;text-decoration:none;">${COMPANY.email}</a>
                <br/>
                ${COMPANY.address}
                &nbsp;&bull;&nbsp;
                <a href="${COMPANY.website}" style="color:#1a2744;text-decoration:none;">${site}</a>
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
                <tr>
                  ${linkPill(COMPANY.links.pf_agent, 'Ahmad on Property Finder', 'SuperAgent · 4.3★ · 56 deals')}
                  ${linkPill(COMPANY.links.pf_broker, 'Erudite Listings', 'All live listings for sale')}
                </tr>
                <tr>
                  ${linkPill(COMPANY.links.team, 'Meet the Team', 'eruditeproperty.com')}
                  ${linkPill(COMPANY.links.instagram, 'Instagram', '@eruditeproperty7')}
                </tr>
                <tr>
                  ${linkPill(COMPANY.links.linkedin, 'LinkedIn', "Ahmad's profile")}
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
    const subject = String(body.subject || '').trim();
    const bodyNative = String(body.body_native || '');
    const landlordId = String(body.landlord_id || '');

    if (!to || !EMAIL_RE.test(to)) {
      return Response.json({ ok: false, error: 'invalid recipient' }, { status: 400 });
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

    const html = buildHtml(bodyNative);

    const mime = [
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
        from_email: user.email || null,
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

    return Response.json({ ok: true, message_id: data.id, thread_id: data.threadId || null, to, subject, delivery });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});