import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date().toISOString();
    const pending = await base44.asServiceRole.entities.ScheduledMessage.filter({
      status: 'pending'
    });

    const due = pending.filter(m => m.scheduled_at <= now);
    const results = { sent: 0, failed: 0, skipped: pending.length - due.length };

    for (const msg of due) {
      // All scheduled messages go through the API channel — never the personal channel
      const res = await base44.asServiceRole.functions.invoke('sendApiWhatsApp', {
        phone_e164: msg.recipient_phone,
        message: msg.message_body,
      });

      const sent = res?.status === 'sent';
      await base44.asServiceRole.entities.ScheduledMessage.update(msg.id, sent
        ? { status: 'sent', sent_at: new Date().toISOString() }
        : { status: 'failed', error_message: res?.error || 'sendApiWhatsApp failed' }
      );
      if (sent) results.sent++; else results.failed++;
    }

    return Response.json({ success: true, ...results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});