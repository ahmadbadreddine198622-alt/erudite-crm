import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PF_BASE = 'https://atlas.propertyfinder.com/v1';
const TOKEN_SAFETY_BUFFER_MS = 60 * 1000;

async function getPFToken(base44) {
  const creds = await base44.asServiceRole.entities.PFCredential.list();
  if (!creds || creds.length === 0) {
    throw new Error('No Property Finder credentials configured');
  }
  const cred = creds[0];
  const now = Date.now();

  if (cred.access_token && cred.token_expires_at) {
    const expiresAtMs = new Date(cred.token_expires_at).getTime();
    if (expiresAtMs - now > TOKEN_SAFETY_BUFFER_MS) {
      return cred.access_token;
    }
  }

  if (!cred.api_key || !cred.api_secret) {
    throw new Error('PF API key or secret missing');
  }
  const res = await fetch(`${PF_BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ apiKey: cred.api_key, apiSecret: cred.api_secret }),
  });
  if (!res.ok) throw new Error('PF auth failed: ' + res.status + ' ' + await res.text());
  const data = await res.json();
  const accessToken = data.accessToken;
  if (!accessToken) throw new Error('PF auth returned no accessToken');

  const expiresInSec = data.expiresIn || 1800;
  const expiresAt = new Date(now + expiresInSec * 1000 - TOKEN_SAFETY_BUFFER_MS).toISOString();
  await base44.asServiceRole.entities.PFCredential.update(cred.id, {
    access_token: accessToken, token_expires_at: expiresAt, api_environment: 'production',
  });
  return accessToken;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let accessToken;
    try {
      accessToken = await getPFToken(base44);
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }

    // Fetch listings from Property Finder
    const listingsResponse = await fetch(`${PF_BASE}/listings?perPage=50`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!listingsResponse.ok) {
      const txt = await listingsResponse.text();
      return Response.json({ error: 'Failed to fetch listings: ' + listingsResponse.status + ' ' + txt }, { status: 500 });
    }

    const data = await listingsResponse.json();
    const results = data.results || data.data || data.listings || [];

    // Format listings for frontend
    const listings = results.map(p => ({
      id: p.id || p.reference,
      title: p.title || p.headline || `${p.property_type} in ${p.location || 'Unknown'}`,
      reference: p.reference || p.reference_no,
      location: p.location || p.community || p.area || '',
      bedrooms: p.bedrooms || 0,
      bathrooms: p.bathrooms || 0,
      area: p.area || p.size || 0,
      type: p.property_type || 'apartment',
      price: p.price || p.rent || 0,
      image: p.images?.[0]?.url || p.images?.[0] || '',
      status: p.state?.stage || p.status || 'live',
      furnishing: p.furnishing_status || '',
      developer: p.developer || '',
      deal_type: p.deal_type || 'sale',
    }));

    // Save listings to PFListing entity
    if (listings.length > 0) {
      await base44.asServiceRole.entities.PFListing.bulkCreate(
        listings.map(l => ({
          ...l,
          synced_at: new Date().toISOString(),
        }))
      );
    }

    return Response.json({ 
      listings,
      count: listings.length,
      synced_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});