import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * processDueScheduledMessages — processes pending ScheduledMessages via the API channel.
 *
 * Rules enforced (via sendApiWhatsApp):
 * [Rule 3] 24h window checked per recipient
 * [Rule 4] message_kind (freeform/template) passed through
 * [Rule 7] retry_needed response triggers retry_at scheduling; after 2nd failure → alert
 * [Rule 8] Quiet hours → status set to queued_quiet, re-scheduled to 09:00 Dubai
 */

const DUBAI_TZ_OFFSET = 4;

function nextNineAM() {
  const now = new Date();
  const dubaiNow = new Date(now.getTime() + DUBAI_TZ_OFFSET * 3600000);
  const next9 = new Date(dubaiNow);
  next9.setUTCHours(9 - DUBAI_TZ_OFFSET, 0, 0, 0); // 09:00 Dubai = 05:00 UTC
  if (next9 <= dubaiNow) next9.setUTCDate(next9.getUTCDate() + 1);
  return next9.toISOString();
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Admin only' }, { status: 403 });
  }

  const svc = base44.asServiceRole;
  const now = new Date().toISOString();

  // Pick up pending + retry-ready messages
  const allPending = await svc.entities.ScheduledMessage.filter({ status: 'pending' });
  const retryReady = await svc.entities.ScheduledMessage.filter({ status: 'failed' });

  const due = allPending.filter(m => m.scheduled_at <= now);
  const retrying = retryReady.filter(m => m.retry_at && m.retry_at <= now && (m.retry_count || 0) < 2);
  const toProcess = [...due, ...retrying];

  const results = { sent: 0, blocked_window: 0, queued_quiet: 0, retry_scheduled: 0, failed: 0, skipped: allPending.length - due.length };

  for (const msg of toProcess) {
    const res = await svc.functions.invoke('sendApiWhatsApp', {
      phone: msg.recipient_phone,
      message: msg.message_body,
      message_kind: msg.message_kind || 'freeform',
      template_name: msg.template_name,
      scheduled_message_id: msg.id,
      retry_count: msg.retry_count || 0,
    });

    const result = res?.data || res;
    const status = result?.status;

    if (status === 'sent') {
      await svc.entities.ScheduledMessage.update(msg.id, { status: 'sent', sent_at: new Date().toISOString() });
      results.sent++;

    } else if (status === 'blocked_window') {
      // Rule 3: surface in alert, mark blocked
      await svc.entities.ScheduledMessage.update(msg.id, {
        status: 'blocked_window',
        error_message: result.reason || '24h window expired — use a template'
      });
      await svc.entities.Notification.create({
        title: '⚠️ Scheduled message blocked — outside 24h window',
        body: `Could not send to ${msg.recipient_phone} (${msg.recipient_name || 'unknown'}): no inbound in 24h. Switch to a template or wait for reply.`,
        type: 'alert',
        is_read: false,
      }).catch(() => {});
      results.blocked_window++;

    } else if (status === 'queued_quiet') {
      // Rule 8: reschedule to 09:00 Dubai
      await svc.entities.ScheduledMessage.update(msg.id, {
        scheduled_at: nextNineAM(),
        status: 'pending',
        error_message: 'Deferred: quiet hours (21:00–09:00 Dubai)'
      });
      results.queued_quiet++;

    } else if (status === 'retry_needed') {
      // Rule 7: schedule one retry in 5 min
      const retryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await svc.entities.ScheduledMessage.update(msg.id, {
        status: 'failed',
        retry_at: retryAt,
        retry_count: (msg.retry_count || 0) + 1,
        error_message: result.error || 'Send failed — retry in 5 min'
      });
      results.retry_scheduled++;

    } else {
      // Rule 7: second failure already alerted inside sendApiWhatsApp
      await svc.entities.ScheduledMessage.update(msg.id, {
        status: 'failed',
        error_message: result.error || 'Unknown failure'
      });
      results.failed++;
    }
  }

  return Response.json({ success: true, processed: toProcess.length, ...results });
});