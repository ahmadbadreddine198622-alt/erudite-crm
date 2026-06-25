import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    const convs = await svc.entities.WhatsAppConversation.filter({ channel: 'sameie' });
    const msgs = await svc.entities.WhatsAppMessage.filter({ channel: 'sameie' });

    // Also check messages by conversation_id for the first conv
    let msgsByConvId = [];
    if (convs.length > 0) {
      msgsByConvId = await svc.entities.WhatsAppMessage.filter({ conversation_id: convs[0].id });
    }

    // Check what phones exist in sameie convs
    const sameiePhone = '971522869064';
    const msgsByPhone = await svc.entities.WhatsAppMessage.filter({ from_number: '+' + sameiePhone });

    return Response.json({
      conv_count: convs.length,
      convs: convs.map(c => ({ id: c.id, phone: c.wa_phone_e164, channel: c.channel, last_msg: c.last_message, last_at: c.last_message_at, assigned: c.assigned_agent_email })),
      msg_count_channel_sameie: msgs.length,
      sample_msgs_channel: msgs.slice(0, 5).map(m => ({ id: m.id, conv_id: m.conversation_id, body: m.body?.substring(0,60), channel: m.channel, ts: m.timestamp })),
      msgs_for_first_conv: msgsByConvId.length,
      msgs_from_sameie_phone: msgsByPhone.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});