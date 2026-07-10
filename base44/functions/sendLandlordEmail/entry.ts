// sendLandlordEmail — Send a real email through the agent's own connected Gmail
// account via the Gmail API (messages.send). Enforces gmail_connected on the User
// entity — blocks completely if the agent hasn't connected their Gmail.
//
// Input (JSON):
//   to          (string, required) — recipient email
//   subject     (string, required)
//   body_html   (string, required) — rich HTML body from the composer (signature already in the body)
//   landlord_id (string, required) — logging/threading context
//   cc          (string, optional)
//   attachments (array, optional) — [{ url, filename, mime }] files uploaded via UploadFile
//
// Output:
//   { ok: true, message_id, thread_id, to, subject, delivery }
//   { ok: false, error }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CONNECTOR_ID = '6a4907061925b80b469ca3d5';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// MIME base64 must be split into lines of <=76 chars
function chunkBase64(b64) {
  return b64.match(/.{1,76}/g).join('\r\n');
}

function encodeSubject(subject) {
  if (/^[\x00-\x7F]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
}

// RFC 2047 encoded-word for filenames with non-ASCII chars
function encodeFilename(name) {
  if (/^[\x00-\x7F]*$/.test(name)) return name;
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(name)))}?=`;
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// agentCtaHtml — branded CTA link grid built from the agent's profile.
function agentCtaHtml(u = {}) {
  const fullName = u.display_name || u.full_name || '';
  const firstName = fullName.split(' ').filter(Boolean)[0] || fullName || '';
  const hasOwnPf = !!u.pf_profile_url;
  const pfUrl = u.pf_profile_url || 'https://www.propertyfinder.ae/en/agent/ahmad-badreddine-206264';
  const pfRating = u.pf_rating != null ? u.pf_rating : 4.3;
  const pfDeals = u.pf_deals_count != null ? u.pf_deals_count : 56;
  const pfValue = u.pf_deals_value_label || 'AED 100M+';
  const statLabel = u.signature_stat_label || 'AED 100M+ closed in Peninsula';
  const eruditeListingsUrl = u.erudite_listings_url || 'https://www.eruditeproperty.com';
  const meetTeamUrl = u.meet_team_url || 'https://www.eruditeproperty.com';
  const pfTitle = hasOwnPf ? `${firstName} on Property Finder` : 'Ahmad on Property Finder';
  const pfSubtitle = `SuperAgent · ${pfRating}⭐ · ${pfDeals} deals · ${pfValue}`;
  const stat = `<div style="font-family:Arial,Helvetica,sans-serif;color:#C5A059;font-size:13px;font-weight:700;margin:14px 0 10px;">🏆 ${statLabel}</div>`;
  const card = (bg, title, sub, href, darkText, right) => {
    const tc = darkText ? '#1a1205' : '#ffffff';
    const sc = darkText ? '#5a4a1a' : '#dbe6f5';
    const pad = right ? 'padding:0 0 10px 5px;' : 'padding:0 5px 10px 0;';
    return `<td width="50%" valign="top" style="${pad}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="${bg}" style="padding:14px 16px;border-radius:12px;"><a href="${href}" target="_blank" style="text-decoration:none;display:block;"><div style="font-family:Arial,Helvetica,sans-serif;color:${tc};font-size:14px;font-weight:700;">${title}</div><div style="font-family:Arial,Helvetica,sans-serif;color:${sc};font-size:11px;margin-top:3px;">${sub}</div></a></td></tr></table></td>`;
  };
  const cta = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr>${card('#233552', `⭐ ${pfTitle} →`, pfSubtitle, pfUrl, false, false)}${card('#C5A059', '🏛 Erudite Listings →', 'All live listings for sale', eruditeListingsUrl, true, true)}</tr><tr>${card('#10A492', '👥 Meet the Team →', 'eruditeproperty.com', meetTeamUrl, false, false)}${card('#D7338C', '📷 Instagram →', '@eruditeproperty7', 'https://instagram.com/eruditeproperty7', false, true)}</tr></table>`;
  return [stat, cta].filter(Boolean).join('');
}
function agentSignatureHtml(u = {}) {
  const fullName = u.display_name || u.full_name || '';
  const cta = agentCtaHtml(u);
  // Uploaded handwritten signature image (PNG/JPG stored in the agent's Profile).
  const sigImg = u.signature_url
    ? `<img src="${u.signature_url}" alt="${fullName} signature" style="display:block;max-width:280px;max-height:130px;margin:8px 0 8px;border:0;outline:none;text-decoration:none;" />`
    : '';
  // Optional rich-text signature block the agent can author in Profile.
  const richSig = u.email_signature_html ? `<div style="margin:6px 0 10px;">${u.email_signature_html}</div>` : '';
  return `<div style="margin-top:18px;border-top:1px solid #eee;padding-top:14px;font-family:Arial,Helvetica,sans-serif;"><p style="margin:0 0 2px;color:#1e293b;font-size:14px;">Best regards,</p><p style="margin:0 0 2px;color:#1e293b;font-size:15px;font-weight:700;">${fullName || 'Erudite Real Estate'}</p><p style="margin:0 0 10px;color:#C5A059;font-size:13px;font-weight:600;">Erudite Real Estate</p>${sigImg}${richSig}${cta}</div>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    // ── Enforce Gmail connection ──────────────────────────────────
    const users = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const userEntity = users?.[0];
    if (!userEntity?.gmail_connected) {
      return Response.json(
        { ok: false, error: 'Gmail not connected. Connect your email in Profile to send.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const to = String(body.to || '').trim();
    const cc = String(body.cc || '').trim();
    const subject = String(body.subject || '').trim();
    const bodyHtml = String(body.body_html || '');
    const landlordId = String(body.landlord_id || '');
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const fromEmail = userEntity.gmail_address || user.email;
    const fromName = userEntity.display_name || userEntity.full_name || user.display_name || user.full_name || '';

    const toList = String(to).split(',').map((s) => s.trim()).filter(Boolean);
    if (toList.length === 0 || toList.some((e) => !EMAIL_RE.test(e))) return Response.json({ ok: false, error: 'invalid recipient' }, { status: 400 });
    const ccList = cc ? String(cc).split(',').map((s) => s.trim()).filter(Boolean) : [];
    if (ccList.some((e) => !EMAIL_RE.test(e))) return Response.json({ ok: false, error: 'invalid CC email' }, { status: 400 });
    if (!subject) return Response.json({ ok: false, error: 'subject is required' }, { status: 400 });
    if (!bodyHtml.trim()) return Response.json({ ok: false, error: 'body is required' }, { status: 400 });
    if (!landlordId) return Response.json({ ok: false, error: 'landlord_id is required' }, { status: 400 });

    // ── Get the agent's own Gmail OAuth token ─────────────────────
    const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(CONNECTOR_ID);
    if (!accessToken) {
      return Response.json({ ok: false, error: 'Gmail token unavailable — reconnect in Profile' }, { status: 403 });
    }

    // ── Build the HTML document ───────────────────────────────────
    // Ensure every outgoing email carries the agent's branded signature + CTA link grid,
    // even if the composer body didn't already include it.
    const finalBodyHtml = /data-signature="1"/.test(bodyHtml)
      ? bodyHtml
      : bodyHtml + agentSignatureHtml(userEntity || {});
    const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;padding:0;background:#ffffff;text-align:left;"><div style="max-width:600px;margin:0 auto;padding:24px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1e293b;text-align:left;">${finalBodyHtml}</div></body></html>`;

    // ── Build a multipart/mixed MIME message (base64-encoded parts) ──
    // base64 encoding fixes the empty-body/spam issue: the previous 7bit encoding
    // corrupted any non-ASCII byte (em-dashes, Arabic, Russian) in the HTML, so Gmail
    // rendered a blank body and flagged it as spam-like.
    const boundary = 'erudite-' + crypto.randomUUID();
    const fromHeader = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

    const headers = [
      `From: ${fromHeader}`,
      `To: ${to}`,
      cc ? `Cc: ${cc}` : null,
      `Subject: ${encodeSubject(subject)}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ].filter(Boolean).join('\r\n');

    let mime = headers + '\r\n\r\n';

    // HTML part
    const htmlB64 = chunkBase64(bytesToBase64(new TextEncoder().encode(htmlDoc)));
    mime += `--${boundary}\r\n`;
    mime += 'Content-Type: text/html; charset="UTF-8"\r\n';
    mime += 'Content-Transfer-Encoding: base64\r\n\r\n';
    mime += htmlB64 + '\r\n';

    // Attachment parts
    for (const att of attachments) {
      if (!att?.url) continue;
      try {
        const aResp = await fetch(att.url);
        if (!aResp.ok) continue;
        const buf = new Uint8Array(await aResp.arrayBuffer());
        const aB64 = chunkBase64(bytesToBase64(buf));
        const fname = encodeFilename(att.filename || 'attachment');
        const ctype = att.mime || 'application/octet-stream';
        mime += `--${boundary}\r\n`;
        mime += `Content-Type: ${ctype}; name="${fname}"\r\n`;
        mime += 'Content-Transfer-Encoding: base64\r\n';
        mime += `Content-Disposition: attachment; filename="${fname}"\r\n\r\n`;
        mime += aB64 + '\r\n';
      } catch (e) {
        console.warn('attachment fetch failed', att?.url, e?.message || e);
      }
    }

    mime += `--${boundary}--\r\n`;

    const raw = toBase64Url(mime);

    // ── Send via Gmail API ────────────────────────────────────────
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

    // ── Confirm Gmail accepted it ─────────────────────────────────
    let delivery = 'accepted';
    try {
      const getResp = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${data.id}?format=metadata&metadataHeaders=To`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      const msgData = await getResp.json().catch(() => ({}));
      const labels = Array.isArray(msgData.labelIds) ? msgData.labelIds : [];
      if (labels.includes('SENT')) delivery = 'sent';
    } catch (_) { /* best-effort */ }

    // ── Log to Email entity ───────────────────────────────────────
    try {
      // Email entity schema fields: to / body_html / body_text / received_at (NOT to_email/body/sent_at).
      // Writing the wrong field names meant sent emails never matched the landlord's Email list query.
      const plainBody = htmlToText(finalBodyHtml);
      await base44.asServiceRole.entities.Email.create({
        gmail_message_id: data.id || null,
        gmail_thread_id: data.threadId || null,
        landlord_id: landlordId || null,
        direction: 'outbound',
        from_email: fromEmail,
        from_name: fromName,
        to,
        subject,
        body_html: finalBodyHtml,
        body_text: plainBody,
        snippet: plainBody.slice(0, 200),
        received_at: new Date().toISOString(),
      });
    } catch (_) { /* best-effort log */ }

    // ── Mirror into Message entity for orchestrator visibility ────
    try {
      const plainText = htmlToText(finalBodyHtml);
      await base44.asServiceRole.entities.Message.create({
        landlord_id: landlordId,
        direction: 'outgoing',
        channel: 'email',
        message_type: 'email',
        text: subject ? `${subject}\n\n${plainText}` : plainText,
        timestamp: new Date().toISOString(),
        status: 'sent',
      });
    } catch (_) { /* best-effort mirror */ }

    return Response.json({
      ok: true,
      message_id: data.id,
      thread_id: data.threadId || null,
      to,
      subject,
      delivery,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});