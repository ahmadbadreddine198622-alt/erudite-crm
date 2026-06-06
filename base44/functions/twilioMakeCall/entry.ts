import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Direct outbound call: Twilio dials the customer directly.
 * No bridge, no agent phone needed.
 * The TwiML URL simply dials the customer — Twilio connects the call.
 *
 * Body: { lead_id, to_phone, from_phone, lead_name }
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
    const { lead_id, to_phone, from_phone, lead_name } = body;

    if (!to_phone) {
      return Response.json({ error: 'to_phone is required' }, { status: 400 });
    }

    // Load credentials from DB
    const credsList = await base44.asServiceRole.entities.TwilioCredential.list();
    const c = credsList?.[0];
    const accountSid = c?.account_sid;
    const authToken = c?.auth_token;
    const voiceNumber = c?.voice_number || from_phone;
    const recordCalls = c?.record_calls ?? true;

    if (!accountSid || !authToken) {
      return Response.json({ error: 'Twilio not configured. Go to Twilio Hub → Settings.' }, { status: 400 });
    }
    if (!voiceNumber) {
      return Response.json({ error: 'No voice number configured. Go to Twilio Hub → Settings.' }, { status: 400 });
    }

    // Pre-create call log
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

    const baseUrl = new URL(req.url).origin;
    const statusCb = `${baseUrl}/functions/twilioWebhook?type=status&call_log_id=${callLog.id}`;
    const recordCb = `${baseUrl}/functions/twilioWebhook?type=recording&call_log_id=${callLog.id}`;

    // Build TwiML inline — dials the customer directly, no bridge
    const recordAttr = recordCalls
      ? ` record="record-from-answer-dual" recordingStatusCallback="${recordCb}" recordingStatusCallbackMethod="POST"`
      : '';

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${voiceNumber}" timeout="30" timeLimit="14400"${recordAttr} action="${statusCb}" method="POST">
    <Number statusCallback="${statusCb}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">${to_phone}</Number>
  </Dial>
</Response>`;

    const authHeader = `Basic ${btoa(`${accountSid}:${authToken}`)}`;

    // Inline TwiML — pass it directly so no webhook is needed
    const callParams = new URLSearchParams({
      To: to_phone,
      From: voiceNumber,
      Twiml: twiml,
      StatusCallback: statusCb,
      StatusCallbackEvent: 'initiated ringing answered completed',
      StatusCallbackMethod: 'POST',
    });

    console.log(`[twilioMakeCall] Calling customer ${to_phone} directly from ${voiceNumber}`);

    const twRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: callParams,
      }
    );

    const twData = await twRes.json();
    console.log(`[twilioMakeCall] Twilio response: ${twRes.status}`, JSON.stringify(twData));

    if (!twRes.ok) {
      await base44.asServiceRole.entities.CallLog.update(callLog.id, { status: 'failed' });
      return Response.json({ error: twData?.message || `Twilio API error: ${twRes.status}` }, { status: 500 });
    }

    await base44.asServiceRole.entities.CallLog.update(callLog.id, {
      twilio_call_sid: twData.sid,
      status: twData.status || 'queued',
    });

    return Response.json({
      ok: true,
      call_sid: twData.sid,
      call_log_id: callLog.id,
      customer_phone: to_phone,
    });

  } catch (error) {
    console.error('[twilioMakeCall] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});