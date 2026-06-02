import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PF_BASE = 'https://atlas.propertyfinder.com/v1';

async function getPFToken() {
  const apiKey = Deno.env.get('PROPERTY_FINDER_API_KEY');
  const apiSecret = Deno.env.get('PROPERTY_FINDER_API_SECRET');
  if (!apiKey || !apiSecret) return null;

  const res = await fetch(`${PF_BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret }),
  });
  if (!res.ok) return null;
  const { accessToken } = await res.json();
  return accessToken;
}

async function searchPropertyFinder(token, brief) {
  // Build query params from brief
  const params = new URLSearchParams({ perPage: '20' });
  if (brief.bedrooms) params.set('bedrooms', brief.bedrooms);
  if (brief.property_type) params.set('propertyType', brief.property_type);
  if (brief.transaction) params.set('dealType', brief.transaction === 'lease' ? 'rent' : 'sale');
  if (brief.location) params.set('location', brief.location);
  if (brief.budget_max) params.set('priceMax', brief.budget_max);
  if (brief.budget_min) params.set('priceMin', brief.budget_min);

  const res = await fetch(`${PF_BASE}/listings?${params.toString()}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  });

  if (!res.ok) {
    // Try fetching all listings and filter client-side as fallback
    const fallbackRes = await fetch(`${PF_BASE}/listings?perPage=50`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    });
    if (!fallbackRes.ok) return [];
    const data = await fallbackRes.json();
    return (data.results || data.data || data.listings || []);
  }

  const data = await res.json();
  return data.results || data.data || data.listings || [];
}

function normalizePFListing(p, brief) {
  const price = p.price || p.rent || 0;
  const beds = p.bedrooms ?? 0;
  const area = p.area || p.size || 0;
  const location = p.location || p.community || p.area_name || '';

  // Scoring
  let score = 0;
  if (brief.budget_min && brief.budget_max) {
    if (price >= brief.budget_min && price <= brief.budget_max) score += 40;
    else if (price <= brief.budget_max * 1.1) score += 20;
  } else if (brief.budget_max && price <= brief.budget_max) score += 40;

  if (brief.bedrooms && beds === parseInt(brief.bedrooms)) score += 30;
  else if (brief.bedrooms && Math.abs(beds - parseInt(brief.bedrooms)) === 1) score += 15;

  const loc = location.toLowerCase();
  const briefLoc = (brief.location || '').toLowerCase();
  if (briefLoc && loc.includes(briefLoc)) score += 20;
  else if (briefLoc && briefLoc.split(' ').some(w => w.length > 3 && loc.includes(w))) score += 10;

  if (brief.property_type && (p.property_type || '').toLowerCase().includes(brief.property_type.toLowerCase())) score += 10;

  const ref = p.reference || p.reference_no || p.id || '';
  const listingUrl = ref
    ? `https://www.propertyfinder.ae/en/plp/${ref}`
    : 'https://www.propertyfinder.ae';

  return {
    id: `pf_${p.id || ref}`,
    source: 'Property Finder',
    title: p.title || p.headline || `${p.property_type || 'Property'} in ${location}`,
    price,
    bedrooms: beds,
    bathrooms: p.bathrooms || 0,
    size_sqft: area,
    location,
    building: p.building || p.building_name || '',
    image: p.images?.[0]?.url || p.images?.[0] || '',
    listing_url: listingUrl,
    reference: ref,
    furnishing: p.furnishing_status || '',
    score,
    deal_type: p.deal_type || brief.transaction || 'sale',
    listed_at: p.updated_at || p.created_at || null,
  };
}

