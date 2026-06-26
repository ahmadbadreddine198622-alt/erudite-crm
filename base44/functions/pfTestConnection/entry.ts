import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PF_BASE = 'https://atlas.propertyfinder.com/v1';
const TOKEN_SAFETY_BUFFER_MS = 60 * 1000;

/**
 * pfTestConnection — Phase 1 connection test.
 * Calls pfGetToken (inlined — backend functions deploy independently) then
 * GET /v1/users?perPage=1 as a lightweight auth + scope check.
 * Updates PFCredential with the result.
 *
 * NOTE: The token logic is intentionally inlined here rather than calling
 * pfGetToken via base44.functions.invoke, because function-to-function
 * invocation requires auth context that isn't available in all callers.
 * pfGetToken remains the canonical function; future Phase 2+ functions
 * can call it via base44.asServiceRole.functions.invoke('pfGetToken', {})
 * when they have an authenticated request context.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* no auth context */ }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const creds = await base44.asServiceRole.entities.PFCredential.list();
    if (!creds || creds.length === 0) {
      return Response.json({ connected: false, message: 'No Property Finder credentials configured' });
    }

    const cred = creds[0];

    // ── Token logic (inlined from pfGetToken) ──
    const now = Date.now();
    let accessToken = null;
    let tokenError = null;

    // Check cached token
    if (cred.access_token && cred.token_expires_at) {
      const expiresAtMs = new Date(cred.token_expires_at).getTime();
      if (expiresAtMs - now > TOKEN_SAFETY_BUFFER_MS) {
        accessToken = cred.access_token;
      }
    }

    // Request fresh token if no valid cache
    if (!accessToken) {
      if (!cred.api_key || !cred.api_secret) {
        tokenError = 'API key or secret missing';
      } else {
        try {
          const authRes = await fetch(`${PF_BASE}/auth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ apiKey: cred.api_key, apiSecret: cred.api_secret }),
          });

          if (authRes.ok) {
            const tokenData = await authRes.json();
            accessToken = tokenData.accessToken;
            if (accessToken) {
              const expiresInSec = tokenData.expiresIn || 1800;
              const expiresAt = new Date(now + expiresInSec * 1000 - TOKEN_SAFETY_BUFFER_MS).toISOString();
              const updateData = { access_token: accessToken, token_expires_at: expiresAt, api_environment: 'production' };
              if (tokenData.scopes) {
                updateData.scopes_granted = Array.isArray(tokenData.scopes) ? tokenData.scopes : [tokenData.scopes];
              }
              await base44.asServiceRole.entities.PFCredential.update(cred.id, updateData);
            }
          } else {
            const errBody = await authRes.text();
            tokenError = `PF auth failed (HTTP ${authRes.status}): ${errBody.substring(0, 300)}`;
          }
        } catch (e) {
          tokenError = `Connection error: ${e.message}`;
        }
      }
    }

    const nowIso = new Date().toISOString();

    if (tokenError || !accessToken) {
      const msg = tokenError || 'Failed to obtain access token';
      await base44.asServiceRole.entities.PFCredential.update(cred.id, {
        is_connected: false,
        last_tested_at: nowIso,
        test_message: msg,
      });
      return Response.json({ connected: false, message: msg, tested_at: nowIso });
    }

    // ── GET /v1/users?perPage=1 — auth + scope check ──
    const usersRes = await fetch(`${PF_BASE}/users?perPage=1`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });

    if (usersRes.ok) {
      const msg = 'Connected (Enterprise API 2.0)';
      await base44.asServiceRole.entities.PFCredential.update(cred.id, {
        is_connected: true,
        last_tested_at: nowIso,
        test_message: msg,
      });
      return Response.json({ connected: true, message: msg, tested_at: nowIso });
    } else {
      const errBody = await usersRes.text();
      const msg = `Connection test failed (HTTP ${usersRes.status}): ${errBody.substring(0, 200)}`;
      await base44.asServiceRole.entities.PFCredential.update(cred.id, {
        is_connected: false,
        last_tested_at: nowIso,
        test_message: msg,
      });
      return Response.json({ connected: false, message: msg, tested_at: nowIso });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});