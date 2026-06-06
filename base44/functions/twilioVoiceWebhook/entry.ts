import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * TwiML App Voice URL — called by Twilio when the browser SDK places a call.
 * Receives: To (the number to dial), CallerId (our Twilio number)
 * Returns TwiML that dials the destination number.
 *
 * Also handles status callbacks to update CallLog.
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
  // Twilio calls this without Base44 auth headers — always use asServiceRole
  const base44 = createClientFromRequest(req);
  const serviceRole = base44.asServiceRole;
  const url = new URL(req.url);
  const type = url.searchParams.get('type') || 'dial';

  // ── Status callback from Twilio ──────────────────────────────────────────
  if (type === 'status') {
    try {
      const form = await req.formData();
      const callSid = form.get('CallSid');
      const status = form.get('CallStatus');
      const duration = form.get('CallDuration');
      let callLogId = url.searchParams.get('call_log_id');

      // Find by callSid if no callLogId
      if (!callLogId && callSid) {
        const logs = await base44.asServiceRole.entities.CallLog.filter({ twilio_call_sid: callSid });
        if (logs?.[0]) callLogId = logs[0].id;
      }

      if (callLogId) {
        const update = { status, twilio_call_sid: callSid || undefined };
        if (duration) update.duration_seconds = parseInt(duration, 10);
        if (['completed', 'failed', 'busy', 'no-answer'].includes(status)) {
          update.ended_at = new Date().toISOString();
        }
        await base44.asServiceRole.entities.CallLog.update(callLogId, update);
      }
    } catch (_) {}
    return new Response('', { status: 204 });
  }

  // ── Recording callback ───────────────────────────────────────────────────
  if (type === 'recording') {
    try {
      const form = await req.formData();
      const recordingUrl = form.get('RecordingUrl');
      const callSid = form.get('CallSid');
      let callLogId = url.searchParams.get('call_log_id');

      // Find by callSid if no callLogId
      if (!callLogId && callSid) {
        const logs = await base44.asServiceRole.entities.CallLog.filter({ twilio_call_sid: callSid });
        if (logs?.[0]) callLogId = logs[0].id;
      }

      if (callLogId && recordingUrl) {
        const mp3Url = recordingUrl + '.mp3';
        await base44.asServiceRole.entities.CallLog.update(callLogId, { recording_url: mp3Url });

        // Backfill Activity with recording link
        const callLog = await base44.asServiceRole.entities.CallLog.filter({ id: callLogId }).then(r => r?.[0]);
        if (callLog?.lead_id) {
          const activities = await base44.asServiceRole.entities.Activity.filter({
            lead_id: callLog.lead_id,
            type: 'call',
          });
          const activity = activities?.find(a => a.metadata?.call_log_id === callLogId);
          if (activity) {
            await base44.asServiceRole.entities.Activity.update(activity.id, {
              description: (activity.description || '') + `\n\n🎙️ [Listen to recording](${mp3Url})`,
              attachments: [
                ...(activity.attachments || []),
                { file_url: mp3Url, file_name: 'call_recording.mp3', file_type: 'audio/mpeg' }
              ],
              metadata: { ...activity.metadata, recording_url: mp3Url }
            });
          }
        }
      }
    } catch (_) {}
    return new Response('', { status: 204 });
  }

  // ── Main TwiML dial handler (browser SDK calls only) ────────────────────
  try {
    let formTo = '';
    let formCallLogId = '';
    let formLeadId = '';
    let formLeadName = '';
    try {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const text = await req.text();
        const p = new URLSearchParams(text);
        formTo = p.get('To') || '';
        formCallLogId = p.get('call_log_id') || '';
        formLeadId = p.get('lead_id') || '';
        formLeadName = p.get('lead_name') || '';
      }
    } catch (_) {}

    const to = formTo || url.searchParams.get('To') || '';
    let callLogId = url.searchParams.get('call_log_id') || formCallLogId || '';
    const leadId = formLeadId || url.searchParams.get('lead_id') || '';
    const leadName = formLeadName || url.searchParams.get('lead_name') || '';

    // If no To — this is an outbound-API call hitting the Voice URL. Just return empty TwiML.
    if (!to) {
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Create CallLog if not already created by twilioMakeCall
    let agentEmail = '';
    try {
      const user = await base44.auth.me();
      agentEmail = user?.email || '';
    } catch (_) {}

    if (!callLogId) {
      const { voiceNumber } = await getCreds(serviceRole);
      const newLog = await serviceRole.entities.CallLog.create({
        lead_id: leadId || null,
        direction: 'outbound',
        from_number: voiceNumber || '',
        to_number: to,
        agent_email: agentEmail,
        status: 'queued',
        started_at: new Date().toISOString(),
        twilio_number_used: voiceNumber || '',
      });
      callLogId = newLog.id;
    }

    const { voiceNumber, recordCalls } = await getCreds(serviceRole);

    const origin = url.origin;
    const statusCb = `${origin}/functions/twilioVoiceWebhook?type=status&call_log_id=${callLogId}`;
    const recordCb = `${origin}/functions/twilioVoiceWebhook?type=recording&call_log_id=${callLogId}`;

    const recordAttr = recordCalls
      ? ` recordingStatusCallback="${recordCb}" recordingStatusCallbackMethod="POST"`
      : '';

    // No action attribute - status tracked via StatusCallback on <Number> only
    const dialAttrs = [
      `callerId="${voiceNumber || ''}"`,
      `timeout="30"`,
      recordAttr.trim(),
    ].filter(Boolean).join(' ');

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial ${dialAttrs}>
    <Number statusCallback="${statusCb}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">${to}</Number>
  </Dial>
</Response>`;

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('twilioVoiceWebhook error:', error);
    // Return empty TwiML — never play an error message to the caller
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
});