// checkEmailDeliveryStatus — Poll Gmail for the delivery state of a sent email.
//
// A successful send means Gmail accepted the message. A bounce (recipient
// rejected / mailbox doesn't exist) arrives a short time later as a reply in
// the same thread from "Mail Delivery Subsystem" / mailer-daemon. This function
// inspects the thread and reports whether a bounce has appeared.
//
// Input (JSON):
//   thread_id   (string, required) — Gmail thread id returned by sendLandlordEmail
//   message_id  (string, optional) — the sent message id (to exclude from the bounce scan)
//
// Output:
//   { ok: true, status: 'delivered' | 'bounced' | 'sent', bounce_reason? }
//     - 'sent'      : accepted by Gmail, no bounce seen yet (still in transit)
//     - 'delivered' : no bounce after the thread settled (best-effort inference)
//     - 'bounced'   : a delivery-failure reply is present in the thread

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const BOUNCE_SENDERS = ['mailer-daemon', 'mail delivery subsystem', 'postmaster'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const threadId = String(body.thread_id || '').trim();
    const sentMessageId = String(body.message_id || '').trim();
    if (!threadId) {
      return Response.json({ ok: false, error: 'thread_id is required' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const resp = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const thread = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = thread?.error?.message || `Gmail thread read failed (${resp.status})`;
      return Response.json({ ok: false, error: msg }, { status: 502 });
    }

    const messages = Array.isArray(thread.messages) ? thread.messages : [];
    let bounceReason = null;

    for (const m of messages) {
      if (sentMessageId && m.id === sentMessageId) continue;
      const headers = m?.payload?.headers || [];
      const from = (headers.find(h => h.name?.toLowerCase() === 'from')?.value || '').toLowerCase();
      const subject = (headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '');
      const isBounceSender = BOUNCE_SENDERS.some(s => from.includes(s));
      const looksLikeBounce = /delivery (status notification|failure|incomplete)|undeliverable|failure notice|returned mail/i.test(subject);
      if (isBounceSender || looksLikeBounce) {
        bounceReason = subject || 'Delivery failure reported by mail server';
        break;
      }
    }

    if (bounceReason) {
      return Response.json({ ok: true, status: 'bounced', bounce_reason: bounceReason });
    }

    // No bounce. If the thread has only our sent message, it's still in transit;
    // otherwise (e.g. recipient replied) treat as delivered.
    const status = messages.length > 1 ? 'delivered' : 'sent';
    return Response.json({ ok: true, status });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});