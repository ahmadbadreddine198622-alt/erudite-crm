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
    const copilot = url.searchParams.get('copilot') === 'true';
    const copilotLandlordId = url.searchParams.get('landlord_id') || '';
    const copilotAgentEmail = url.searchParams.get('agent_email') || '';

    console.log(`[twilioMakeBridge] customer=${customer} caller=${caller} logId=${logId} record=${record} copilot=${copilot}`);

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

    // Copilot audio stream — added before <Dial> when copilot=true
    let copilotStreamXml = '';
    if (copilot) {
      const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      copilotStreamXml = `<Start><Stream url="wss://copilot.peninsulabusinessbay.com/twilio" track="both_tracks"><Parameter name="call_log_id" value="${esc(logId)}" /><Parameter name="landlord_id" value="${esc(copilotLandlordId)}" /><Parameter name="agent_email" value="${esc(copilotAgentEmail)}" /></Stream></Start>`;
      console.log(`[twilioMakeBridge] Copilot stream enabled: landlord=${copilotLandlordId} agent=${copilotAgentEmail} log=${logId}`);
    }

    // Dial customer — no announcement, instant connection
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${copilotStreamXml}
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