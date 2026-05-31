import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const pending = await base44.asServiceRole.entities.ScheduledMessage.filter({
      status: 'pending'
    });

    const due = pending.filter(m => m.scheduled_at <= now);
    const results = { sent: 0, failed: 0, skipped: pending.length - due.length };

    for (const msg of due) {
      const phoneNumber = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
      const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumber}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: msg.recipient_phone,
            type: 'text',
            text: { body: msg.message_body }
          })
        }
      );

      if (response.ok) {
        await base44.asServiceRole.entities.ScheduledMessage.update(msg.id, {
          status: 'sent',
          sent_at: new Date().toISOString()
        });
        results.sent++;
      } else {
        const err = await response.json();
        await base44.asServiceRole.entities.ScheduledMessage.update(msg.id, {
          status: 'failed',
          error_message: err?.error?.message || 'Unknown error'
        });
        results.failed++;
      }
    }

    return Response.json({ success: true, ...results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});