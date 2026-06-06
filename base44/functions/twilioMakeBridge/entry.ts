import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Called by Twilio when the AGENT's phone answers.
 * Returns TwiML that dials the CUSTOMER and bridges audio.
 * Query params: customer, caller, log, base, record
 */
Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const customer = url.searchParams.get('customer') || '';
    const caller = url.searchParams.get('caller') || '';
    const logId = url.searchParams.get('log') || '';
    const base = url.searchParams.get('base') || url.origin;
    const record = url.searchParams.get('record') === 'true';

    const statusCb = `${base}/functions/twilioWebhook?type=status&call_log_id=${logId}`;
    const recordCb = `${base}/functions/twilioWebhook?type=recording&call_log_id=${logId}`;

    const recordAttrs = record
      ? ` record="record-from-answer-dual" recordingStatusCallback="${recordCb}"`
      : '';

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Connecting you to the customer now.</Say>
  <Dial callerId="${caller}" timeout="30"${recordAttrs}>
    <Number statusCallback="${statusCb}" statusCallbackEvent="completed">${customer}</Number>
  </Dial>
</Response>`;

    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
  } catch (error) {
    console.error('twilioMakeBridge error:', error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Bridge error.</Say></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
});