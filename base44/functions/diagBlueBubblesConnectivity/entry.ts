import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const serverUrl = (Deno.env.get('BLUEBUBBLES_SERVER_URL') || '').replace(/\/+$/, '');
    const password = Deno.env.get('BLUEBUBBLES_PASSWORD') || '';
    
    if (!serverUrl) {
      return Response.json({ error: 'BLUEBUBBLES_SERVER_URL not configured' }, { status: 500 });
    }

    // Test base root
    const baseRes = await fetch(serverUrl, { headers: { 'skip_zrok_interstitial': 'true' } });
    const baseRaw = await baseRes.text();

    // Test with password query
    const queryRes = await fetch(`${serverUrl}?password=${encodeURIComponent(password)}`, { headers: { 'skip_zrok_interstitial': 'true' } });
    const queryRaw = await queryRes.text();

    // Test API endpoint OPTIONS
    const apiRes = await fetch(`${serverUrl}/api/v1/message/text?password=${encodeURIComponent(password)}`, {
      method: 'OPTIONS',
      headers: { 'skip_zrok_interstitial': 'true' },
    });

    return Response.json({
      server_url: serverUrl,
      password_configured: !!password,
      tests: {
        base_root: { status: baseRes.status, sample: baseRaw.slice(0, 300) },
        with_password: { status: queryRes.status, sample: queryRaw.slice(0, 300) },
        api_options: { status: apiRes.status },
      },
      analysis: {
        server_reachable: baseRes.status === 200 || queryRes.status === 200,
        api_accessible: apiRes.status === 200 || apiRes.status === 401 || apiRes.status === 404,
        likely_issue: baseRes.status === 404 ? 'Server URL incorrect or not running' : 'Server responding',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});