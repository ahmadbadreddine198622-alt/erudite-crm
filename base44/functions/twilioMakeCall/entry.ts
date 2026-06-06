import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Simple two-leg call:
 * 1. Twilio calls the agent's real phone
 * 2. When agent picks up, Twilio dials the customer and bridges them
 * 
 * Body: { lead_id, to_phone, from_phone, lead_name }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { lead_id, to_phone, from_phone, lead_name } = body;

    if (!to_phone) return Response.json({ error: 'to_phone required' }, { status: 400 });

    let agentEmail = '';
    try {
      const user = await base44.auth.me();
      agentEmail = user?.email || '';
    } catch (_) {}

    // Load credentials from DB
    const credsList = await base44.asServiceRole.entities.TwilioCredential.list();
    const c = credsList?.[0];
    const sid = c?.account_sid;
    const token = c?.auth_token;
    const voiceNumber = c?.voice_number || from_phone;
    const agentPhone = c?.agent_phone;
    const recordCalls = c?.record_calls ?? true;

    if (!sid || !token) {
      return Response.json({ error: 'Twilio not configured. Go to Twilio Hub → Settings.' }, { status: 400 });
    }
    if (!agentPhone) {
      return Response.json({ error: 'Agent phone not set. Go to Twilio Hub → Settings and enter your mobile number.' }, { status: 400 });
    }
    if (agentPhone === voiceNumber) {
      return Response.json({ error: 'Agent phone cannot be the same as your Twilio number. Enter your real mobile number in Twilio Hub → Settings.' }, { status: 400 });
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

    // Log activity
    if (lead_id) {
      base44.asServiceRole.entities.Activity.create({
        lead_id,
        type: 'call',
        title: `Outbound call to ${lead_name || to_phone}`,
        source: 'call_log',
        agent_email: agentEmail,
        metadata: { call_log_id: callLog.id },
      }).catch(() => {});
    }

    const baseUrl = new URL(req.url).origin;
    const statusCb = `${baseUrl}/functions/twilioWebhook?type=status&call_log_id=${callLog.id}`;
    const recordCb = `${baseUrl}/functions/twilioWebhook?type=recording&call_log_id=${callLog.id}`;

    // TwiML: when agent picks up, immediately dial the customer
    const recordAttr = recordCalls
      ? ` record="record-from-answer" recordingStatusCallback="${recordCb}"`
      : '';

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${voiceNumber}" timeout="30"${recordAttr} action="${statusCb}">
    <Number statusCallback="${statusCb}" statusCallbackEvent="initiated ringing answered completed">${to_phone}</Number>
  </Dial>
</Response>`;

    // Call the agent's phone first, use TwiML to bridge to customer
    const authHeader = `Basic ${btoa(`${sid}:${token}`)}`;
    const callBody = new URLSearchParams({
      To: agentPhone,
      From: voiceNumber,
      Twiml: twiml,
      StatusCallback: statusCb,
      StatusCallbackEvent: 'initiated ringing answered completed',
      StatusCallbackMethod: 'POST',
    });

    const twRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: callBody,
    });

    const twData = await twRes.json();
    console.log('Twilio call response:', twRes.status, JSON.stringify(twData));

    if (!twRes.ok) {
      await base44.asServiceRole.entities.CallLog.update(callLog.id, { status: 'failed' });
      return Response.json({ error: twData?.message || 'Twilio API error' }, { status: 500 });
    }

    await base44.asServiceRole.entities.CallLog.update(callLog.id, {
      twilio_call_sid: twData.sid,
      status: twData.status || 'queued',
    });

    return Response.json({
      ok: true,
      call_sid: twData.sid,
      call_log_id: callLog.id,
    });

  } catch (error) {
    console.error('twilioMakeCall error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});