import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Twilio webhook router. Handles event types via ?type= query:
 *   - bridge     → TwiML to dial the lead's number after agent answers
 *   - status     → updates CallLog status
 *   - recording  → saves recording URL to CallLog + Activity
 *   - sms        → inbound SMS → create Activity
 *
 * NOTE: Twilio calls this webhook WITHOUT Base44 auth headers.
 * We must use asServiceRole for all DB operations.
 */

function twimlBridge(to, record) {
  const recordAttr = record ? ' record="record-from-answer-dual"' : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting your call.</Say>
  <Dial${recordAttr} callerId="">${to}</Dial>
</Response>`;
}

async function handleStatus(serviceRole, params, call_log_id) {
  const status = params.get('CallStatus');
  const callSid = params.get('CallSid');
  const duration = parseInt(params.get('CallDuration') || '0', 10);

  let logId = call_log_id;
  if (!logId && callSid) {
    const matches = await serviceRole.entities.CallLog.filter({ twilio_call_sid: callSid });
    if (matches?.[0]) logId = matches[0].id;
  }
  if (!logId) return;

  const update = { status };
  if (status === 'completed') {
    update.ended_at = new Date().toISOString();
    if (duration) update.duration_seconds = duration;
  }
  await serviceRole.entities.CallLog.update(logId, update);
}

async function handleRecording(serviceRole, params, call_log_id) {
  const recordingUrl = params.get('RecordingUrl');
  const callSid = params.get('CallSid');
  if (!recordingUrl) return;

  let logId = call_log_id;
  let callLog = null;

  if (!logId && callSid) {
    const matches = await serviceRole.entities.CallLog.filter({ twilio_call_sid: callSid });
    if (matches?.[0]) { logId = matches[0].id; callLog = matches[0]; }
  } else if (logId) {
    const logs = await serviceRole.entities.CallLog.filter({ id: logId });
    callLog = logs?.[0] || null;
  }
  if (!logId) return;

  const mp3Url = `${recordingUrl}.mp3`;
  await serviceRole.entities.CallLog.update(logId, { recording_url: mp3Url });

  // Backfill Activity with recording link
  if (callLog?.lead_id) {
    try {
      const activities = await serviceRole.entities.Activity.filter({
        lead_id: callLog.lead_id,
        type: 'call',
      });
      const activity = activities?.find(a => a.metadata?.call_log_id === logId);
      if (activity) {
        await serviceRole.entities.Activity.update(activity.id, {
          description: (activity.description || '') + `\n\n🎙️ [Listen to recording](${mp3Url})`,
          attachments: [
            ...(activity.attachments || []),
            { file_url: mp3Url, file_name: 'call_recording.mp3', file_type: 'audio/mpeg' }
          ],
          metadata: { ...activity.metadata, recording_url: mp3Url }
        });
      }
    } catch (_) { /* non-fatal */ }
  }

  // Trigger transcription asynchronously
  try {
    await serviceRole.functions.invoke('processVoiceMessage', {
      call_log_id: logId,
      recording_url: mp3Url
    });
  } catch (_) {}
}

async function handleInboundSMS(serviceRole, params) {
  const from = params.get('From');
  const body = params.get('Body');
  if (!from || !body) return Response.json({ ok: true });

  const leads = await serviceRole.entities.Lead.filter({ phone: from });
  let lead = leads?.[0];

  if (!lead) {
    lead = await serviceRole.entities.Lead.create({
      name: `SMS from ${from}`,
      phone: from,
      source: 'sms',
      stage: 'new',
    });
  }

  await serviceRole.entities.Activity.create({
    lead_id: lead.id,
    type: 'sms',
    direction: 'inbound',
    channel: 'sms',
    title: `SMS from ${from}`,
    description: body,
    source: 'twilio'
  });

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  );
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    const call_log_id = url.searchParams.get('call_log_id');

    // Read body ONCE before creating SDK client
    const contentType = req.headers.get('content-type') || '';
    const rawBody = contentType.includes('application/x-www-form-urlencoded')
      ? await req.text()
      : '';
    const params = new URLSearchParams(rawBody);

    // Twilio calls without auth — inject app ID so SDK initializes
    const modifiedReq = new Request(req.url, {
      method: req.method,
      headers: (() => {
        const h = new Headers(req.headers);
        h.set('Base44-App-Id', Deno.env.get('BASE44_APP_ID') || '');
        return h;
      })(),
      body: rawBody || null,
    });
    const base44 = createClientFromRequest(modifiedReq);
    const serviceRole = base44.asServiceRole;

    if (type === 'bridge') {
      const to = url.searchParams.get('to');
      const record = url.searchParams.get('record') === '1';
      if (!to) return new Response('Missing to', { status: 400 });
      return new Response(twimlBridge(to, record), {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    if (type === 'status') {
      await handleStatus(serviceRole, params, call_log_id);
      return Response.json({ ok: true });
    }

    if (type === 'recording') {
      await handleRecording(serviceRole, params, call_log_id);
      return Response.json({ ok: true });
    }

    if (type === 'sms') {
      return await handleInboundSMS(serviceRole, params);
    }

    return Response.json({ error: 'unknown type' }, { status: 400 });
  } catch (error) {
    console.error('twilioWebhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});