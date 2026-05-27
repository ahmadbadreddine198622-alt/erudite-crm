import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Server-side click-to-call. Initiates a Twilio call FROM the agent's phone
 * (registered on the user record) TO the lead — Twilio bridges the two.
 *
 * Body: { lead_id, to_phone, from_phone?, lead_name? }
 * Returns: { call_sid, call_log_id }
 */

async function getCreds(base44: any) {
  const list = await base44.asServiceRole.entities.TwilioCredential.list();
  const c = list?.[0];
  return {
    sid: c?.account_sid || Deno.env.get('TWILIO_SID'),
    token: c?.auth_token || Deno.env.get('TWILIO_TOKEN'),
    voiceNumber: c?.voice_number || Deno.env.get('TWILIO_VOICE_NUMBER'),
    recordCalls: c?.record_calls ?? true
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lead_id, to_phone, from_phone, lead_name } = await req.json();
    if (!to_phone) return Response.json({ error: 'to_phone required' }, { status: 400 });

    const { sid, token, voiceNumber, recordCalls } = await getCreds(base44);
    if (!sid || !token || !voiceNumber) {
      return Response.json({ error: 'Twilio not configured' }, { status: 500 });
    }

    // Agent phone — fallback to Twilio number if not on profile
    const agentPhone = from_phone || user.phone || voiceNumber;

    // Pre-create the CallLog so the webhook can find it via call_sid update later
    const callLog = await base44.asServiceRole.entities.CallLog.create({
      lead_id,
      direction: 'outbound',
      from_number: agentPhone,
      to_number: to_phone,
      agent_email: user.email,
      status: 'queued',
      started_at: new Date().toISOString()
    });

    // Twilio REST: POST /2010-04-01/Accounts/{sid}/Calls.json
    // We use the "agent connects" pattern: Twilio dials the agent first, then bridges to the lead via TwiML
    const baseUrl = new URL(req.url).origin;
    const statusCallback = `${baseUrl}/functions/twilioWebhook?type=status&call_log_id=${callLog.id}`;
    const twimlUrl = `${baseUrl}/functions/twilioWebhook?type=bridge&to=${encodeURIComponent(to_phone)}&record=${recordCalls ? '1' : '0'}`;

    const body = new URLSearchParams({
      To: agentPhone,
      From: voiceNumber,
      Url: twimlUrl,
      StatusCallback: statusCallback,
      StatusCallbackEvent: 'initiated ringing answered completed',
      StatusCallbackMethod: 'POST'
    });
    if (recordCalls) {
      body.append('Record', 'true');
      body.append('RecordingStatusCallback', `${baseUrl}/functions/twilioWebhook?type=recording&call_log_id=${callLog.id}`);
    }

    const tw = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });

    if (!tw.ok) {
      const err = await tw.text();
      await base44.asServiceRole.entities.CallLog.update(callLog.id, { status: 'failed' });
      return Response.json({ error: 'Twilio call failed: ' + err }, { status: tw.status });
    }

    const data = await tw.json();
    await base44.asServiceRole.entities.CallLog.update(callLog.id, { twilio_call_sid: data.sid });

    // Log activity
    if (lead_id) {
      try {
        await base44.asServiceRole.entities.Activity.create({
          lead_id,
          type: 'call',
          title: `Outbound call to ${lead_name || to_phone}`,
          description: 'Call initiated via Twilio click-to-call',
          source: 'twilio',
          agent_email: user.email,
          metadata: { twilio_call_sid: data.sid, call_log_id: callLog.id }
        });
      } catch (_) { /* non-fatal */ }
    }

    return Response.json({ ok: true, call_sid: data.sid, call_log_id: callLog.id });
  } catch (error: any) {
    console.error('twilioMakeCall error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
