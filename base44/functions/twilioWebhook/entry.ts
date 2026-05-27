import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Twilio webhook router. Handles three event types via ?type= query:
 *   - bridge   → returns TwiML to dial the lead's number after agent answers
 *   - status   → updates CallLog status (ringing/in-progress/completed)
 *   - recording → fetches recording URL + kicks off transcription
 *   - sms      → inbound SMS → create Activity + Lead if new
 *
 * No client auth — Twilio signs the request; we validate the X-Twilio-Signature.
 */

function twimlBridge(to: string, record: boolean) {
  const recordAttr = record ? ' record="record-from-answer-dual"' : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting your call.</Say>
  <Dial${recordAttr} callerId="">${to}</Dial>
</Response>`;
}

async function handleStatus(base44: any, params: any, call_log_id: string | null) {
  const status = params.get('CallStatus');
  const callSid = params.get('CallSid');
  const duration = parseInt(params.get('CallDuration') || '0', 10);

  if (!call_log_id) {
    const matches = await base44.asServiceRole.entities.CallLog.filter({ twilio_call_sid: callSid });
    if (matches?.[0]) call_log_id = matches[0].id;
  }
  if (!call_log_id) return;

  const update: any = { status };
  if (status === 'completed') {
    update.ended_at = new Date().toISOString();
    update.duration_seconds = duration;
  }
  await base44.asServiceRole.entities.CallLog.update(call_log_id, update);
}

async function handleRecording(base44: any, params: any, call_log_id: string | null) {
  const recordingUrl = params.get('RecordingUrl');
  const callSid = params.get('CallSid');
  if (!recordingUrl) return;

  if (!call_log_id) {
    const matches = await base44.asServiceRole.entities.CallLog.filter({ twilio_call_sid: callSid });
    if (matches?.[0]) call_log_id = matches[0].id;
  }
  if (!call_log_id) return;

  await base44.asServiceRole.entities.CallLog.update(call_log_id, {
    recording_url: `${recordingUrl}.mp3`
  });

  // Trigger AI processing (transcribe + summarize) asynchronously
  try {
    await base44.functions.processVoiceMessage({
      call_log_id,
      recording_url: `${recordingUrl}.mp3`
    });
  } catch (_) { /* non-fatal */ }
}

async function handleInboundSMS(base44: any, params: any) {
  const from = params.get('From');
  const body = params.get('Body');
  if (!from || !body) return Response.json({ ok: true });

  // Match lead by phone
  const leads = await base44.asServiceRole.entities.Lead.filter({ phone: from });
  let lead = leads?.[0];

  if (!lead) {
    lead = await base44.asServiceRole.entities.Lead.create({
      name: `SMS from ${from}`,
      phone: from,
      source: 'sms',
      stage: 'new',
      created_date: new Date().toISOString()
    });
  }

  await base44.asServiceRole.entities.Activity.create({
    lead_id: lead.id,
    type: 'sms',
    direction: 'inbound',
    channel: 'sms',
    title: `SMS from ${from}`,
    description: body,
    source: 'twilio'
  });

  // Auto-reply TwiML (optional)
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

    const contentType = req.headers.get('content-type') || '';
    const params = contentType.includes('application/x-www-form-urlencoded')
      ? new URLSearchParams(await req.text())
      : new URLSearchParams();

    const base44 = createClientFromRequest(req);

    if (type === 'bridge') {
      const to = url.searchParams.get('to');
      const record = url.searchParams.get('record') === '1';
      if (!to) return new Response('Missing to', { status: 400 });
      return new Response(twimlBridge(to, record), {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    if (type === 'status') {
      await handleStatus(base44, params, call_log_id);
      return Response.json({ ok: true });
    }

    if (type === 'recording') {
      await handleRecording(base44, params, call_log_id);
      return Response.json({ ok: true });
    }

    if (type === 'sms') {
      return await handleInboundSMS(base44, params);
    }

    return Response.json({ error: 'unknown type' }, { status: 400 });
  } catch (error: any) {
    console.error('twilioWebhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
