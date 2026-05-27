import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Mint a short-lived access token so the browser Twilio Voice SDK can make
 * calls FROM the agent's browser (no agent phone needed). Used by the
 * BrowserCallWidget component.
 *
 * The agent calls /functions/twilioVoiceToken, gets a JWT, initializes
 * Twilio.Device with it, then can call .connect({ params: { To: leadPhone } }).
 */

import { createHmac } from 'node:crypto';

function jwt(header: any, payload: any, secret: string) {
  const b64 = (obj: any) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const data = `${b64(header)}.${b64(payload)}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${sig}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const c = (await base44.asServiceRole.entities.TwilioCredential.list())?.[0];
    const accountSid = c?.account_sid || Deno.env.get('TWILIO_SID');
    const apiKeySid = c?.api_key_sid || Deno.env.get('TWILIO_API_KEY_SID');
    const apiKeySecret = c?.api_key_secret || Deno.env.get('TWILIO_API_KEY_SECRET');
    const twimlAppSid = c?.twiml_app_sid || Deno.env.get('TWILIO_TWIML_APP_SID');

    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
      return Response.json({ error: 'Twilio Voice SDK not configured (need api_key_sid, api_key_secret, twiml_app_sid)' }, { status: 500 });
    }

    const identity = user.email.replace(/[^a-z0-9_-]/gi, '_');
    const now = Math.floor(Date.now() / 1000);

    const token = jwt(
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
  } catch (error: any) {
    console.error('twilioVoiceToken error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
