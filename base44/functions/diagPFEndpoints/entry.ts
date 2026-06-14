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

async function pfFetch(endpoint, token) {
  const res = await fetch(`${PF_BASE}${endpoint}`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, data: json };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const token = await getPFToken();
  const report = { timestamp: new Date().toISOString() };

  // SECTION 3: One listing agent object
  const listingsRes = await pfFetch('/listings?page=1&perPage=3', token);
  const listings = listingsRes.data?.data || listingsRes.data?.listings || [];
  const listing = listings[0];
  report.section_3_listing_agent = listing ? {
    listing_ref: listing.reference,
    agent_keys: listing.agent ? Object.keys(listing.agent) : 'NO_AGENT_FIELD',
    agent_full: listing.agent,
    publicProfile_full: listing.publicProfile,
  } : { error: 'No listings' };

  // SECTION 4: Endpoint tests
  const endpoints = [
    'GET /users', '/users',
    'GET /agents', '/agents',
    'GET /brokers', '/brokers',
    'GET /publicProfiles/206264', '/publicProfiles/206264',
    'GET /users/206264', '/users/206264',
    'GET /agents/206264', '/agents/206264',
  ];

  report.section_4_endpoints = {};
  for (let i = 0; i < endpoints.length; i += 2) {
    const name = endpoints[i];
    const path = endpoints[i + 1];
    try {
      const res = await pfFetch(path, token);
      const d = res.data;
      // Check for email/name at various levels
      const dataArr = Array.isArray(d?.data) ? d.data : (Array.isArray(d) ? d : [d]);
      const first = dataArr[0] || d;
      const email = first?.email || first?.agent_email || first?.user_email;
      const name_field = first?.name || first?.agent_name || first?.user_name || first?.firstName;
      
      report.section_4_endpoints[name] = {
        status: res.status,
        has_email: !!email,
        has_name: !!name_field,
        verdict: res.status === 200 ? (email ? `RETURNS EMAIL: ${email}` : name_field ? `RETURNS NAME: ${name_field}` : 'NO EMAIL/NAME') : `FAILED ${res.status}`,
      };
    } catch (e) {
      report.section_4_endpoints[name] = { verdict: `ERROR: ${e.message}` };
    }
  }

  return Response.json(report);
});