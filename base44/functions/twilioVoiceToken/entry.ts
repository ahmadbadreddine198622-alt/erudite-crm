import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { createHmac } from 'node:crypto';

/**
 * Mint a short-lived Twilio Access Token so the browser Voice SDK can place calls.
 * Requires TwilioCredential with: account_sid, api_key_sid, api_key_secret, twiml_app_sid
 */

function b64url(obj) {
  return btoa(JSON.stringify(obj))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function makeJwt(header, payload, secret) {
  const data = `${b64url(header)}.${b64url(payload)}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${sig}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const list = await base44.asServiceRole.entities.TwilioCredential.list();
    const c = list?.[0];
    const accountSid   = c?.account_sid   || Deno.env.get('TWILIO_SID');
    const apiKeySid    = c?.api_key_sid    || Deno.env.get('TWILIO_API_KEY_SID');
    const apiKeySecret = c?.api_key_secret || Deno.env.get('TWILIO_API_KEY_SECRET');
    const twimlAppSid  = c?.twiml_app_sid  || Deno.env.get('TWILIO_TWIML_APP_SID');

    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
      return Response.json({
        browser_calling_unavailable: true,
        error: 'Browser calling not configured — API Key SID, API Key Secret, and TwiML App SID are required. Configure them in Twilio Hub → Settings.'
      }, { status: 200 });
    }

    const identity = user.email.replace(/[^a-z0-9_\-]/gi, '_');
    const now = Math.floor(Date.now() / 1000);

    const token = makeJwt(
      { alg: 'HS256', typ: 'JWT', cty: 'twilio-fpa;v=1' },
      {
        jti: `${apiKeySid}-${now}`,
        iss: apiKeySid,
        sub: accountSid,
        nbf: now,
        exp: now + 3600,
        grants: {
          identity,
          voice: {
            incoming: { allow: true },
            outgoing: { application_sid: twimlAppSid }
          }
        }
      },
      apiKeySecret
    );

    return Response.json({ token, identity, ttl: 3600 });
  } catch (error) {
    console.error('twilioVoiceToken error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});