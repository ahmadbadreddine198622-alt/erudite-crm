import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Mint a short-lived Twilio Access Token so the browser Voice SDK can place calls.
 * Requires TwilioCredential with: account_sid, api_key_sid, api_key_secret, twiml_app_sid
 * Uses Web Crypto API (SubtleCrypto) — fully async, works natively in Deno.
 */

function b64url(str) {
  // base64url encode a string
  return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlObj(obj) {
  return b64url(JSON.stringify(obj));
}

async function makeJwt(header, payload, secret) {
  const data = `${b64urlObj(header)}.${b64urlObj(payload)}`;

  // Import HMAC key using Web Crypto API
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const sigBytes = new Uint8Array(sigBuffer);

  // Convert to base64url
  let binary = '';
  for (const byte of sigBytes) binary += String.fromCharCode(byte);
  const sig = btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${data}.${sig}`;
}

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
        error: 'Browser calling not configured — API Key SID, API Key Secret, and TwiML App SID are required. Configure them in Twilio Hub → Settings.'
      }, { status: 200 });
    }

    const identity = user.email.replace(/[^a-z0-9_\-]/gi, '_');
    const now = Math.floor(Date.now() / 1000);

    const token = await makeJwt(
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

    console.log(`[twilioVoiceToken] ✅ Token minted for identity=${identity}`);
    return Response.json({ token, identity, ttl: 3600 });
  } catch (error) {
    console.error('[twilioVoiceToken] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});