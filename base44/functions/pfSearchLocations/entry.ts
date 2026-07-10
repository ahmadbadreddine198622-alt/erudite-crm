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
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const search = body.search || '';
    if (!search.trim()) return Response.json({ locations: [] });

    const token = await getToken(base44);
    const res = await fetch(`${PF_BASE}/locations?search=${encodeURIComponent(search.trim())}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (!res.ok) {
      const txt = await res.text();
      return Response.json({ error: `Location search failed (${res.status}): ${txt.substring(0, 200)}` }, { status: 400 });
    }

    const data = await res.json();
    // PF returns { data: [...] } or a bare array — normalize
    const locations = Array.isArray(data) ? data : (data.data || data.locations || []);
    return Response.json({
      locations: locations.map(loc => ({
        id: loc.id || loc.locationId,
        name: loc.name || loc.fullName || loc.text || loc.label,
        type: loc.type || null,
        fullName: loc.fullName || loc.path || loc.name,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});