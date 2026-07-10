// createLandlordGmailDraft — Assemble a branded HTML email (white background,
// black signature + blue Erudite stamp) and create a Gmail DRAFT.
//
// DRAFT ONLY. This function never sends. It only creates a draft in the
// connected Gmail account's Drafts folder using the gmail.compose scope.
//
// Input (JSON):
//   to          (string, required) — recipient email, already chosen by the agent in the UI
//   subject     (string, required)
//   body_native (string, required) — body text in the landlord's language, no signature
//   landlord_id (string, required) — logging/threading context only
//
// Output:
//   { ok: true, draft_id, to, subject }  on success
//   { ok: false, error }                 on failure (non-200)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// White-background brand assets (originals — black signature, blue stamp). Hosted, publicly reachable.
const SIGNATURE_URL = 'https://base44.app/api/apps/69cabceaeeb8bb5e3a62ead3/files/mp/public/69cabceaeeb8bb5e3a62ead3/bb9f3a11f_erudite-signature.png';
const STAMP_URL     = 'https://base44.app/api/apps/69cabceaeeb8bb5e3a62ead3/files/mp/public/69cabceaeeb8bb5e3a62ead3/5db8f82f5_erudite-stamp.png';

const COMPANY = {
  name:    'Erudite Real Estate',
  city:    'Dubai, U.A.E.',
  orn:     '29322',
  phone:   '+971 58 180 6000',
  email:   'info@erudite-estate.com',
  website: 'www.eruditeproperty.com',
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

// Convert plain body text into HTML paragraphs, preserving single line breaks.
function bodyToHtml(text) {
  const escaped = escapeHtml(text).replace(/\r\n/g, '\n');
  return escaped
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 16px;">${para.replace(/\n/g, '<br/>')}</p>`)
    .join('');
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
            <td style="padding:16px 8px 0;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 4px;font-weight:bold;color:#1a2744;font-size:14px;">${COMPANY.name}</p>
              <p style="margin:0 0 4px;color:#475569;font-size:12px;">${COMPANY.city} &nbsp;&bull;&nbsp; ORN ${COMPANY.orn}</p>
              <p style="margin:0;color:#475569;font-size:12px;">
                <a href="mailto:${COMPANY.email}" style="color:#1a2744;text-decoration:none;">${COMPANY.email}</a>
                &nbsp;&bull;&nbsp;
                <a href="tel:${COMPANY.phone.replace(/\s/g, '')}" style="color:#1a2744;text-decoration:none;">${COMPANY.phone}</a>
                &nbsp;&bull;&nbsp;
                <a href="https://${site}" style="color:#1a2744;text-decoration:none;">${site}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Base64url-encode a UTF-8 string (Gmail expects base64url raw RFC 2822).
function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// RFC 2047 encoded-word for non-ASCII subject lines.
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

    // Build the raw RFC 2822 MIME message (HTML only).
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

    // Create a DRAFT — drafts.create only. No send endpoint is ever called.
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: { raw } }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = data?.error?.message || `Gmail draft create failed (${resp.status})`;
      return Response.json({ ok: false, error: msg }, { status: 502 });
    }

    return Response.json({ ok: true, draft_id: data.id, to, subject });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});