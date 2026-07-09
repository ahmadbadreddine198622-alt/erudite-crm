import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Initiates an outbound call via Twilio REST API.
 *
 * HOW IT WORKS (phone bridge — the correct architecture):
 *   1. Twilio calls the agent's real phone (agent_phone, e.g. +971526330035)
 *   2. Agent answers on their mobile
 *   3. Twilio immediately bridges to the customer
 *   4. Both parties talk normally
 *   5. Call is recorded, log is updated
 *
 * browser_mode=true → skips the Twilio REST call; browser SDK handles it directly
 *
 * Body: { lead_id?, landlord_id?, to_phone, from_phone?, lead_name?, browser_mode? }
 */

const PUBLIC_BASE = 'https://dubai-estate-pro.base44.app';

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

    // Load credentials
    const credsList = await base44.asServiceRole.entities.TwilioCredential.list();
    const c = credsList?.[0];
    const voiceNumber = from_phone || c?.voice_number;

    if (!voiceNumber) {
      return Response.json({ error: 'No voice number configured. Go to Twilio Hub → Settings.' }, { status: 400 });
    }

    // ── Browser mode: create log only, browser SDK dials ──────────────────
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

      return Response.json({ ok: true, call_log_id: callLog.id, customer_phone: to_phone });
    }

    // ── Server-side: require credentials ─────────────────────────────────
    if (!c?.account_sid || !c?.auth_token) {
      return Response.json({ error: 'Twilio credentials missing. Configure in Twilio Hub → Settings.' }, { status: 400 });
    }
    if (!c?.agent_phone) {
      return Response.json({ error: 'Agent phone not set. Add your mobile number in Twilio Hub → Settings so Twilio knows which phone to ring.' }, { status: 400 });
    }

    // Create call log BEFORE placing the call
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

    // Callbacks all go to twilioVoiceWebhook (public, no auth required)
    const statusCb = `${PUBLIC_BASE}/functions/twilioVoiceWebhook?type=status&call_log_id=${callLog.id}`;
    const recordCb = `${PUBLIC_BASE}/functions/twilioVoiceWebhook?type=recording&call_log_id=${callLog.id}`;

    // Bridge URL: when agent answers their phone, Twilio executes this TwiML
    // which immediately dials the customer and connects audio
    const bridgeUrl = `${PUBLIC_BASE}/functions/twilioMakeBridge` +
      `?customer=${encodeURIComponent(to_phone)}` +
      `&caller=${encodeURIComponent(voiceNumber)}` +
      `&log=${callLog.id}` +
      `&record=${c.record_calls !== false ? 'true' : 'false'}`;

    // Twilio REST: call agent's phone → when answered → execute bridgeUrl TwiML
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
      return Response.json({
        error: twilioData.message || 'Twilio API error',
        code: twilioData.code,
        details: twilioData,
      }, { status: 400 });
    }

    // Update log with real Twilio SID
    await base44.asServiceRole.entities.CallLog.update(callLog.id, {
      twilio_call_sid: twilioData.sid,
      status: twilioData.status || 'queued',
    });

    // Log activity
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

    console.log(`[twilioMakeCall] ✅ Bridge call started: ${twilioData.sid} → agent ${c.agent_phone} → customer ${to_phone}`);
    return Response.json({
      ok: true,
      call_log_id: callLog.id,
      twilio_call_sid: twilioData.sid,
      message: `📱 Your phone (${c.agent_phone}) is ringing. Answer it — Twilio will connect you to ${to_phone}.`,
    });

  } catch (error) {
    console.error('[twilioMakeCall] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});