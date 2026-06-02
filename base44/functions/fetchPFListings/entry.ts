import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PF_BASE = 'https://atlas.propertyfinder.com/v1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get Property Finder credentials from env or stored credentials
    let PF_API_KEY = Deno.env.get('PROPERTY_FINDER_API_KEY');
    let PF_API_SECRET = Deno.env.get('PROPERTY_FINDER_API_SECRET');
    
    // Try to get from stored credentials first
    try {
      const creds = await base44.asServiceRole.entities.PFCredential.list();
      if (creds && creds.length > 0 && creds[0].is_connected) {
        PF_API_KEY = creds[0].api_key || PF_API_KEY;
        PF_API_SECRET = creds[0].api_secret || PF_API_SECRET;
      }
    } catch (e) { /* fallback to env vars */ }
    
    if (!PF_API_KEY || !PF_API_SECRET) {
      return Response.json({ error: 'Property Finder credentials not configured' }, { status: 500 });
    }

    // Authenticate with Property Finder
    const authResponse = await fetch(`${PF_BASE}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ apiKey: PF_API_KEY, apiSecret: PF_API_SECRET }),
    });

    if (!authResponse.ok) {
      const txt = await authResponse.text();
      return Response.json({ error: 'Property Finder auth failed: ' + authResponse.status + ' ' + txt }, { status: 500 });
    }

    const { accessToken } = await authResponse.json();

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