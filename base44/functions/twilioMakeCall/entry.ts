import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Creates a CallLog record for browser-based calling.
 * Does NOT place a REST API call — the browser SDK handles the actual calling.
 *
 * Body: { lead_id, to_phone, from_phone, lead_name, browser_mode }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let agentEmail = '';
    try {
      const user = await base44.auth.me();
      agentEmail = user?.email || '';
    } catch (_) {}

    const body = await req.json();
    const { lead_id, to_phone, from_phone, lead_name, browser_mode } = body;

    if (!to_phone) {
      return Response.json({ error: 'to_phone is required' }, { status: 400 });
    }

    // Load credentials from DB
    const credsList = await base44.asServiceRole.entities.TwilioCredential.list();
    const c = credsList?.[0];
    const voiceNumber = c?.voice_number || from_phone;

    if (!voiceNumber) {
      return Response.json({ error: 'No voice number configured. Go to Twilio Hub → Settings.' }, { status: 400 });
    }

    // Pre-create call log for tracking
    const callLog = await base44.asServiceRole.entities.CallLog.create({
      lead_id: lead_id || null,
      direction: 'outbound',
      from_number: voiceNumber,
      to_number: to_phone,
      agent_email: agentEmail,
      status: 'queued',
      started_at: new Date().toISOString(),
      twilio_number_used: voiceNumber,
    });

    // Log activity on lead
    if (lead_id) {
      base44.asServiceRole.entities.Activity.create({
        lead_id,
        type: 'call',
        direction: 'outbound',
        title: `Outbound call to ${lead_name || to_phone}`,
        status: 'in_progress',
        source: 'call_log',
        agent_email: agentEmail,
        metadata: { call_log_id: callLog.id },
      }).catch(() => {});
    }

    console.log(`[twilioMakeCall] Created call log for browser call to ${to_phone} from ${voiceNumber}`);

    return Response.json({
      ok: true,
      call_log_id: callLog.id,
      customer_phone: to_phone,
    });

  } catch (error) {
    console.error('[twilioMakeCall] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});