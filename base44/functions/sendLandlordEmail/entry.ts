// sendLandlordEmail — Send a real email through the agent's own connected Gmail
// account via the Gmail API (messages.send). Enforces gmail_connected on the User
// entity — blocks completely if the agent hasn't connected their Gmail.
//
// Input (JSON):
//   to          (string, required) — recipient email
//   subject     (string, required)
//   body_html   (string, required) — rich HTML body from the composer (signature already appended)
//   landlord_id (string, required) — logging/threading context
//   cc          (string, optional)
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

function encodeSubject(subject) {
  if (/^[\x00-\x7F]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
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
    const fromEmail = userEntity.gmail_address || user.email;

    if (!to || !EMAIL_RE.test(to)) return Response.json({ ok: false, error: 'invalid recipient' }, { status: 400 });
    if (cc && !EMAIL_RE.test(cc)) return Response.json({ ok: false, error: 'invalid CC email' }, { status: 400 });
    if (!subject) return Response.json({ ok: false, error: 'subject is required' }, { status: 400 });
    if (!bodyHtml.trim()) return Response.json({ ok: false, error: 'body is required' }, { status: 400 });
    if (!landlordId) return Response.json({ ok: false, error: 'landlord_id is required' }, { status: 400 });

    // ── Get the agent's own Gmail OAuth token ─────────────────────
    const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(CONNECTOR_ID);
    if (!accessToken) {
      return Response.json({ ok: false, error: 'Gmail token unavailable — reconnect in Profile' }, { status: 403 });
    }

    // ── Build the MIME message ────────────────────────────────────
    const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;padding:0;background:#ffffff;"><div style="max-width:600px;margin:0 auto;padding:24px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1e293b;">${bodyHtml}</div></body></html>`;

    const mime = [
      `From: ${fromEmail}`,
      `To: ${to}`,
      cc ? `Cc: ${cc}` : null,
      `Subject: ${encodeSubject(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      htmlDoc,
    ].filter(Boolean).join('\r\n');

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
      await base44.asServiceRole.entities.Email.create({
        landlord_id: landlordId,
        from_email: fromEmail,
        to_email: to,
        subject,
        body: bodyHtml,
        direction: 'outbound',
        status: 'sent',
        sent_at: new Date().toISOString(),
        agent_email: user.email || null,
        gmail_message_id: data.id || null,
      });
    } catch (_) { /* best-effort log */ }

    // ── Mirror into Message entity for orchestrator visibility ────
    try {
      const plainText = htmlToText(bodyHtml);
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