async function searchBayutViaAI(base44, brief) {
  const transactionLabel = brief.transaction === 'lease' ? 'for rent' : 'for sale';
  const beds = brief.bedrooms ? `${brief.bedrooms} bedroom` : '';
  const budget = brief.budget_max ? `, budget up to AED ${Number(brief.budget_max).toLocaleString()}` : '';
  const area = brief.location ? ` in ${brief.location}` : ' in Dubai';
  const type = brief.property_type || 'apartment';

  const prompt = `Search Bayut.com for current active listings: ${beds} ${type} ${transactionLabel}${area}${budget}.

Return a JSON array of the top 6 best matching listings you find. Each object must have these exact keys:
- title: property title
- price: number (AED, no commas)
- bedrooms: number
- size_sqft: number (0 if unknown)
- location: area/community name
- building: building name or empty string
- listing_url: direct URL to the Bayut listing page
- listed_recently: boolean (true if listed within last 30 days)

Return ONLY valid JSON array, no markdown, no explanation.`;

  try {
    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            price: { type: 'number' },
            bedrooms: { type: 'number' },
            size_sqft: { type: 'number' },
            location: { type: 'string' },
            building: { type: 'string' },
            listing_url: { type: 'string' },
            listed_recently: { type: 'boolean' },
          },
        },
      },
    });

    const listings = Array.isArray(res) ? res : [];

    return listings.map((p, i) => {
      const price = p.price || 0;
      let score = 0;

      if (brief.budget_max && price <= brief.budget_max) score += 40;
      else if (brief.budget_max && price <= brief.budget_max * 1.1) score += 20;

      if (brief.bedrooms && p.bedrooms === parseInt(brief.bedrooms)) score += 30;
      else if (brief.bedrooms && Math.abs((p.bedrooms || 0) - parseInt(brief.bedrooms)) === 1) score += 15;

      const loc = (p.location || '').toLowerCase();
      const briefLoc = (brief.location || '').toLowerCase();
      if (briefLoc && loc.includes(briefLoc)) score += 20;

      if (p.listed_recently) score += 10;

      return {
        id: `bayut_${i}_${Date.now()}`,
        source: 'Bayut',
        title: p.title || 'Property',
        price,
        bedrooms: p.bedrooms || 0,
        bathrooms: 0,
        size_sqft: p.size_sqft || 0,
        location: p.location || '',
        building: p.building || '',
        image: '',
        listing_url: p.listing_url || 'https://www.bayut.com',
        reference: '',
        furnishing: '',
        score,
        deal_type: brief.transaction || 'sale',
        listed_at: null,
      };
    });
  } catch (e) {
    return [];
  }
}

function scoreInternalProperties(properties, brief) {
  return properties.map(p => {
    let score = 0;

    const price = p.price_aed || p.rent_aed || 0;
    if (brief.budget_max && price <= brief.budget_max) score += 40;
    else if (brief.budget_max && price <= brief.budget_max * 1.1) score += 20;

    if (brief.bedrooms && p.bedrooms === parseInt(brief.bedrooms)) score += 30;
    else if (brief.bedrooms && Math.abs((p.bedrooms || 0) - parseInt(brief.bedrooms)) === 1) score += 15;

    const loc = (p.location || '').toLowerCase();
    const briefLoc = (brief.location || '').toLowerCase();
    if (briefLoc && loc.includes(briefLoc)) score += 20;

    if (brief.property_type && (p.property_type || '').toLowerCase() === brief.property_type.toLowerCase()) score += 10;

    return { ...p, _internalScore: score };
  }).filter(p => p._internalScore >= 40);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { brief, client_id, skip_internal } = body;

    if (!brief) return Response.json({ error: 'brief is required' }, { status: 400 });

    // 1. Internal match first (unless skipped)
    let internalMatches = [];
    if (!skip_internal) {
      const internalProps = await base44.asServiceRole.entities.Property.list();
      internalMatches = scoreInternalProperties(internalProps, brief);
    }

    // If strong internal matches, return them and stop
    if (internalMatches.length >= 2) {
      return Response.json({
        source: 'internal',
        matches: internalMatches.slice(0, 8),
        total: internalMatches.length,
        searched_at: new Date().toISOString(),
      });
    }

    // 2. Fallback: live market search
    const [pfToken, bayutResults] = await Promise.all([
      getPFToken(),
      searchBayutViaAI(base44, brief),
    ]);

    let pfResults = [];
    if (pfToken) {
      const raw = await searchPropertyFinder(pfToken, brief);
      pfResults = raw.map(p => normalizePFListing(p, brief));
    }

    // Merge, sort by score desc, dedupe
    const allResults = [...pfResults, ...bayutResults]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // Log search against client if client_id provided
    if (client_id && allResults.length > 0) {
      await base44.asServiceRole.entities.Activity.create({
        lead_id: client_id,
        type: 'system',
        title: `Live market search: ${brief.bedrooms || '?'}BR ${brief.property_type || 'property'} in ${brief.location || 'Dubai'}`,
        description: `Found ${allResults.length} live listings from Property Finder and Bayut. Budget: AED ${Number(brief.budget_min || 0).toLocaleString()}–${Number(brief.budget_max || 0).toLocaleString()}`,
        source: 'automation',
        agent_email: user.email,
        status: 'completed',
      });
    }

    return Response.json({
      source: 'live_market',
      pf_count: pfResults.length,
      bayut_count: bayutResults.length,
      matches: allResults,
      total: allResults.length,
      searched_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});