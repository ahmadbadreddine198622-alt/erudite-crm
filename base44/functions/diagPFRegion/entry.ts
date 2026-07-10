import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const creds = await base44.asServiceRole.entities.PFCredential.list();
    const cred = creds[0];

    const authRes = await fetch('https://atlas.propertyfinder.com/v1/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ apiKey: cred.api_key, apiSecret: cred.api_secret }),
    });
    const authData = await authRes.json();
    const token = authData.accessToken;

    const bodyStr = JSON.stringify({ state: { stage: 'takendown' } });

    // Try different base URLs / subdomains
    const endpoints = [
      `https://api.propertyfinder.com/v1/listings/1WCYDKDWQ5K380M8JKTTWQ8CJW`,
      `https://atlas.propertyfinder.com/v2/listings/1WCYDKDWQ5K380M8JKTTWQ8CJW`,
      `https://atlas.propertyfinder.com/v1/listings/1WCYDKDWQ5K380M8JKTTWQ8CJW/unpublish`,
      `https://atlas.propertyfinder.com/v1/listings/1WCYDKDWQ5K380M8JKTTWQ8CJW/state`,
    ];

    const results = {};
    for (const url of endpoints) {
      // PATCH with Bearer
      const rp = await fetch(url, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: bodyStr,
      });
      const rpBody = (await rp.text()).substring(0, 200);
      // Also try POST
      const rpost = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: bodyStr,
      });
      const rpostBody = (await rpost.text()).substring(0, 200);
      results[url] = { patch: { status: rp.status, body: rpBody }, post: { status: rpost.status, body: rpostBody } };
    }

    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});