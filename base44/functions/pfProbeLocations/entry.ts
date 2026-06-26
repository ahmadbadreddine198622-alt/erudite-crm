import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PF_BASE = 'https://atlas.propertyfinder.com/v1';
const TOKEN_SAFETY_BUFFER_MS = 60 * 1000;

async function getToken(base44) {
  const creds = await base44.asServiceRole.entities.PFCredential.list();
  if (!creds || creds.length === 0) throw new Error('No PF credentials configured');
  const cred = creds[0];
  const now = Date.now();

  if (cred.access_token && cred.token_expires_at) {
    const expiresAtMs = new Date(cred.token_expires_at).getTime();
    if (expiresAtMs - now > TOKEN_SAFETY_BUFFER_MS) return cred.access_token;
  }

  if (!cred.api_key || !cred.api_secret) throw new Error('PF API key or secret missing');

  const authRes = await fetch(`${PF_BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ apiKey: cred.api_key, apiSecret: cred.api_secret }),
  });
  if (!authRes.ok) throw new Error(`PF auth failed (${authRes.status})`);
  const tokenData = await authRes.json();
  const accessToken = tokenData.accessToken;
  if (!accessToken) throw new Error('PF auth returned no accessToken');

  const expiresInSec = tokenData.expiresIn || 1800;
  const expiresAt = new Date(now + expiresInSec * 1000 - TOKEN_SAFETY_BUFFER_MS).toISOString();
  await base44.asServiceRole.entities.PFCredential.update(cred.id, {
    access_token: accessToken, token_expires_at: expiresAt, api_environment: 'production',
  });
  return accessToken;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const token = await getToken(base44);

    // Probe 1 & 2: via the URL builder (base + path join, as pfSearchLocations does)
    const probe1Url = `${PF_BASE}/locations?search=${encodeURIComponent('ma')}`;
    const probe2Url = `${PF_BASE}/locations?search=${encodeURIComponent('Dubai')}`;
    const probe3Url = `${PF_BASE}/locations?ids=${encodeURIComponent('50')}`;

    // Probe 4: hardcoded literal string — bypasses any builder
    const probe4Url = 'https://atlas.propertyfinder.com/v1/locations?search=ma';

    const probes = [
      { probe: '1-builder search=ma',     url: probe1Url },
      { probe: '2-builder search=Dubai',   url: probe2Url },
      { probe: '3-builder ids=50',         url: probe3Url },
      { probe: '4-hardcoded literal',      url: probe4Url },
    ];

    const results = [];
    for (const p of probes) {
      try {
        const res = await fetch(p.url, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        const text = await res.text();
        let body;
        try { body = JSON.parse(text); } catch (_) { body = text.substring(0, 500); }
        results.push({ probe: p.probe, finalUrl: p.url, status: res.status, body });
      } catch (e) {
        results.push({ probe: p.probe, finalUrl: p.url, status: 0, body: e.message });
      }
    }

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});