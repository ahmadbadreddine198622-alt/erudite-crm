import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const creds = await base44.asServiceRole.entities.PFCredential.list();
    if (!creds || creds.length === 0) {
      return Response.json({ found: false });
    }

    const cred = creds[0];
    return Response.json({
      found: true,
      active_environment: cred.active_environment || 'sandbox',
      // Production
      api_key: cred.api_key || '',
      has_secret: !!cred.api_secret,
      is_connected: cred.is_connected || false,
      // Sandbox
      sandbox_api_key: cred.sandbox_api_key || '',
      has_sandbox_secret: !!cred.sandbox_api_secret,
      sandbox_is_connected: cred.sandbox_is_connected || false,
      // Shared
      test_message: cred.test_message || '',
      last_tested_at: cred.last_tested_at || null,
      scopes_granted: cred.scopes_granted || [],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});