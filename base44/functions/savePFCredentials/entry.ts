import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PROD_BASE = 'https://atlas.propertyfinder.com/v1';
const SANDBOX_BASE = 'https://sandbox.atlas.propertyfinder.com/v1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const environment = body.environment || 'sandbox';
    const isSandbox = environment === 'sandbox';
    const baseUrl = isSandbox ? SANDBOX_BASE : PROD_BASE;

    const api_key = (body.api_key || '').trim();
    if (!api_key) return Response.json({ error: 'API key is required' }, { status: 400 });

    // Resolve api_secret — either new value or reuse existing from DB
    let api_secret = (body.api_secret || '').trim();
    const existing = await base44.asServiceRole.entities.PFCredential.list();
    const existingCred = existing && existing.length > 0 ? existing[0] : null;

    if (!api_secret) {
      // Try to reuse existing secret for this environment
      api_secret = isSandbox
        ? (existingCred?.sandbox_api_secret || '')
        : (existingCred?.api_secret || '');
    }

    if (!api_secret) {
      return Response.json({ error: 'API secret is required' }, { status: 400 });
    }

    // Test the credentials against the correct base URL
    let isConnected = false;
    let testMessage = '';
    let accessToken = null;
    try {
      const authRes = await fetch(`${baseUrl}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ apiKey: api_key, apiSecret: api_secret }),
      });
      if (authRes.ok) {
        const tokenData = await authRes.json();
        accessToken = tokenData.accessToken;
        if (accessToken) {
          isConnected = true;
          testMessage = `Connected to ${environment} successfully`;
        } else {
          testMessage = 'Auth responded but no token returned';
        }
      } else {
        const errBody = await authRes.text();
        testMessage = `Authentication failed (HTTP ${authRes.status}): ${errBody.substring(0, 300)}`;
      }
    } catch (e) {
      testMessage = `Connection error: ${e.message}`;
    }

    const now = new Date().toISOString();
    const updateData = {
      active_environment: environment,
      last_tested_at: now,
      test_message: testMessage,
    };

    if (isSandbox) {
      updateData.sandbox_api_key = api_key;
      updateData.sandbox_api_secret = api_secret;
      updateData.sandbox_is_connected = isConnected;
      if (accessToken) {
        updateData.sandbox_access_token = accessToken;
        updateData.sandbox_token_expires_at = new Date(Date.now() + 1740 * 1000).toISOString();
      }
    } else {
      updateData.api_key = api_key;
      updateData.api_secret = api_secret;
      updateData.is_connected = isConnected;
      if (accessToken) {
        updateData.access_token = accessToken;
        updateData.token_expires_at = new Date(Date.now() + 1740 * 1000).toISOString();
      }
    }

    if (existingCred) {
      await base44.asServiceRole.entities.PFCredential.update(existingCred.id, updateData);
    } else {
      await base44.asServiceRole.entities.PFCredential.create(updateData);
    }

    return Response.json({ success: true, is_connected: isConnected, test_message: testMessage, environment });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});