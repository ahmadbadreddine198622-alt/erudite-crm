import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Two modes:
 * 1. browser_mode=true  → only creates a CallLog + Activity (browser SDK places the actual call)
 * 2. browser_mode=false → server-side click-to-call (Twilio REST dials agent phone then bridges)
 *
 * Body: { lead_id, to_phone, from_phone, lead_name, browser_mode? }
 */

async function getCreds(serviceRole) {
  const list = await serviceRole.entities.TwilioCredential.list();
  const c = list?.[0];
  return {
    sid: c?.account_sid || Deno.env.get('TWILIO_SID'),
    token: c?.auth_token || Deno.env.get('TWILIO_TOKEN'),
    voiceNumber: c?.voice_number || Deno.env.get('TWILIO_VOICE_NUMBER'),
    recordCalls: c?.record_calls ?? true,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Try to get user — but don't fail hard if headers missing (Twilio callbacks won't have them)
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}

    const body = await req.json();
    const { lead_id, to_phone, from_phone, lead_name, browser_mode } = body;
    if (!to_phone) return Response.json({ error: 'to_phone required' }, { status: 400 });

    // Pre-create the CallLog
    const callLog = await base44.asServiceRole.entities.CallLog.create({
      lead_id: lead_id || null,
      direction: 'outbound',
      from_number: from_phone || '',
      to_number: to_phone,
      agent_email: user?.email || '',
      status: 'queued',
      started_at: new Date().toISOString(),
    });

    // Log activity
    if (lead_id) {
      try {
        await base44.asServiceRole.entities.Activity.create({
          lead_id,
          type: 'call',
          title: `Outbound call to ${lead_name || to_phone}`,
          description: browser_mode ? 'Call initiated via browser dialer' : 'Call initiated via Twilio click-to-call',
          source: 'twilio',
          agent_email: user?.email || '',
          metadata: { call_log_id: callLog.id }
        });
      } catch (_) {}
    }

    // Browser mode: return the log ID so the SDK can reference it
    if (browser_mode) {
      return Response.json({ ok: true, call_log_id: callLog.id });
    }

    // ── Server-side REST call (legacy) ──────────────────────────────────────
    const { sid, token, voiceNumber, recordCalls } = await getCreds(base44.asServiceRole);
    if (!sid || !token || !voiceNumber) {
      return Response.json({ error: 'Twilio not configured' }, { status: 500 });
    }

    const callerNumber = from_phone || voiceNumber;
    const baseUrl = new URL(req.url).origin;
    const statusCallback = `${baseUrl}/functions/twilioWebhook?type=status&call_log_id=${callLog.id}`;

    // Dial the lead directly: From = our Twilio number, To = lead's number
    const callBody = new URLSearchParams({
      To: to_phone,
      From: callerNumber,
      StatusCallback: statusCallback,
      StatusCallbackEvent: 'initiated ringing answered completed',
      StatusCallbackMethod: 'POST',
    });
    if (recordCalls) {
      callBody.append('Record', 'true');
      callBody.append('RecordingStatusCallback', `${baseUrl}/functions/twilioWebhook?type=recording&call_log_id=${callLog.id}`);
    }

    const tw = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: callBody,
    });

    if (!tw.ok) {
      const err = await tw.text();
      await base44.asServiceRole.entities.CallLog.update(callLog.id, { status: 'failed' });
      return Response.json({ error: 'Twilio call failed: ' + err }, { status: tw.status });
    }

    const data = await tw.json();
    await base44.asServiceRole.entities.CallLog.update(callLog.id, { twilio_call_sid: data.sid });

    return Response.json({ ok: true, call_sid: data.sid, call_log_id: callLog.id });
  } catch (error) {
    console.error('twilioMakeCall error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});