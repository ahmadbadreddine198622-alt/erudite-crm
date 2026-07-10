import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const serverUrl = (Deno.env.get('BLUEBUBBLES_SERVER_URL') || '').replace(/\/+$/, '');
    const password = Deno.env.get('BLUEBUBBLES_PASSWORD') || '';

    // Also test the URL shown in the BlueBubbles panel screenshot
    const screenshotUrl = 'https://skxk3jl57jes.share.zrok.io';

    const result = {
      storedServerUrl: serverUrl || '(not set)',
      screenshotUrl,
      urlsMatch: serverUrl === screenshotUrl,
      passwordSet: password ? `yes (${password.length} chars)` : 'NO — missing',
      storedPingStatus: null,
      storedPingBody: null,
      storedPingError: null,
      screenshotPingStatus: null,
      screenshotPingBody: null,
      screenshotPingError: null,
      infoStatus: null,
      infoBody: null,
      infoError: null,
      screenshotInfoStatus: null,
      screenshotInfoBody: null,
      screenshotInfoError: null,
    };

    // 1. Ping endpoint
    try {
      const resp = await fetch(`${serverUrl}/api/v1/ping?password=${encodeURIComponent(password)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'skip_zrok_interstitial': 'true' },
        signal: AbortSignal.timeout(15000),
      });
      result.storedPingStatus = resp.status;
      result.storedPingOk = resp.ok;
      result.storedPingBody = (await resp.text()).slice(0, 500);
    } catch (e) {
      result.storedPingError = e.message || String(e);
    }

    // 1b. Test the screenshot URL (current BlueBubbles panel)
    try {
      const resp = await fetch(`${screenshotUrl}/api/v1/ping?password=${encodeURIComponent(password)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'skip_zrok_interstitial': 'true' },
        signal: AbortSignal.timeout(15000),
      });
      result.screenshotPingStatus = resp.status;
      result.screenshotPingOk = resp.ok;
      result.screenshotPingBody = (await resp.text()).slice(0, 500);
    } catch (e) {
      result.screenshotPingError = e.message || String(e);
    }

    // 2. Server info endpoint (stored URL)
    try {
      const resp2 = await fetch(`${serverUrl}/api/v1/server/info?password=${encodeURIComponent(password)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'skip_zrok_interstitial': 'true' },
        signal: AbortSignal.timeout(15000),
      });
      result.infoStatus = resp2.status;
      result.infoBody = (await resp2.text()).slice(0, 800);
    } catch (e) {
      result.infoError = e.message || String(e);
    }

    // 2b. Server info on screenshot URL
    try {
      const resp2 = await fetch(`${screenshotUrl}/api/v1/server/info?password=${encodeURIComponent(password)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'skip_zrok_interstitial': 'true' },
        signal: AbortSignal.timeout(15000),
      });
      result.screenshotInfoStatus = resp2.status;
      result.screenshotInfoBody = (await resp2.text()).slice(0, 800);
    } catch (e) {
      result.screenshotInfoError = e.message || String(e);
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});