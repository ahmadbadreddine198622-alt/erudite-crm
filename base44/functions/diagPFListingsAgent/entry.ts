import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PF_BASE = 'https://atlas.propertyfinder.com/v1';

async function getPFToken() {
  const key = Deno.env.get('PROPERTY_FINDER_API_KEY');
  const secret = Deno.env.get('PROPERTY_FINDER_API_SECRET');
  const res = await fetch(`${PF_BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ apiKey: key, apiSecret: secret }),
  });
  if (!res.ok) throw new Error('PF auth failed: ' + res.status);
  return (await res.json()).accessToken;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const token = await getPFToken();
  
  // Try multiple listing endpoints
  const endpoints = [
    '/listings?page=1&perPage=5',
    '/listings?perPage=5',
  ];
  
  const report = { timestamp: new Date().toISOString(), listings_tried: [] };
  
  for (const ep of endpoints) {
    const res = await fetch(`${PF_BASE}${ep}`, {
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    
    const listings = json?.data || json?.listings || [];
    if (listings.length > 0) {
      const listing = listings[0];
      report.listings_tried.push({
        endpoint: ep,
        status: res.status,
        count: listings.length,
        first_listing_id: listing.id,
        agent_field_exists: !!listing.agent,
        agent_keys: listing.agent ? Object.keys(listing.agent) : null,
        agent_full: listing.agent,
        publicProfile_full: listing.publicProfile,
        all_top_level_keys: Object.keys(listing),
      });
      break;
    } else {
      report.listings_tried.push({
        endpoint: ep,
        status: res.status,
        count: 0,
        response_sample: JSON.stringify(json).slice(0, 500),
      });
    }
  }
  
  return Response.json(report);
});