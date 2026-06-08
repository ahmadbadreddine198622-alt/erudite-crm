/**
 * Called by Twilio when the AGENT's phone answers.
 * Returns TwiML that immediately dials the CUSTOMER.
 * No announcement, no hold music — pure audio bridge.
 *
 * Query params: customer, caller, log, record
 */

const PUBLIC_BASE = 'https://dubai-estate-pro.base44.app';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const customer = url.searchParams.get('customer') || '';
    const caller = url.searchParams.get('caller') || '';
    const logId = url.searchParams.get('log') || '';
    const record = url.searchParams.get('record') === 'true';

    console.log(`[twilioMakeBridge] customer=${customer} caller=${caller} logId=${logId} record=${record}`);

    if (!customer) {
      console.error('[twilioMakeBridge] No customer number — hanging up');
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    const statusCb = `${PUBLIC_BASE}/functions/twilioVoiceWebhook?type=status&call_log_id=${logId}`;
    const recordCb = `${PUBLIC_BASE}/functions/twilioVoiceWebhook?type=recording&call_log_id=${logId}`;

    // Build <Dial> attributes
    let dialAttrs = `callerId="${caller}" timeout="60" timeLimit="14400" action="${statusCb}" method="POST"`;
    if (record) {
      dialAttrs += ` record="record-from-answer-dual" recordingStatusCallback="${recordCb}" recordingStatusCallbackMethod="POST"`;
    }

    // Dial customer — no announcement, instant connection
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial ${dialAttrs}>
    <Number statusCallback="${statusCb}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">${customer}</Number>
  </Dial>
</Response>`;

    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });

  } catch (error) {
    console.error('[twilioMakeBridge] error:', error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
});