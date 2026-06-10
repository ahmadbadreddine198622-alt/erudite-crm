import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * TwiML App Voice URL — called by Twilio when the browser SDK places a call.
 * Receives: To (the number to dial), CallerId (our Twilio number)
 * Returns TwiML that dials the destination number.
 *
 * Also handles status callbacks to update CallLog.
 * Also handles server-side outbound calls (type=outbound) via Twilio REST API.
 */

const PUBLIC_BASE = 'https://dubai-estate-pro.base44.app';

async function getCreds(serviceRole) {
  const list = await serviceRole.entities.TwilioCredential.list();
  const c = list?.[0];
  return {
    sid: c?.account_sid,
    token: c?.auth_token,
    voiceNumber: c?.voice_number,
    agentPhone: c?.agent_phone,
    recordCalls: c?.record_calls ?? true,
    apiKeySid: c?.api_key_sid,
    apiKeySecret: c?.api_key_secret,
    twimlAppSid: c?.twiml_app_sid,
  };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const serviceRole = base44.asServiceRole;
  const url = new URL(req.url);
  const type = url.searchParams.get('type') || 'dial';

  // ── Status callback from Twilio (no auth needed — Twilio POST) ──────────
  if (type === 'status') {
    try {
      let params;
      const ct = req.headers.get('content-type') || '';
      if (ct.includes('application/x-www-form-urlencoded')) {
        params = new URLSearchParams(await req.text());
      } else {
        params = new URLSearchParams();
      }
      const callSid = params.get('CallSid') || '';
      const status = params.get('CallStatus') || params.get('DialCallStatus') || '';
      const duration = params.get('CallDuration') || params.get('DialCallDuration') || '';
      const toNumber = params.get('To') || '';
      const fromNumber = params.get('From') || '';
      let callLogId = url.searchParams.get('call_log_id') || '';

      console.log(`[twilioVoiceWebhook] status: callSid=${callSid} status=${status} duration=${duration}`);

      // Always try to find by callSid first
      if (callSid) {
        const logs = await serviceRole.entities.CallLog.filter({ twilio_call_sid: callSid }).catch(() => []);
        if (logs?.[0]) callLogId = logs[0].id;
      }

      // If no existing log (browser call), create one now from the status callback
      if (!callLogId && callSid && toNumber && status !== 'initiated') {
        try {
          const newLog = await serviceRole.entities.CallLog.create({
            twilio_call_sid: callSid,
            direction: 'outbound',
            from_number: fromNumber,
            to_number: toNumber,
            status: status || 'queued',
            started_at: new Date().toISOString(),
            twilio_number_used: fromNumber,
          });
          callLogId = newLog.id;
          console.log(`[twilioVoiceWebhook] ✅ Auto-created CallLog id=${callLogId} for sid=${callSid}`);
        } catch (createErr) {
          console.warn('[twilioVoiceWebhook] auto-create log failed:', createErr?.message);
        }
      }

      if (callLogId && status) {
        const update = { status };
        if (callSid) update.twilio_call_sid = callSid;
        if (duration) update.duration_seconds = parseInt(duration, 10);
        if (['completed', 'failed', 'busy', 'no-answer'].includes(status)) {
          update.ended_at = new Date().toISOString();
        }
        await serviceRole.entities.CallLog.update(callLogId, update);
        console.log(`[twilioVoiceWebhook] ✅ Status updated: ${status} for log ${callLogId}`);
      } else {
        console.warn(`[twilioVoiceWebhook] status: no logId (callSid=${callSid}) or no status`);
      }
    } catch (err) {
      console.error('[twilioVoiceWebhook] status error:', err.message);
    }
    return new Response('', { status: 200 });
  }

  // ── Recording callback ───────────────────────────────────────────────────
  if (type === 'recording') {
    try {
      let params;
      const ct = req.headers.get('content-type') || '';
      if (ct.includes('application/x-www-form-urlencoded')) {
        params = new URLSearchParams(await req.text());
      } else {
        params = new URLSearchParams();
      }
      const recordingUrl = params.get('RecordingUrl') || '';
      const callSid = params.get('CallSid') || '';
      let callLogId = url.searchParams.get('call_log_id') || '';

      console.log(`[twilioVoiceWebhook] recording: callSid=${callSid} url=${recordingUrl} logId=${callLogId}`);

      if (!callLogId && callSid) {
        const logs = await serviceRole.entities.CallLog.filter({ twilio_call_sid: callSid });
        if (logs?.[0]) callLogId = logs[0].id;
      }

      if (callLogId && recordingUrl) {
        const mp3Url = recordingUrl + '.mp3';
        await serviceRole.entities.CallLog.update(callLogId, { recording_url: mp3Url });
        console.log(`[twilioVoiceWebhook] ✅ Recording saved: ${mp3Url} for log ${callLogId}`);

        // Backfill Activity with recording link (works for both lead_id and landlord_id)
        const logRecords = await serviceRole.entities.CallLog.filter({ id: callLogId });
        const callLog = logRecords?.[0];
        const entityField = callLog?.lead_id ? 'lead_id' : callLog?.landlord_id ? 'landlord_id' : null;
        const entityId = callLog?.lead_id || callLog?.landlord_id;
        if (entityField && entityId) {
          const activities = await serviceRole.entities.Activity.filter({ [entityField]: entityId, type: 'call' });
          const activity = activities?.find(a => a.metadata?.call_log_id === callLogId);
          if (activity) {
            await serviceRole.entities.Activity.update(activity.id, {
              status: 'completed',
              completed_at: new Date().toISOString(),
              description: (activity.description || '') + `\n\n🎙️ [Listen to recording](${mp3Url})`,
              attachments: [...(activity.attachments || []), { file_url: mp3Url, file_name: 'call_recording.mp3', file_type: 'audio/mpeg' }],
              metadata: { ...activity.metadata, recording_url: mp3Url }
            });
          }
        }
      } else {
        console.warn(`[twilioVoiceWebhook] recording: missing logId or recordingUrl`);
      }
    } catch (err) {
      console.error('[twilioVoiceWebhook] recording error:', err.message);
    }
    return new Response('', { status: 200 });
  }

  // ── Server-side outbound call via Twilio REST API ────────────────────────
  // Used when agent_phone is set — Twilio calls agent first, then bridges to customer
  if (type === 'outbound') {
    try {
      const base44auth = createClientFromRequest(req);
      let agentEmail = '';
      try {
        const user = await base44auth.auth.me();
        agentEmail = user?.email || '';
      } catch (_) {}

      const body = await req.json().catch(() => ({}));
      const { to_phone, lead_id, landlord_id, lead_name } = body;

      if (!to_phone) {
        return Response.json({ error: 'to_phone is required' }, { status: 400 });
      }

      const creds = await getCreds(serviceRole);
      if (!creds.sid || !creds.token) {
        return Response.json({ error: 'Twilio not configured' }, { status: 400 });
      }
      if (!creds.voiceNumber) {
        return Response.json({ error: 'No voice number configured in Twilio Hub → Settings' }, { status: 400 });
      }
      if (!creds.agentPhone) {
        return Response.json({ error: 'Agent phone not configured. Add your personal mobile in Twilio Hub → Settings.' }, { status: 400 });
      }

      // Create call log first
      const callLog = await serviceRole.entities.CallLog.create({
        lead_id: lead_id || null,
        landlord_id: landlord_id || null,
        direction: 'outbound',
        from_number: creds.voiceNumber,
        to_number: to_phone,
        agent_email: agentEmail,
        status: 'queued',
        started_at: new Date().toISOString(),
        twilio_number_used: creds.voiceNumber,
      });

      const statusCb = `${PUBLIC_BASE}/functions/twilioVoiceWebhook?type=status&call_log_id=${callLog.id}`;
      const recordCb = `${PUBLIC_BASE}/functions/twilioVoiceWebhook?type=recording&call_log_id=${callLog.id}`;
      const bridgeUrl = `${PUBLIC_BASE}/functions/twilioMakeBridge?customer=${encodeURIComponent(to_phone)}&caller=${encodeURIComponent(creds.voiceNumber)}&log=${callLog.id}&base=${encodeURIComponent(PUBLIC_BASE)}&record=${creds.recordCalls ? 'true' : 'false'}`;

      // Twilio calls agent_phone first, when answered → bridges to customer
      const callParams = new URLSearchParams({
        To: creds.agentPhone,
        From: creds.voiceNumber,
        Url: bridgeUrl,
        StatusCallback: statusCb,
        StatusCallbackMethod: 'POST',
        StatusCallbackEvent: 'initiated ringing answered completed',
      });
      if (creds.recordCalls) {
        callParams.set('RecordingStatusCallback', recordCb);
        callParams.set('RecordingStatusCallbackMethod', 'POST');
      }

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${creds.sid}/Calls.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${creds.sid}:${creds.token}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: callParams.toString(),
        }
      );

      const twilioData = await twilioRes.json();
      if (!twilioRes.ok) {
        await serviceRole.entities.CallLog.update(callLog.id, { status: 'failed' });
        return Response.json({ error: twilioData.message || 'Twilio API error', twilio: twilioData }, { status: 400 });
      }

      // Update log with Twilio SID
      await serviceRole.entities.CallLog.update(callLog.id, {
        twilio_call_sid: twilioData.sid,
        status: twilioData.status || 'queued',
      });

      // Log activity
      const entityId = lead_id || landlord_id;
      const entityType = lead_id ? 'lead_id' : landlord_id ? 'landlord_id' : null;
      if (entityId && entityType) {
        serviceRole.entities.Activity.create({
          [entityType]: entityId,
          lead_id: lead_id || null,
          type: 'call',
          direction: 'outbound',
          title: `Outbound call to ${lead_name || to_phone}`,
          status: 'in_progress',
          source: 'call_log',
          agent_email: agentEmail,
          metadata: { call_log_id: callLog.id, twilio_call_sid: twilioData.sid },
        }).catch(() => {});
      }

      console.log(`[twilioVoiceWebhook] Outbound call initiated: ${twilioData.sid} → agent ${creds.agentPhone} → customer ${to_phone}`);
      return Response.json({
        ok: true,
        call_log_id: callLog.id,
        twilio_call_sid: twilioData.sid,
        message: `Calling your phone (${creds.agentPhone})… when you answer it will connect to ${to_phone}`,
      });

    } catch (error) {
      console.error('[twilioVoiceWebhook] outbound error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  // ── Main TwiML dial handler (browser SDK calls only) ────────────────────
  try {
    // Parse form body from Twilio browser SDK (application/x-www-form-urlencoded)
    let formParams = new URLSearchParams();
    try {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/x-www-form-urlencoded')) {
        formParams = new URLSearchParams(await req.text());
      }
    } catch (_) {}

    const to = formParams.get('To') || url.searchParams.get('To') || '';
    const callSid = formParams.get('CallSid') || '';

    console.log(`[twilioVoiceWebhook] dial: to=${to} callSid=${callSid}`);

    if (!to) {
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const { voiceNumber, recordCalls } = await getCreds(serviceRole);

    const statusCb = `${PUBLIC_BASE}/functions/twilioVoiceWebhook?type=status`;
    const recordCb = `${PUBLIC_BASE}/functions/twilioVoiceWebhook?type=recording`;

    // callerId must be a verified number on the account
    let dialAttrs = `callerId="${voiceNumber}" timeout="60"`;
    if (recordCalls) {
      dialAttrs += ` record="record-from-answer-dual" recordingStatusCallback="${recordCb}" recordingStatusCallbackMethod="POST"`;
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial ${dialAttrs}>
    <Number statusCallback="${statusCb}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">${to}</Number>
  </Dial>
</Response>`;

    console.log(`[twilioVoiceWebhook] TwiML dial: to=${to} callLogId=${callLogId}`);
    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('[twilioVoiceWebhook] dial error:', error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
});