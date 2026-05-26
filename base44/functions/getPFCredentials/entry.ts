import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const creds = await base44.asServiceRole.entities.PFCredential.list();

    // If entity record exists, return it
    if (creds && creds.length > 0) {
      const c = creds[0];
      return Response.json({
        found: true,
        api_key: c.api_key || '',
        has_secret: !!(c.api_secret),
        is_connected: c.is_connected || false,
        test_message: c.test_message || '',
        last_tested_at: c.last_tested_at || '',
      });
    }

    // Fallback: check environment variables
    const envKey = Deno.env.get('PROPERTY_FINDER_API_KEY');
    const envSecret = Deno.env.get('PROPERTY_FINDER_API_SECRET');

    if (envKey && envSecret) {
      // Try to verify env credentials
      let isConnected = false;
      let testMessage = '';
      try {
        const PF_BASE = 'https://atlas.propertyfinder.com/v1';
        const authRes = await fetch(`${PF_BASE}/auth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ apiKey: envKey, apiSecret: envSecret }),
        });
        if (authRes.ok) {
          isConnected = true;
          testMessage = 'Connected via environment variables';
        } else {
          testMessage = `Auth failed (${authRes.status})`;
        }
      } catch (e) {
        testMessage = 'Connection error: ' + e.message;
      }

      // Auto-save to entity so UI can manage it
      await base44.asServiceRole.entities.PFCredential.create({
        api_key: envKey,
        api_secret: envSecret,
        is_connected: isConnected,
        last_tested_at: new Date().toISOString(),
        test_message: testMessage,
      });

      return Response.json({
        found: true,
        api_key: envKey,
        has_secret: true,
        is_connected: isConnected,
        test_message: testMessage,
        last_tested_at: new Date().toISOString(),
      });
    }

    return Response.json({ found: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});