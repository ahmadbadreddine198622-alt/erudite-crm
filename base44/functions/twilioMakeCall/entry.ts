import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Proper two-leg bridge call:
 * 1. Twilio calls agent's real phone number
 * 2. When agent picks up, twilioMakeBridge webhook fires → dials customer → bridges audio
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
    const agentPhone = c?.agent_phone;
    const recordCalls = c?.record_calls ?? true;

    if (!accountSid || !authToken) {
      return Response.json({ error: 'Twilio not configured. Go to Twilio Hub → Settings.' }, { status: 400 });
    }
    if (!agentPhone) {
      return Response.json({ error: 'Agent phone not set. Go to Twilio Hub → Settings and enter your real mobile number (e.g. +971501234567).' }, { status: 400 });
    }
    if (agentPhone === voiceNumber) {
      return Response.json({ error: 'Agent phone cannot be the same as your Twilio number (+' + voiceNumber + '). Enter your personal mobile number in Twilio Hub → Settings.' }, { status: 400 });
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

    // Build URLs
    const baseUrl = new URL(req.url).origin;
    const statusCb = `${baseUrl}/functions/twilioWebhook?type=status&call_log_id=${callLog.id}`;
    // When agent picks up their phone, twilioMakeBridge fires and dials the customer
    const bridgeUrl = `${baseUrl}/functions/twilioMakeBridge?customer=${encodeURIComponent(to_phone)}&caller=${encodeURIComponent(voiceNumber)}&log=${callLog.id}&base=${encodeURIComponent(baseUrl)}&record=${recordCalls}`;

    const authHeader = `Basic ${btoa(`${accountSid}:${authToken}`)}`;

    // Step 1: Call the agent's real phone. On answer → execute bridgeUrl TwiML
    const callParams = new URLSearchParams({
      To: agentPhone,
      From: voiceNumber,
      Url: bridgeUrl,                              // TwiML served by twilioMakeBridge
      Method: 'GET',
      StatusCallback: statusCb,
      StatusCallbackEvent: 'initiated ringing answered completed',
      StatusCallbackMethod: 'POST',
    });

    console.log(`[twilioMakeCall] Calling agent ${agentPhone} → will bridge to customer ${to_phone}`);

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
      agent_phone: agentPhone,
      customer_phone: to_phone,
    });

  } catch (error) {
    console.error('[twilioMakeCall] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});