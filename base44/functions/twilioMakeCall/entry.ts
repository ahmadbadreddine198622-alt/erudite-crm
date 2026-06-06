import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Makes an outbound Twilio call from → to the lead's number.
 * Uses asServiceRole so it works regardless of auth headers.
 *
 * Body: { lead_id, to_phone, from_phone, lead_name, browser_mode? }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { lead_id, to_phone, from_phone, lead_name, browser_mode } = body;

    console.log('twilioMakeCall called:', { lead_id, to_phone, from_phone, browser_mode });

    if (!to_phone) return Response.json({ error: 'to_phone required' }, { status: 400 });

    // Get agent email if authenticated
    let agentEmail = '';
    try {
      const user = await base44.auth.me();
      agentEmail = user?.email || '';
    } catch (_) {}

    // Load Twilio creds from DB
    const credsList = await base44.asServiceRole.entities.TwilioCredential.list();
    const c = credsList?.[0];
    const sid = c?.account_sid || Deno.env.get('TWILIO_SID');
    const token = c?.auth_token || Deno.env.get('TWILIO_TOKEN');
    const voiceNumber = c?.voice_number || Deno.env.get('TWILIO_VOICE_NUMBER');
    const recordCalls = c?.record_calls ?? true;

    console.log('Creds loaded:', { hasSid: !!sid, hasToken: !!token, voiceNumber });

    // Pre-create CallLog
    const callLog = await base44.asServiceRole.entities.CallLog.create({
      lead_id: lead_id || null,
      direction: 'outbound',
      from_number: from_phone || voiceNumber || '',
      to_number: to_phone,
      agent_email: agentEmail,
      status: 'queued',
      started_at: new Date().toISOString(),
    });

    console.log('CallLog created:', callLog.id);

    // Log activity
    if (lead_id) {
      try {
        await base44.asServiceRole.entities.Activity.create({
          lead_id,
          type: 'call',
          title: `Outbound call to ${lead_name || to_phone}`,
          source: 'call_log',
          agent_email: agentEmail,
          metadata: { call_log_id: callLog.id }
        });
      } catch (e) {
        console.log('Activity log skipped:', e.message);
      }
    }

    // Browser mode: just return the log ID — SDK places the call via TwiML app
    if (browser_mode) {
      return Response.json({ ok: true, call_log_id: callLog.id });
    }

    // Server-side: use Twilio REST API to dial directly
    if (!sid || !token) {
      return Response.json({ error: 'Twilio credentials not configured. Please set them in Twilio Hub → Settings.' }, { status: 500 });
    }

    const callerNumber = from_phone || voiceNumber;
    const agentPhone = c?.agent_phone || null;
    const baseUrl = new URL(req.url).origin;
    const statusCallback = `${baseUrl}/functions/twilioWebhook?type=status&call_log_id=${callLog.id}`;
    const recordingCallback = `${baseUrl}/functions/twilioWebhook?type=recording&call_log_id=${callLog.id}`;

    if (!agentPhone) {
      await base44.asServiceRole.entities.CallLog.update(callLog.id, { status: 'failed' });
      return Response.json({
        error: 'Agent phone not configured. Please go to Twilio Hub → Settings and enter your mobile number in "Agent Phone Number". This is required for two-way audio.'
      }, { status: 400 });
    }

    // Two-leg conference bridge:
    // 1. Twilio calls the AGENT's phone
    // 2. Agent answers → joins a named conference room
    // 3. Twilio simultaneously calls the CUSTOMER → joins the same conference room
    // Both parties can hear each other through the conference
    const confName = `call_${callLog.id}`;
    const recordAttrs = recordCalls
      ? ` record="record-from-start" recordingStatusCallback="${recordingCallback}"`
      : '';

    // TwiML for agent leg: join conference
    const agentTwiml = `<Response><Say>Connecting your call now.</Say><Dial><Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false"${recordAttrs}>${confName}</Conference></Dial></Response>`;

    // TwiML for customer leg: join same conference (waits for agent)
    const customerTwiml = `<Response><Dial><Conference startConferenceOnEnter="false" endConferenceOnExit="true" beep="false">${confName}</Conference></Dial></Response>`;

    const callBody = new URLSearchParams({
      StatusCallback: statusCallback,
      StatusCallbackEvent: 'initiated ringing answered completed',
      StatusCallbackMethod: 'POST',
    });

    console.log('Calling Twilio API (conference bridge):', { agent: agentPhone, customer: to_phone, conf: confName });

    const authHeader = `Basic ${btoa(`${sid}:${token}`)}`;

    // Leg 1: Call agent's phone → join conference as host
    const agentBody = new URLSearchParams({
      To: agentPhone,
      From: callerNumber,
      Twiml: agentTwiml,
      StatusCallback: statusCallback,
      StatusCallbackEvent: 'initiated ringing answered completed',
      StatusCallbackMethod: 'POST',
    });

    const twAgent = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: agentBody,
    });
    const agentData = await twAgent.json();
    console.log('Agent leg response:', twAgent.status, agentData?.sid, agentData?.status);

    if (!twAgent.ok) {
      await base44.asServiceRole.entities.CallLog.update(callLog.id, { status: 'failed' });
      return Response.json({ error: agentData?.message || 'Failed to call agent phone' }, { status: 500 });
    }

    // Leg 2: Call customer's phone → join same conference
    const customerBody = new URLSearchParams({
      To: to_phone,
      From: callerNumber,
      Twiml: customerTwiml,
    });

    const twCustomer = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: customerBody,
    });
    const customerData = await twCustomer.json();
    console.log('Customer leg response:', twCustomer.status, customerData?.sid, customerData?.status);

    if (!twCustomer.ok) {
      await base44.asServiceRole.entities.CallLog.update(callLog.id, { status: 'failed' });
      return Response.json({ error: customerData?.message || 'Failed to call customer' }, { status: 500 });
    }

    await base44.asServiceRole.entities.CallLog.update(callLog.id, {
      twilio_call_sid: agentData.sid,
      status: agentData.status || 'queued',
    });

    return Response.json({ ok: true, call_sid: agentData.sid, call_log_id: callLog.id });

  } catch (error) {
    console.error('twilioMakeCall error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});