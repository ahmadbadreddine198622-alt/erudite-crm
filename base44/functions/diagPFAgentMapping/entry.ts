import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Diagnostic: Map Property Finder agent assignments across leads + listings.
 * Tests multiple PF API endpoints to find agent email/name resolution.
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
      section_1_leads_publicProfile_analysis: null,
      section_2_three_complete_raw_leads: [],
      section_3_listing_agent_objects: [],
      section_4_agent_resolution_endpoints: {},
    };

    // SECTION 1: Fetch 50 leads, count distinct publicProfile.id values
    console.log('[diagPFAgentMapping] Fetching leads...');
    const leadsPerReq = 50;
    let allLeads = [];
    let page = 1;
    while (allLeads.length < 50) {
      const leadsRes = await pfFetch(`/leads?page=${page}&perPage=${leadsPerReq}`, token);
      if (!leadsRes.ok) {
        throw new Error('Leads fetch failed: ' + leadsRes.status + ' ' + leadsRes.raw);
      }
      const leads = leadsRes.data?.data || leadsRes.data?.leads || [];
      if (leads.length === 0) break;
      allLeads = allLeads.concat(leads);
      if (leads.length < leadsPerReq) break;
      page++;
    }
    allLeads = allLeads.slice(0, 50);

    const publicProfileCounts = {};
    for (const lead of allLeads) {
      const ppId = lead?.publicProfile?.id;
      if (ppId !== undefined && ppId !== null) {
        const key = String(ppId);
        publicProfileCounts[key] = (publicProfileCounts[key] || 0) + 1;
      }
    }

    report.section_1_leads_publicProfile_analysis = {
      total_leads_fetched: allLeads.length,
      leads_with_publicProfile: Object.values(publicProfileCounts).reduce((a, b) => a + b, 0),
      leads_without_publicProfile: allLeads.length - Object.values(publicProfileCounts).reduce((a, b) => a + b, 0),
      distinct_publicProfile_ids: Object.keys(publicProfileCounts).length,
      publicProfile_id_counts: publicProfileCounts,
      analysis: Object.keys(publicProfileCounts).length === 1 
        ? 'SINGLE agent/broker account owns all leads' 
        : 'MULTIPLE different agent/broker accounts',
    };

    // SECTION 2: Output 3 complete raw lead objects (untruncated)
    report.section_2_three_complete_raw_leads = allLeads.slice(0, 3).map((lead, idx) => ({
      lead_index: idx,
      complete_raw_lead: lead,
    }));

    // SECTION 3: Fetch listings, output complete agent + publicProfile objects for 3 listings
    console.log('[diagPFAgentMapping] Fetching listings...');
    const listingsRes = await pfFetch('/listings?page=1&perPage=10', token);
    if (!listingsRes.ok) {
      report.section_3_listing_agent_objects = { error: 'Listings fetch failed: ' + listingsRes.status };
    } else {
      const listings = listingsRes.data?.data || listingsRes.data?.listings || [];
      report.section_3_listing_agent_objects = listings.slice(0, 3).map((listing, idx) => ({
        listing_index: idx,
        listing_id: listing.id,
        listing_reference: listing.reference,
        complete_agent_object: listing.agent || null,
        complete_publicProfile_object: listing.publicProfile || null,
        complete_raw_listing: listing,
      }));
    }

    // SECTION 4: Try agent resolution endpoints
    console.log('[diagPFAgentMapping] Testing agent resolution endpoints...');
    
    // Get a sample publicProfile.id to test with
    const samplePPId = Object.keys(publicProfileCounts)[0] || '206264';

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
        report.section_4_agent_resolution_endpoints[ep.name] = {
          status: res.status,
          ok: res.ok,
          response_body: res.data,
          has_agent_email: res.data && (
            (typeof res.data === 'object' && 
             (res.data.email || res.data.agent_email || res.data.user_email)) ||
            (Array.isArray(res.data) && res.data.some(item => item.email || item.agent_email))
          ),
          has_agent_name: res.data && (
            (typeof res.data === 'object' && 
             (res.data.name || res.data.agent_name || res.data.user_name)) ||
            (Array.isArray(res.data) && res.data.some(item => item.name || item.agent_name))
          ),
        };
      } catch (err) {
        report.section_4_agent_resolution_endpoints[ep.name] = {
          status: 'error',
          ok: false,
          error: err.message,
        };
      }
    }

    return Response.json(report);
  } catch (error) {
    return Response.json({ 
      error: error.message, 
      stack: error.stack,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
});