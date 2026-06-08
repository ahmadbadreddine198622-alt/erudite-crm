import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Initiates an outbound call.
 *
 * Two modes:
 *   1. browser_mode=true  → just creates CallLog; browser SDK places the actual call
 *   2. browser_mode=false → delegates to twilioVoiceWebhook?type=outbound (server-side REST call)
 *                           Twilio rings agent_phone first, then bridges to customer
 *
 * Body: { lead_id?, landlord_id?, to_phone, from_phone?, lead_name?, browser_mode? }
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
    const { lead_id, landlord_id, to_phone, from_phone, lead_name, browser_mode } = body;

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

    // Browser mode: just create log, browser SDK handles the call
    if (browser_mode) {
      const callLog = await base44.asServiceRole.entities.CallLog.create({
        lead_id: lead_id || null,
        landlord_id: landlord_id || null,
        direction: 'outbound',
        from_number: voiceNumber,
        to_number: to_phone,
        agent_email: agentEmail,
        status: 'queued',
        started_at: new Date().toISOString(),
        twilio_number_used: voiceNumber,
      });

      if (lead_id || landlord_id) {
        base44.asServiceRole.entities.Activity.create({
          lead_id: lead_id || null,
          landlord_id: landlord_id || null,
          type: 'call',
          direction: 'outbound',
          title: `Outbound call to ${lead_name || to_phone}`,
          status: 'in_progress',
          source: 'call_log',
          agent_email: agentEmail,
          metadata: { call_log_id: callLog.id },
        }).catch(() => {});
      }

      console.log(`[twilioMakeCall] Browser call log created for ${to_phone}`);
      return Response.json({ ok: true, call_log_id: callLog.id, customer_phone: to_phone });
    }

    // Server-side call: Twilio rings agent first, then bridges to customer
    if (!c?.account_sid || !c?.auth_token) {
      return Response.json({ error: 'Twilio credentials missing. Configure in Twilio Hub → Settings.' }, { status: 400 });
    }
    if (!c?.agent_phone) {
      return Response.json({ error: 'Agent phone not set. Add your personal mobile in Twilio Hub → Settings.' }, { status: 400 });
    }

    const PUBLIC_BASE = 'https://dubai-estate-pro.base44.app';

    const callLog = await base44.asServiceRole.entities.CallLog.create({
      lead_id: lead_id || null,
      landlord_id: landlord_id || null,
      direction: 'outbound',
      from_number: voiceNumber,
      to_number: to_phone,
      agent_email: agentEmail,
      status: 'queued',
      started_at: new Date().toISOString(),
      twilio_number_used: voiceNumber,
    });

    const statusCb = `${PUBLIC_BASE}/functions/twilioVoiceWebhook?type=status&call_log_id=${callLog.id}`;
    const recordCb = `${PUBLIC_BASE}/functions/twilioVoiceWebhook?type=recording&call_log_id=${callLog.id}`;
    const bridgeUrl = `${PUBLIC_BASE}/functions/twilioMakeBridge?customer=${encodeURIComponent(to_phone)}&caller=${encodeURIComponent(voiceNumber)}&log=${callLog.id}&base=${encodeURIComponent(PUBLIC_BASE)}&record=${c.record_calls !== false ? 'true' : 'false'}`;

    const callParams = new URLSearchParams({
      To: c.agent_phone,
      From: voiceNumber,
      Url: bridgeUrl,
      StatusCallback: statusCb,
      StatusCallbackMethod: 'POST',
      StatusCallbackEvent: 'initiated ringing answered completed',
    });
    if (c.record_calls !== false) {
      callParams.set('RecordingStatusCallback', recordCb);
      callParams.set('RecordingStatusCallbackMethod', 'POST');
    }

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${c.account_sid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${c.account_sid}:${c.auth_token}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: callParams.toString(),
      }
    );

    const twilioData = await twilioRes.json();
    if (!twilioRes.ok) {
      await base44.asServiceRole.entities.CallLog.update(callLog.id, { status: 'failed' });
      console.error('[twilioMakeCall] Twilio API error:', twilioData);
      return Response.json({ error: twilioData.message || 'Twilio error', details: twilioData }, { status: 400 });
    }

    await base44.asServiceRole.entities.CallLog.update(callLog.id, {
      twilio_call_sid: twilioData.sid,
      status: twilioData.status || 'queued',
    });

    if (lead_id || landlord_id) {
      base44.asServiceRole.entities.Activity.create({
        lead_id: lead_id || null,
        landlord_id: landlord_id || null,
        type: 'call',
        direction: 'outbound',
        title: `Outbound call to ${lead_name || to_phone}`,
        status: 'in_progress',
        source: 'call_log',
        agent_email: agentEmail,
        metadata: { call_log_id: callLog.id, twilio_call_sid: twilioData.sid },
      }).catch(() => {});
    }

    console.log(`[twilioMakeCall] Server-side call: ${twilioData.sid} → agent ${c.agent_phone} → customer ${to_phone}`);
    return Response.json({
      ok: true,
      call_log_id: callLog.id,
      twilio_call_sid: twilioData.sid,
      message: `Your phone (${c.agent_phone}) will ring now. When you answer, it will connect to ${to_phone}.`,
    });

  } catch (error) {
    console.error('[twilioMakeCall] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});