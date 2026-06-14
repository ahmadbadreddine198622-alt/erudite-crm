import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Lightweight diagnostic: ONLY section_3 (one listing agent object) and section_4 (endpoint resolution tests).
 */

const PF_BASE = 'https://atlas.propertyfinder.com/v1';

async function getPFToken() {
  const key = Deno.env.get('PROPERTY_FINDER_API_KEY');
  const secret = Deno.env.get('PROPERTY_FINDER_API_SECRET');
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

async function pfFetch(endpoint, token) {
  const url = endpoint.startsWith('http') ? endpoint : `${PF_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, ok: res.ok, data: json, raw: text };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const token = await getPFToken();
    const report = {
      timestamp: new Date().toISOString(),
      section_3_one_listing_agent_object: null,
      section_4_agent_resolution_endpoints: {},
    };

    // SECTION 3: Fetch listings, output ONE complete agent object
    console.log('[diagPFAgentMappingLite] Fetching listings...');
    const listingsRes = await pfFetch('/listings?page=1&perPage=5', token);
    if (!listingsRes.ok) {
      report.section_3_one_listing_agent_object = { error: 'Listings fetch failed: ' + listingsRes.status };
    } else {
      const listings = listingsRes.data?.data || listingsRes.data?.listings || [];
      const listing = listings[0];
      if (listing) {
        report.section_3_one_listing_agent_object = {
          listing_id: listing.id,
          listing_reference: listing.reference,
          agent_object_keys: listing.agent ? Object.keys(listing.agent) : null,
          agent_object_full: listing.agent || null,
          publicProfile_object_full: listing.publicProfile || null,
        };
      }
    }

    // SECTION 4: Try agent resolution endpoints
    console.log('[diagPFAgentMappingLite] Testing agent resolution endpoints...');
    const samplePPId = '206264';

    const endpointsToTest = [
      { name: 'GET /users', path: '/users' },
      { name: 'GET /agents', path: '/agents' },
      { name: 'GET /brokers', path: '/brokers' },
      { name: `GET /publicProfiles/${samplePPId}`, path: `/publicProfiles/${samplePPId}` },
      { name: `GET /users/${samplePPId}`, path: `/users/${samplePPId}` },
      { name: `GET /agents/${samplePPId}`, path: `/agents/${samplePPId}` },
    ];

    for (const ep of endpointsToTest) {
      try {
        const res = await pfFetch(ep.path, token);
        const hasEmail = res.data && (
          (typeof res.data === 'object' && !Array.isArray(res.data) && (res.data.email || res.data.agent_email || res.data.user_email)) ||
          (Array.isArray(res.data) && res.data.some(item => item?.email || item?.agent_email || item?.user_email))
        );
        const hasName = res.data && (
          (typeof res.data === 'object' && !Array.isArray(res.data) && (res.data.name || res.data.agent_name || res.data.user_name)) ||
          (Array.isArray(res.data) && res.data.some(item => item?.name || item?.agent_name || item?.user_name))
        );
        
        report.section_4_agent_resolution_endpoints[ep.name] = {
          status: res.status,
          ok: res.ok,
          has_agent_email: !!hasEmail,
          has_agent_name: !!hasName,
          verdict: res.ok 
            ? (hasEmail ? `SUCCESS - returns email (${hasEmail})` : hasName ? `PARTIAL - returns name only (${hasName})` : 'NO EMAIL/NAME')
            : `FAILED (${res.status})`,
          sample_data: res.data ? (Array.isArray(res.data) ? res.data.slice(0, 2) : res.data) : null,
        };
      } catch (err) {
        report.section_4_agent_resolution_endpoints[ep.name] = {
          status: 'error',
          ok: false,
          verdict: `ERROR: ${err.message}`,
        };
      }
    }

    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});