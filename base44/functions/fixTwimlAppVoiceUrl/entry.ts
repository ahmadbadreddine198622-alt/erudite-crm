import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Fixes the full Twilio calling setup:
 * 1. Sets the TwiML App Voice URL to our webhook
 * 2. Points the phone number to use the TwiML App (not a raw webhook)
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const list = await base44.asServiceRole.entities.TwilioCredential.list();
  const c = list?.[0];
  const accountSid  = c?.account_sid;
  const authToken   = c?.auth_token;
  const twimlAppSid = c?.twiml_app_sid;
  const voiceNumber = c?.voice_number;

  if (!accountSid || !authToken || !twimlAppSid) {
    return Response.json({ error: 'Missing Twilio credentials (account_sid, auth_token, twiml_app_sid)' }, { status: 400 });
  }

  const auth = 'Basic ' + btoa(`${accountSid}:${authToken}`);
  const correctVoiceUrl = 'https://dubai-estate-pro.base44.app/functions/twilioVoiceWebhook';
  const results = {};

  // ── Step 1: Update TwiML App Voice URL ───────────────────────────────────
  const appRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Applications/${twimlAppSid}.json`,
    {
      method: 'POST',
      headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ VoiceUrl: correctVoiceUrl, VoiceMethod: 'POST' }).toString(),
    }
  );
  const appData = await appRes.json();
  if (!appRes.ok) {
    return Response.json({ error: 'Failed to update TwiML App', details: appData }, { status: 500 });
  }
  results.twiml_app_voice_url = appData.voice_url;
  console.log(`[fixTwimlAppVoiceUrl] ✅ TwiML App Voice URL set to: ${appData.voice_url}`);

  // ── Step 2: Find the phone number and point it to the TwiML App ──────────
  // List all incoming phone numbers
  const numbersRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PageSize=50`,
    { headers: { 'Authorization': auth } }
  );
  const numbersData = await numbersRes.json();

  if (!numbersRes.ok) {
    return Response.json({ error: 'Failed to list phone numbers', details: numbersData }, { status: 500 });
  }

  const numbers = numbersData.incoming_phone_numbers || [];
  console.log(`[fixTwimlAppVoiceUrl] Found ${numbers.length} phone number(s)`);

  // Target: the voice_number from DB, or the first number if not set
  const targetPhone = voiceNumber || '+15822335959';
  const targetNumber = numbers.find(n =>
    n.phone_number === targetPhone ||
    n.phone_number.replace(/\D/g, '') === targetPhone.replace(/\D/g, '')
  ) || numbers[0];

  if (!targetNumber) {
    return Response.json({ error: 'No phone numbers found in Twilio account' }, { status: 404 });
  }

  console.log(`[fixTwimlAppVoiceUrl] Updating number ${targetNumber.phone_number} sid=${targetNumber.sid}`);

  // Update the phone number to use TwiML App instead of webhook
  const numRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${targetNumber.sid}.json`,
    {
      method: 'POST',
      headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        VoiceApplicationSid: twimlAppSid,
        // Clear any direct webhook URLs so TwiML App takes over
        VoiceUrl: '',
        VoiceFallbackUrl: '',
      }).toString(),
    }
  );
  const numData = await numRes.json();
  if (!numRes.ok) {
    return Response.json({ error: 'Failed to update phone number', details: numData }, { status: 500 });
  }

  results.phone_number = numData.phone_number;
  results.phone_number_sid = numData.sid;
  results.voice_application_sid = numData.voice_application_sid;
  console.log(`[fixTwimlAppVoiceUrl] ✅ Phone number ${numData.phone_number} now uses TwiML App: ${numData.voice_application_sid}`);

  return Response.json({
    success: true,
    message: 'Twilio calling fully configured',
    ...results,
  });
});