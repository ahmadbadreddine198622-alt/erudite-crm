import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PROD_BASE = 'https://atlas.propertyfinder.com/v1';
const SANDBOX_BASE = 'https://sandbox.atlas.propertyfinder.com/v1';
const TOKEN_SAFETY_BUFFER_MS = 60 * 1000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const creds = await base44.asServiceRole.entities.PFCredential.list();
    if (!creds || creds.length === 0) {
      return Response.json({ error: 'No Property Finder credentials configured' }, { status: 400 });
    }

    const cred = creds[0];
    const env = cred.active_environment || 'sandbox';
    const isSandbox = env === 'sandbox';
    const baseUrl = isSandbox ? SANDBOX_BASE : PROD_BASE;

    const apiKey = isSandbox ? cred.sandbox_api_key : cred.api_key;
    const apiSecret = isSandbox ? cred.sandbox_api_secret : cred.api_secret;
    const cachedToken = isSandbox ? cred.sandbox_access_token : cred.access_token;
    const cachedExpiry = isSandbox ? cred.sandbox_token_expires_at : cred.token_expires_at;

    if (!apiKey || !apiSecret) {
      return Response.json({ error: `No ${env} API key or secret configured` }, { status: 400 });
    }

    // Return cached token if still valid
    const now = Date.now();
    if (cachedToken && cachedExpiry) {
      const expiresAtMs = new Date(cachedExpiry).getTime();
      if (expiresAtMs - now > TOKEN_SAFETY_BUFFER_MS) {
        return Response.json({ access_token: cachedToken, expires_at: cachedExpiry, cached: true, environment: env });
      }
    }

    // Fetch fresh token
    const authRes = await fetch(`${baseUrl}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ apiKey, apiSecret }),
    });

    if (!authRes.ok) {
      const errBody = await authRes.text();
      return Response.json({ error: `PF auth failed (HTTP ${authRes.status}): ${errBody.substring(0, 300)}`, status_code: authRes.status }, { status: 502 });
    }

    const tokenData = await authRes.json();
    const accessToken = tokenData.accessToken;
    if (!accessToken) {
      return Response.json({ error: 'PF auth responded but no accessToken returned' }, { status: 500 });
    }

    const expiresInSec = tokenData.expiresIn || 1800;
    const expiresAt = new Date(now + expiresInSec * 1000 - TOKEN_SAFETY_BUFFER_MS).toISOString();

    const updateData = isSandbox
      ? { sandbox_access_token: accessToken, sandbox_token_expires_at: expiresAt }
      : { access_token: accessToken, token_expires_at: expiresAt };

    if (tokenData.scopes) {
      updateData.scopes_granted = Array.isArray(tokenData.scopes) ? tokenData.scopes : [tokenData.scopes];
    }

    await base44.asServiceRole.entities.PFCredential.update(cred.id, updateData);

    return Response.json({ access_token: accessToken, expires_at: expiresAt, cached: false, environment: env });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});