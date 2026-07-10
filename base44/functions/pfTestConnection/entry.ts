import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PROD_BASE = 'https://atlas.propertyfinder.com/v1';
const SANDBOX_BASE = 'https://sandbox.atlas.propertyfinder.com/v1';
const TOKEN_SAFETY_BUFFER_MS = 60 * 1000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const creds = await base44.asServiceRole.entities.PFCredential.list();
    if (!creds || creds.length === 0) {
      return Response.json({ connected: false, message: 'No Property Finder credentials configured' });
    }

    const cred = creds[0];
    // Allow override of environment for testing; default to active_environment
    const env = body.environment || cred.active_environment || 'sandbox';
    const isSandbox = env === 'sandbox';
    const baseUrl = isSandbox ? SANDBOX_BASE : PROD_BASE;

    const apiKey = isSandbox ? cred.sandbox_api_key : cred.api_key;
    const apiSecret = isSandbox ? cred.sandbox_api_secret : cred.api_secret;
    const cachedToken = isSandbox ? cred.sandbox_access_token : cred.access_token;
    const cachedExpiry = isSandbox ? cred.sandbox_token_expires_at : cred.token_expires_at;

    const now = Date.now();
    let accessToken = null;
    let tokenError = null;

    // Use cached token if valid
    if (cachedToken && cachedExpiry) {
      const expiresAtMs = new Date(cachedExpiry).getTime();
      if (expiresAtMs - now > TOKEN_SAFETY_BUFFER_MS) {
        accessToken = cachedToken;
      }
    }

    // Fetch fresh token if needed
    if (!accessToken) {
      if (!apiKey || !apiSecret) {
        tokenError = `No ${env} API key or secret configured`;
      } else {
        try {
          const authRes = await fetch(`${baseUrl}/auth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ apiKey, apiSecret }),
          });

          if (authRes.ok) {
            const tokenData = await authRes.json();
            accessToken = tokenData.accessToken;
            if (accessToken) {
              const expiresAt = new Date(now + (tokenData.expiresIn || 1800) * 1000 - TOKEN_SAFETY_BUFFER_MS).toISOString();
              const tokenUpdate = isSandbox
                ? { sandbox_access_token: accessToken, sandbox_token_expires_at: expiresAt }
                : { access_token: accessToken, token_expires_at: expiresAt };
              await base44.asServiceRole.entities.PFCredential.update(cred.id, tokenUpdate);
            }
          } else {
            const errBody = await authRes.text();
            tokenError = `Auth failed (HTTP ${authRes.status}): ${errBody.substring(0, 300)}`;
          }
        } catch (e) {
          tokenError = `Connection error: ${e.message}`;
        }
      }
    }

    const nowIso = new Date().toISOString();

    if (tokenError || !accessToken) {
      const msg = tokenError || 'Failed to obtain access token';
      const failUpdate = isSandbox
        ? { sandbox_is_connected: false, last_tested_at: nowIso, test_message: msg }
        : { is_connected: false, last_tested_at: nowIso, test_message: msg };
      await base44.asServiceRole.entities.PFCredential.update(cred.id, failUpdate);
      return Response.json({ connected: false, message: msg, tested_at: nowIso, environment: env });
    }

    // GET /v1/users?perPage=1 as a lightweight scope check
    const usersRes = await fetch(`${baseUrl}/users?perPage=1`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });

    const nowIso2 = new Date().toISOString();
    if (usersRes.ok) {
      const msg = `Connected to PF ${env} API`;
      const successUpdate = isSandbox
        ? { sandbox_is_connected: true, last_tested_at: nowIso2, test_message: msg, active_environment: env }
        : { is_connected: true, last_tested_at: nowIso2, test_message: msg, active_environment: env };
      await base44.asServiceRole.entities.PFCredential.update(cred.id, successUpdate);
      return Response.json({ connected: true, message: msg, tested_at: nowIso2, environment: env });
    } else {
      const errBody = await usersRes.text();
      const msg = `Connection test failed (HTTP ${usersRes.status}): ${errBody.substring(0, 200)}`;
      const failUpdate2 = isSandbox
        ? { sandbox_is_connected: false, last_tested_at: nowIso2, test_message: msg }
        : { is_connected: false, last_tested_at: nowIso2, test_message: msg };
      await base44.asServiceRole.entities.PFCredential.update(cred.id, failUpdate2);
      return Response.json({ connected: false, message: msg, tested_at: nowIso2, environment: env });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});