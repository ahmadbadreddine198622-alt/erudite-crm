import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * sendApiWhatsApp — Central API-channel send function (erudite/Meta, +971582806000)
 *
 * Rules enforced:
 * [Rule 3] 24h window: freeform messages rejected if no inbound in last 24h → status blocked_window
 * [Rule 4] message_kind field: freeform (window-gated) | template (window-exempt)
 * [Rule 7] Retry: callers pass retry_count; after 1 retry, logs to Notification alert, no personal-channel fallback
 * [Rule 8] Quiet hours: 21:00–09:00 Dubai time → returns { status: 'queued_quiet' } — callers must defer
 *
 * This function is for AUTOMATIONS ONLY. Human sends go through sendEvolutionMessage (personal channel).
 *
 * Payload:
 *   phone          - digits-only recipient phone
 *   message        - text body
 *   message_kind   - 'freeform' (default) | 'template'
 *   template_name  - required if message_kind='template'
 *   scheduled_message_id - optional, for status tracking
 *   retry_count    - how many times already retried (0 = first attempt)
 *   skip_quiet_check - internal flag for operator digests
 */

const DUBAI_TZ_OFFSET = 4; // UTC+4

function isDubaiQuietHours() {
  const now = new Date();
  const dubaiHour = (now.getUTCHours() + DUBAI_TZ_OFFSET) % 24;
  return dubaiHour >= 21 || dubaiHour < 9;
}

function toDigits(raw) {
  return String(raw || '').replace(/\D/g, '');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;

  let body = {};
  try { body = await req.json(); } catch (_) {}

  const {
    phone,
    message,
    message_kind = 'freeform',
    template_name,
    scheduled_message_id,
    retry_count = 0,
    skip_quiet_check = false,
  } = body;

  if (!phone || !message) {
    return Response.json({ error: 'phone and message are required' }, { status: 400 });
  }

  const digitsPhone = toDigits(phone);

  // ── Rule 8: Quiet hours (external recipients only) ────────────────────────
  if (!skip_quiet_check && isDubaiQuietHours()) {
    console.log(`[sendApiWhatsApp] QUIET HOURS — queuing message to ${digitsPhone}`);
    return Response.json({ status: 'queued_quiet', phone: digitsPhone });
  }

  // ── Rule 3 & 4: 24h window check (freeform only) ─────────────────────────
  if (message_kind === 'freeform') {
    // Find last inbound on API channel (ApiInboxMessage or WhatsAppMessage inbound)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recent = await svc.entities.ApiInboxMessage.filter({ sender_phone: digitsPhone });
    const hasRecentInbound = recent.some(m => m.received_at >= cutoff);

    if (!hasRecentInbound) {
      console.log(`[sendApiWhatsApp] BLOCKED — no inbound from ${digitsPhone} in last 24h`);
      return Response.json({
        status: 'blocked_window',
        phone: digitsPhone,
        reason: 'No inbound message from recipient in last 24 hours. Use a template message instead.',
      });
    }
  }

  // ── Send via Meta Cloud API ───────────────────────────────────────────────
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

  if (!phoneNumberId || !accessToken) {
    return Response.json({ error: 'Meta API credentials not configured' }, { status: 500 });
  }

  let payload;
  if (message_kind === 'template' && template_name) {
    payload = {
      messaging_product: 'whatsapp',
      to: digitsPhone,
      type: 'template',
      template: { name: template_name, language: { code: 'en_US' }, components: [] },
    };
  } else {
    payload = {
      messaging_product: 'whatsapp',
      to: digitsPhone,
      type: 'text',
      text: { body: message },
    };
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    const errMsg = data?.error?.message || JSON.stringify(data);
    console.error(`[sendApiWhatsApp] Meta API error (retry_count=${retry_count}):`, errMsg);

    // ── Rule 7: Retry once after 5 min, then alert ────────────────────────
    if (retry_count === 0) {
      // Signal caller to retry in 5 minutes
      return Response.json({ status: 'retry_needed', retry_after_minutes: 5, error: errMsg });
    } else {
      // Second failure → log to Notifications as alert
      await svc.entities.Notification.create({
        title: '⚠️ API WhatsApp send failed after retry',
        body: `Failed to send to ${digitsPhone}: ${errMsg}`,
        type: 'alert',
        is_read: false,
      }).catch(() => {});
      return Response.json({ status: 'failed', error: errMsg });
    }
  }

  const waMessageId = data.messages?.[0]?.id || '';
  console.log(`[sendApiWhatsApp] Sent to ${digitsPhone} kind=${message_kind} wa_id=${waMessageId}`);

  return Response.json({ status: 'sent', wa_message_id: waMessageId, phone: digitsPhone });
});