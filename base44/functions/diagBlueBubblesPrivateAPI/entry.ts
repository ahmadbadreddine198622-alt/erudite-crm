import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const serverUrl = (Deno.env.get('BLUEBUBBLES_SERVER_URL') || '').replace(/\/+$/, '');
    const password = Deno.env.get('BLUEBUBBLES_PASSWORD') || '';
    
    if (!serverUrl || !password) {
      return Response.json({ error: 'BlueBubbles server not configured' }, { status: 500 });
    }

    // Test 1: Basic server connectivity
    const infoRes = await fetch(`${serverUrl}/api/v1/info?password=${encodeURIComponent(password)}`);
    const infoRaw = await infoRes.text();
    
    // Test 2: Try Private API helpers endpoint
    const helpersRes = await fetch(`${serverUrl}/api/v1/private-api/helpers?password=${encodeURIComponent(password)}`);
    const helpersRaw = await helpersRes.text();

    // Test 3: Try ddScannerStrategy directly
    const ddScannerRes = await fetch(`${serverUrl}/api/v1/private-api/ddScannerStrategy?password=${encodeURIComponent(password)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    const ddScannerRaw = await ddScannerRes.text();

    // Test 4: Check about/version endpoint
    const aboutRes = await fetch(`${serverUrl}/api/v1/about?password=${encodeURIComponent(password)}`);
    const aboutRaw = await aboutRes.text();

    // Test 5: Check available routes
    const routesRes = await fetch(`${serverUrl}/api/v1/routes?password=${encodeURIComponent(password)}`);
    const routesRaw = await routesRes.text();

    return Response.json({
      server_url: serverUrl,
      connectivity: {
        info_endpoint: { status: infoRes.status, ok: infoRes.ok, response_sample: infoRaw.slice(0, 500) },
        about_endpoint: { status: aboutRes.status, ok: aboutRes.ok, response_sample: aboutRaw.slice(0, 500) },
        routes_endpoint: { status: routesRes.status, ok: routesRes.ok, response_sample: routesRaw.slice(0, 500) },
      },
      private_api: {
        helpers_endpoint: { status: helpersRes.status, ok: helpersRes.ok, response_sample: helpersRaw.slice(0, 500) },
        dd_scanner_endpoint: { status: ddScannerRes.status, ok: ddScannerRes.ok, response_sample: ddScannerRaw.slice(0, 500) },
      },
      conclusion: {
        server_reachable: infoRes.ok || aboutRes.ok,
        private_api_helpers_exposed: helpersRes.ok,
        dd_scanner_strategy_exposed: ddScannerRes.ok,
        likely_bluebubbles_version: aboutRaw.includes('version') ? 'detected' : 'unknown',
        recommendation: !ddScannerRes.ok
          ? 'ddScannerStrategy is NOT available. This requires BlueBubbles server-side configuration.'
          : 'ddScannerStrategy appears accessible.',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});