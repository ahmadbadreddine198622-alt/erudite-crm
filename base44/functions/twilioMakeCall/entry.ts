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
    const baseUrl = new URL(req.url).origin;
    const statusCallback = `${baseUrl}/functions/twilioWebhook?type=status&call_log_id=${callLog.id}`;

    const callBody = new URLSearchParams({
      To: to_phone,
      From: callerNumber,
      Twiml: `<Response><Say>Connecting your call.</Say><Dial>${to_phone}</Dial></Response>`,
      StatusCallback: statusCallback,
      StatusCallbackEvent: 'initiated ringing answered completed',
      StatusCallbackMethod: 'POST',
    });

    if (recordCalls) {
      callBody.append('Record', 'true');
      callBody.append('RecordingStatusCallback', `${baseUrl}/functions/twilioWebhook?type=recording&call_log_id=${callLog.id}`);
    }

    console.log('Calling Twilio API:', { to: to_phone, from: callerNumber });

    const tw = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: callBody,
    });

    const twData = await tw.json();
    console.log('Twilio response:', tw.status, JSON.stringify(twData));

    if (!tw.ok) {
      await base44.asServiceRole.entities.CallLog.update(callLog.id, { status: 'failed' });
      return Response.json({ error: twData?.message || 'Twilio call failed' }, { status: 500 });
    }

    await base44.asServiceRole.entities.CallLog.update(callLog.id, {
      twilio_call_sid: twData.sid,
      status: twData.status || 'queued',
    });

    return Response.json({ ok: true, call_sid: twData.sid, call_log_id: callLog.id });

  } catch (error) {
    console.error('twilioMakeCall error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});