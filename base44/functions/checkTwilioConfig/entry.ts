import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Diagnostic check for Twilio browser calling configuration.
 * Verifies:
 *   1. Credentials exist
 *   2. API Key is valid
 *   3. TwiML App exists and has correct Voice URL
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const creds = await base44.asServiceRole.entities.TwilioCredential.list();
    const c = creds?.[0];

    if (!c?.account_sid || !c?.auth_token) {
      return Response.json({
        ok: false,
        error: 'Twilio not configured — Go to Twilio Hub → Settings',
        configured: false,
      });
    }

    const accountSid = c.account_sid;
    const apiKeySid = c.api_key_sid;
    const apiKeySecret = c.api_key_secret;
    const twimlAppSid = c.twiml_app_sid;
    const authHeader = `Basic ${btoa(`${accountSid}:${c.auth_token}`)}`;

    const checks = {
      credentials: true,
      api_key: { valid: false, error: '' },
      twiml_app: { valid: false, error: '', voice_url: '', expected_voice_url: '' },
    };

    // Check API Key
    if (apiKeySid && apiKeySecret) {
      try {
        const keyRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Keys/${apiKeySid}.json`,
          { headers: { Authorization: authHeader } }
        );
        if (keyRes.ok) {
          checks.api_key.valid = true;
        } else {
          const err = await keyRes.text();
          checks.api_key.error = `API Key invalid: ${err}`;
        }
      } catch (e) {
        checks.api_key.error = `API Key check failed: ${e.message}`;
      }
    } else {
      checks.api_key.error = 'API Key SID or Secret missing';
    }

    // Check TwiML App. What actually matters is that Twilio's gateway can
    // fetch TwiML from the stored Voice URL — so probe it like Twilio would,
    // rather than string-comparing against this request's origin (which
    // differs when the check is run from the editor or another alias domain).
    const expectedVoiceUrl = `${new URL(req.url).origin}/functions/twilioVoiceWebhook`;
    if (twimlAppSid) {
      try {
        const appRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Applications/${twimlAppSid}.json`,
          { headers: { Authorization: authHeader } }
        );
        if (appRes.ok) {
          const app = await appRes.json();
          checks.twiml_app.valid = true;
          checks.twiml_app.voice_url = app.voice_url || '';
          checks.twiml_app.expected_voice_url = expectedVoiceUrl;
          if (!app.voice_url) {
            checks.twiml_app.error = `TwiML App has no Voice URL set. Run Auto-Fix to point it at ${expectedVoiceUrl}`;
          } else if (!app.voice_url.endsWith('/functions/twilioVoiceWebhook')) {
            checks.twiml_app.error = `Voice URL points somewhere unexpected: ${app.voice_url}. Run Auto-Fix to point it at ${expectedVoiceUrl}`;
          } else {
            const probe = await fetch(app.voice_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: 'To=',
            }).catch(() => null);
            const probeType = probe?.headers?.get('content-type') || '';
            if (probe) await probe.text().catch(() => {});
            if (!probe || !probe.ok || !probeType.includes('xml')) {
              const status = probe ? `HTTP ${probe.status}` : 'network error';
              checks.twiml_app.error = `Twilio cannot fetch TwiML from ${app.voice_url} (${status}) — this causes Gateway error 31005. Run Auto-Fix from the published app to repair it.`;
            }
          }
        } else {
          const err = await appRes.text();
          checks.twiml_app.error = `TwiML App not found: ${err}`;
        }
      } catch (e) {
        checks.twiml_app.error = `TwiML App check failed: ${e.message}`;
      }
    } else {
      checks.twiml_app.error = 'TwiML App SID missing';
    }

    const allOk = checks.api_key.valid && checks.twiml_app.valid && !checks.twiml_app.error;

    return Response.json({
      ok: allOk,
      configured: true,
      checks,
      summary: allOk
        ? 'Browser calling is properly configured!'
        : 'Configuration issues found — see details below',
    });

  } catch (error) {
    console.error('checkTwilioConfig error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});