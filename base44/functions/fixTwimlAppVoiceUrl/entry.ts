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

  // Use the stable app domain (not the per-function Deno URL which changes on each deploy)
  const correctVoiceUrl = 'https://dubai-estate-pro.base44.app/functions/twilioVoiceWebhook';

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Applications/${twimlAppSid}.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ VoiceUrl: correctVoiceUrl, VoiceMethod: 'POST' }).toString(),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    return Response.json({ error: 'Twilio API error', details: data }, { status: 500 });
  }

  return Response.json({
    success: true,
    voice_url_set: correctVoiceUrl,
    voice_url_confirmed: data.voice_url,
  });
});