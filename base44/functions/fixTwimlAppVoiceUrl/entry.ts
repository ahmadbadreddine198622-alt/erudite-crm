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
  // Derive from the incoming request so the TwiML App always points at the
  // domain the app is actually served from (never a stale hardcoded one).
  const correctVoiceUrl = `${new URL(req.url).origin}/functions/twilioVoiceWebhook`;

  // This URL is persisted into durable Twilio config, so it must be one that
  // Twilio's gateway can actually fetch TwiML from. Probe it exactly like
  // Twilio would before writing anything — protects against running this from
  // the Base44 editor/preview origin, where /functions/* does not serve this
  // app and persisting the origin would re-break calling with error 31005.
  const probe = await fetch(correctVoiceUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'To=',
  }).catch(() => null);
  const probeType = probe?.headers?.get('content-type') || '';
  if (probe) await probe.text().catch(() => {});
  if (!probe || !probe.ok || !probeType.includes('xml')) {
    const status = probe ? `HTTP ${probe.status}` : 'network error';
    return Response.json({
      error: `The voice webhook is not reachable at ${correctVoiceUrl} (${status}). ` +
        `Open the PUBLISHED app at its real domain and run Auto-Fix from there — ` +
        `running it from the Base44 editor or a preview URL would break calling.`,
    }, { status: 400 });
  }

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

  // ── Step 3: Enable calls to UAE (+971) in Voice Geo Permissions ─────────
  // Disabled by default on new Twilio accounts — every call to a UAE number
  // fails with error 13227 until this is switched on.
  try {
    const geoRes = await fetch('https://voice.twilio.com/v1/DialingPermissions/BulkCountryUpdates', {
      method: 'POST',
      headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        UpdateRequest: JSON.stringify([{
          iso_code: 'AE',
          low_risk_numbers_enabled: true,
          high_risk_special_numbers_enabled: false,
          high_risk_tollfraud_numbers_enabled: false,
        }]),
      }).toString(),
    });
    const geoData = await geoRes.json().catch(() => ({}));
    results.uae_dialing_enabled = geoRes.ok;
    if (!geoRes.ok) {
      results.uae_dialing_error = geoData?.message || `HTTP ${geoRes.status}`;
      console.warn('[fixTwimlAppVoiceUrl] UAE geo-permission update failed:', results.uae_dialing_error);
    } else {
      console.log('[fixTwimlAppVoiceUrl] ✅ UAE (+971) dialing enabled');
    }
  } catch (e) {
    results.uae_dialing_enabled = false;
    results.uae_dialing_error = e.message;
  }

  return Response.json({
    success: true,
    message: 'Twilio calling fully configured',
    ...results,
  });
});
