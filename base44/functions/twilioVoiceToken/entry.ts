import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import twilio from 'npm:twilio@5.3.3';

/**
 * Mint a short-lived Twilio Access Token so the browser Voice SDK can place calls.
 * Uses the official Twilio Node helper library for correct JWT structure.
 * Requires TwilioCredential with: account_sid, api_key_sid, api_key_secret, twiml_app_sid
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const list = await base44.asServiceRole.entities.TwilioCredential.list();
    const c = list?.[0];

    const accountSid   = c?.account_sid;
    const apiKeySid    = c?.api_key_sid;
    const apiKeySecret = c?.api_key_secret;
    const twimlAppSid  = c?.twiml_app_sid;

    console.log(`[twilioVoiceToken] creds check: accountSid=${!!accountSid} apiKeySid=${!!apiKeySid} apiKeySecret=${!!apiKeySecret} twimlAppSid=${!!twimlAppSid}`);

    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
      return Response.json({
        browser_calling_unavailable: true,
        error: 'Browser calling not configured — API Key SID, API Key Secret, and TwiML App SID are required.'
      }, { status: 200 });
    }

    const identity = user.email.replace(/[^a-z0-9_\-]/gi, '_');

    // Use official Twilio library for correct token structure
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    // outbound-only — do NOT set incomingAllow:true
    // incomingAllow causes the SDK to register as an inbound endpoint which
    // triggers a persistent WebSocket signaling connection; if that fails it
    // throws ConnectionError 53000 BEFORE the outbound call even starts.
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: false,
    });

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity,
      ttl: 3600,
    });
    token.addGrant(voiceGrant);

    const jwt = token.toJwt();

    console.log(`[twilioVoiceToken] ✅ Token minted for identity=${identity}`);
    return Response.json({ token: jwt, identity, ttl: 3600 });
  } catch (error) {
    console.error('[twilioVoiceToken] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});