import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get Property Finder credentials
    const PF_API_KEY = Deno.env.get('PROPERTY_FINDER_API_KEY');
    const PF_API_SECRET = Deno.env.get('PROPERTY_FINDER_API_SECRET');
    
    if (!PF_API_KEY || !PF_API_SECRET) {
      return Response.json({ error: 'Property Finder credentials not configured' }, { status: 500 });
    }

    // Authenticate with Property Finder
    const authResponse = await fetch('https://dev-sandbox.propertyfinder.ae/api/v1/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: PF_API_KEY,
        api_secret: PF_API_SECRET,
      }),
    });

    if (!authResponse.ok) {
      throw new Error('Property Finder auth failed');
    }

    const { access_token } = await authResponse.json();

    // Fetch listings from Property Finder
    const listingsResponse = await fetch('https://dev-sandbox.propertyfinder.ae/api/v1/my-properties?per_page=100', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json',
      },
    });

    if (!listingsResponse.ok) {
      throw new Error('Failed to fetch listings');
    }

    const { results } = await listingsResponse.json();

    // Format listings for frontend
    const listings = (results || []).map(p => ({
      id: p.id,
      title: p.title,
      reference: p.reference_no,
      location: p.location,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      area: p.area,
      type: p.property_type,
      price: p.price,
      image: p.images?.[0],
      status: p.status || 'live',
      furnishing: p.furnishing_status,
      developer: p.developer,
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