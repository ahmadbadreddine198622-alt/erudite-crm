import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const { api_key } = body;
    let { api_secret } = body;
    if (!api_key) return Response.json({ error: 'API key is required' }, { status: 400 });

    // If no new secret provided, reuse the existing one
    if (!api_secret) {
      const existing2 = await base44.asServiceRole.entities.PFCredential.list();
      if (existing2 && existing2.length > 0 && existing2[0].api_secret) {
        api_secret = existing2[0].api_secret;
      } else {
        return Response.json({ error: 'API secret is required' }, { status: 400 });
      }
    }

    // Test credentials against PF API
    let isConnected = false;
    let testMessage = '';
    try {
      const pfRes = await fetch('https://rest.apigee.propertyfinder.ae/leads?limit=1&page=1', {
        headers: {
          'Authorization': `Basic ${btoa(`${api_key}:${api_secret}`)}`,
          'Accept': 'application/json',
        },
      });
      if (pfRes.ok || pfRes.status === 200) {
        isConnected = true;
        testMessage = 'Connected successfully';
      } else {
        testMessage = `Authentication failed (HTTP ${pfRes.status})`;
      }
    } catch (e) {
      testMessage = `Connection error: ${e.message}`;
    }

    // Upsert: find existing record or create new
    const existing = await base44.asServiceRole.entities.PFCredential.list();
    const now = new Date().toISOString();

    if (existing && existing.length > 0) {
      await base44.asServiceRole.entities.PFCredential.update(existing[0].id, {
        api_key,
        api_secret,
        is_connected: isConnected,
        last_tested_at: now,
        test_message: testMessage,
      });
    } else {
      await base44.asServiceRole.entities.PFCredential.create({
        api_key,
        api_secret,
        is_connected: isConnected,
        last_tested_at: now,
        test_message: testMessage,
      });
    }

    return Response.json({ success: true, is_connected: isConnected, test_message: testMessage });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});