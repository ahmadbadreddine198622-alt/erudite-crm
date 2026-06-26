import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PF_BASE = 'https://atlas.propertyfinder.com/v1';
const TOKEN_SAFETY_BUFFER_MS = 60 * 1000; // 60s buffer before expiry

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Server-to-server: use service role to read credentials
    const creds = await base44.asServiceRole.entities.PFCredential.list();
    if (!creds || creds.length === 0) {
      return Response.json({ error: 'No Property Finder credentials configured' }, { status: 400 });
    }

    const cred = creds[0];
    if (!cred.api_key || !cred.api_secret) {
      return Response.json({ error: 'API key or secret missing' }, { status: 400 });
    }

    // Check cached token — reuse if >60s remaining
    const now = Date.now();
    if (cred.access_token && cred.token_expires_at) {
      const expiresAtMs = new Date(cred.token_expires_at).getTime();
      if (expiresAtMs - now > TOKEN_SAFETY_BUFFER_MS) {
        return Response.json({
          access_token: cred.access_token,
          expires_at: cred.token_expires_at,
          cached: true,
        });
      }
    }

    // Request fresh token from PF Enterprise API 2.0
    const authRes = await fetch(`${PF_BASE}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ apiKey: cred.api_key, apiSecret: cred.api_secret }),
    });

    if (!authRes.ok) {
      const errBody = await authRes.text();
      return Response.json(
        {
          error: `PF auth failed (HTTP ${authRes.status}): ${errBody.substring(0, 300)}`,
          status_code: authRes.status,
        },
        { status: authRes.status === 401 || authRes.status === 403 ? authRes.status : 500 }
      );
    }

    const tokenData = await authRes.json();
    const accessToken = tokenData.accessToken;
    if (!accessToken) {
      return Response.json({ error: 'PF auth responded but no accessToken returned' }, { status: 500 });
    }

    const expiresInSec = tokenData.expiresIn || 1800;
    const expiresAt = new Date(now + expiresInSec * 1000 - TOKEN_SAFETY_BUFFER_MS).toISOString();

    // Cache the token on the credential record
    const updateData = {
      access_token: accessToken,
      token_expires_at: expiresAt,
      api_environment: 'production',
    };

    if (tokenData.scopes) {
      updateData.scopes_granted = Array.isArray(tokenData.scopes) ? tokenData.scopes : [tokenData.scopes];
    }

    await base44.asServiceRole.entities.PFCredential.update(cred.id, updateData);

    return Response.json({
      access_token: accessToken,
      expires_at: expiresAt,
      cached: false,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});