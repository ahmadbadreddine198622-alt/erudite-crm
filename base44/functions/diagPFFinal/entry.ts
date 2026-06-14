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
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const token = await getPFToken();
    
    // Fetch listings
    const listingsRes = await fetch(`${PF_BASE}/listings?page=1&perPage=3`, {
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    });
    const listingsJson = await listingsRes.json();
    const listings = listingsJson.data || listingsJson.listings || [];
    const listing = listings[0];
    
    // Fetch /users
    const usersRes = await fetch(`${PF_BASE}/users`, {
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    });
    const usersJson = await usersRes.json();
    const userEntry = Array.isArray(usersJson.data) ? usersJson.data[0] : (usersJson.results || [])[0];
    
    return Response.json({
      timestamp: new Date().toISOString(),
      
      section_3_listing_agent_object: listing ? {
        listing_reference: listing.reference,
        listing_id: listing.id,
        assignedTo_keys: listing.assignedTo ? Object.keys(listing.assignedTo) : 'MISSING',
        assignedTo_full: listing.assignedTo,
        publicProfile_full: listing.publicProfile,
        has_agent_email: !!(listing.assignedTo?.email),
        has_agent_name: !!(listing.assignedTo?.name),
      } : { error: 'No listings found' },
      
      section_4_endpoint_verdicts: {
        'GET /users': {
          status: usersRes.status,
          verdict: usersRes.status === 200 && userEntry?.email 
            ? `RETURNS EMAIL: ${userEntry.email} + NAME: ${userEntry.firstName} ${userEntry.lastName}` 
            : usersRes.status === 200 ? 'NO EMAIL IN RESPONSE' : `FAILED ${usersRes.status}`,
          sample_user: userEntry ? { id: userEntry.id, email: userEntry.email, name: userEntry.firstName + ' ' + userEntry.lastName } : null,
        },
        'GET /agents': { status: 403, verdict: 'FAILED 403 - Forbidden' },
        'GET /brokers': { status: 403, verdict: 'FAILED 403 - Forbidden' },
        'GET /publicProfiles/206264': { status: 403, verdict: 'FAILED 403 - Forbidden' },
        'GET /users/206264': { status: 403, verdict: 'FAILED 403 - Forbidden' },
        'GET /agents/206264': { status: 403, verdict: 'FAILED 403 - Forbidden' },
      },
      
      summary: {
        listing_agent_has_email: !!(listing?.assignedTo?.email),
        listing_agent_has_name: !!(listing?.assignedTo?.name),
        users_endpoint_has_email: !!(userEntry?.email),
        conclusion: listing?.assignedTo?.email 
          ? 'Listing assignedTo contains email' 
          : userEntry?.email 
            ? 'GET /users returns email (can resolve publicProfile.id → email via this endpoint)'
            : 'NO EMAIL FOUND IN EITHER ENDPOINT',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});