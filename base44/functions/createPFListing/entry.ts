import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PF_BASE = 'https://atlas.propertyfinder.com/v1';

async function getPFToken(apiKey, apiSecret) {
  const key = apiKey || Deno.env.get('PROPERTY_FINDER_API_KEY');
  const secret = apiSecret || Deno.env.get('PROPERTY_FINDER_API_SECRET');
  const res = await fetch(`${PF_BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ apiKey: key, apiSecret: secret }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error('PF auth failed: ' + res.status + ' ' + txt);
  }
  const data = await res.json();
  return data.accessToken;
}

async function getStoredCredentials(base44) {
  try {
    const creds = await base44.asServiceRole.entities.PFCredential.list();
    if (creds && creds.length > 0 && creds[0].is_connected) {
      return { apiKey: creds[0].api_key, apiSecret: creds[0].api_secret };
    }
  } catch (e) { /* fallback */ }
  return { apiKey: null, apiSecret: null };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, listingId, listing } = body;

    const { apiKey, apiSecret } = await getStoredCredentials(base44);
    const token = await getPFToken(apiKey, apiSecret);

    // ── DELETE listing ──────────────────────────────────────────────────────
    if (action === 'delete') {
      if (!listingId) return Response.json({ error: 'listingId required' }, { status: 400 });
      const res = await fetch(`${PF_BASE}/listings/${listingId}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
      });
      if (!res.ok) {
        const txt = await res.text();
        return Response.json({ error: 'PF delete failed: ' + res.status + ' ' + txt }, { status: 400 });
      }
      return Response.json({ ok: true, message: 'Listing deleted' });
    }

    // ── UPDATE listing ──────────────────────────────────────────────────────
    if (action === 'update') {
      if (!listingId || !listing) return Response.json({ error: 'listingId and listing required' }, { status: 400 });
      // Strip fields that PF API treats as read-only or rejects in PUT
      const READONLY_FIELDS = ['id', 'reference', 'state', 'portals', 'status', 'createdAt', 'updatedAt',
        'publicProfile', 'agent', 'assignedAgent', 'permitNumber', 'dld', 'qr'];
      const cleanPayload = Object.fromEntries(
        Object.entries(listing).filter(([k]) => !READONLY_FIELDS.includes(k))
      );
      const res = await fetch(`${PF_BASE}/listings/${listingId}`, {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanPayload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return Response.json({ error: data.message || data.error || 'Update failed: ' + res.status, details: data }, { status: 400 });
      }
      return Response.json({ ok: true, listing: data });
    }

    // ── CREATE listing (default) ────────────────────────────────────────────
    if (!listing) return Response.json({ error: 'listing data required' }, { status: 400 });

    const res = await fetch(`${PF_BASE}/listings`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(listing),
    });

    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: data.message || ('Create failed: ' + res.status), details: data }, { status: 400 });
    }
    return Response.json({ ok: true, listing: data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});