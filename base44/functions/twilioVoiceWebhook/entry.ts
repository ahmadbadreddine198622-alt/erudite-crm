import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * TwiML App Voice URL — called by Twilio when the browser SDK places a call.
 * Receives: To (the number to dial), CallerId (our Twilio number)
 * Returns TwiML that dials the destination number.
 *
 * Also handles status callbacks to update CallLog.
 */

async function getCreds(base44) {
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
  const base44 = createClientFromRequest(req);
  const url = new URL(req.url);
  const type = url.searchParams.get('type') || 'dial';

  // ── Status callback from Twilio ──────────────────────────────────────────
  if (type === 'status') {
    try {
      const form = await req.formData();
      const callSid = form.get('CallSid');
      const status = form.get('CallStatus');
      const duration = form.get('CallDuration');
      const callLogId = url.searchParams.get('call_log_id');

      if (callLogId) {
        const update = { status };
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
      const callLogId = url.searchParams.get('call_log_id');
      if (callLogId && recordingUrl) {
        await base44.asServiceRole.entities.CallLog.update(callLogId, {
          recording_url: recordingUrl + '.mp3',
        });
      }
    } catch (_) {}
    return new Response('', { status: 204 });
  }

  // ── Main TwiML dial handler ──────────────────────────────────────────────
  try {
    const form = await req.formData();
    const to = form.get('To') || url.searchParams.get('To') || '';
    const callLogId = url.searchParams.get('call_log_id') || form.get('call_log_id') || '';

    const { sid, token, voiceNumber, recordCalls } = await getCreds(base44);
    if (!to) {
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Missing destination number.</Say></Response>`, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const origin = url.origin;
    const statusCb = `${origin}/functions/twilioVoiceWebhook?type=status&call_log_id=${callLogId}`;
    const recordCb = `${origin}/functions/twilioVoiceWebhook?type=recording&call_log_id=${callLogId}`;

    const dialAttrs = [
      `callerId="${voiceNumber || ''}"`,
      `timeout="30"`,
      `action="${statusCb}"`,
    ].join(' ');

    const numberAttrs = recordCalls
      ? `statusCallback="${statusCb}" statusCallbackEvent="completed"`
      : '';

    let twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial ${dialAttrs}>
    <Number ${numberAttrs}>${to}</Number>
  </Dial>
</Response>`;

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('twilioVoiceWebhook error:', error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred.</Say></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
});