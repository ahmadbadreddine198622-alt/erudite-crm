import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const creds = await base44.asServiceRole.entities.PFCredential.list();
    if (!creds || creds.length === 0) {
      return Response.json({ found: false });
    }
    const c = creds[0];
    return Response.json({
      found: true,
      api_key: c.api_key || '',
      has_secret: !!(c.api_secret),
      is_connected: c.is_connected || false,
      test_message: c.test_message || '',
      last_tested_at: c.last_tested_at || '',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});