import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const list = await base44.asServiceRole.entities.TwilioCredential.list();
  const c = list?.[0];
  const accountSid = c?.account_sid;
  const authToken = c?.auth_token;
  const twimlAppSid = c?.twiml_app_sid;

  if (!accountSid || !authToken || !twimlAppSid) {
    return Response.json({ error: 'Missing Twilio credentials' }, { status: 400 });
  }

  // Determine the correct voice URL from the current request origin
  const url = new URL(req.url);
  const correctVoiceUrl = `${url.origin}/functions/twilioVoiceWebhook`;

  // Update the TwiML App via Twilio REST API
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Applications/${twimlAppSid}.json`;
  const body = new URLSearchParams({ VoiceUrl: correctVoiceUrl, VoiceMethod: 'POST' });

  const res = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    return Response.json({ error: 'Twilio API error', details: data }, { status: 500 });
  }

  return Response.json({
    success: true,
    voice_url_set: correctVoiceUrl,
    twiml_app_sid: twimlAppSid,
    twilio_response: { friendly_name: data.friendly_name, voice_url: data.voice_url },
  });
});