import { createClient } from 'npm:@base44/sdk@0.8.31';

/**
 * Makes an outbound Twilio call directly from → to the lead's number.
 * Uses app-level service role (no per-request auth needed).
 *
 * Body: { lead_id, to_phone, from_phone, lead_name, browser_mode? }
 */

const base44 = createClient({ appId: Deno.env.get('BASE44_APP_ID') });

async function getCreds() {
  const list = await base44.asServiceRole.entities.TwilioCredential.list();
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
    const body = await req.json();
    const { lead_id, to_phone, from_phone, lead_name, browser_mode } = body;

    if (!to_phone) return Response.json({ error: 'to_phone required' }, { status: 400 });

    // Get agent email from auth if available
    let agentEmail = '';
    try {
      const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.31');
      const reqClient = createClientFromRequest(req);
      const user = await reqClient.auth.me();
      agentEmail = user?.email || '';
    } catch (_) {}

    // Pre-create the CallLog
    const callLog = await base44.asServiceRole.entities.CallLog.create({
      lead_id: lead_id || null,
      direction: 'outbound',
      from_number: from_phone || '',
      to_number: to_phone,
      agent_email: agentEmail,
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
          description: browser_mode ? 'Call initiated via browser dialer' : 'Call initiated via Twilio',
          source: 'call_log',
          agent_email: agentEmail,
          metadata: { call_log_id: callLog.id }
        });
      } catch (_) {}
    }

    // Browser mode: return the log ID so the SDK places the call
    if (browser_mode) {
      return Response.json({ ok: true, call_log_id: callLog.id });
    }

    // ── Server-side: Twilio REST API dials the number directly ──────────────
    const { sid, token, voiceNumber, recordCalls } = await getCreds();
    if (!sid || !token) {
      return Response.json({ error: 'Twilio credentials not configured. Set them in Twilio Hub → Settings.' }, { status: 500 });
    }

    const callerNumber = from_phone || voiceNumber;
    const baseUrl = new URL(req.url).origin;
    const statusCallback = `${baseUrl}/functions/twilioWebhook?type=status&call_log_id=${callLog.id}`;

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

    const twData = await tw.json();

    if (!tw.ok) {
      console.error('Twilio API error:', twData);
      await base44.asServiceRole.entities.CallLog.update(callLog.id, { status: 'failed' });
      return Response.json({ error: twData?.message || 'Twilio call failed' }, { status: tw.status });
    }

    await base44.asServiceRole.entities.CallLog.update(callLog.id, {
      twilio_call_sid: twData.sid,
      status: twData.status || 'queued',
    });

    console.log(`Call placed: ${twData.sid} from ${callerNumber} to ${to_phone}`);
    return Response.json({ ok: true, call_sid: twData.sid, call_log_id: callLog.id });

  } catch (error) {
    console.error('twilioMakeCall error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});