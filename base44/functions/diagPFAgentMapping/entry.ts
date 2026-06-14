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
    let allLeads = [];
    let page = 1;
    while (allLeads.length < 50) {
      const leadsRes = await pfFetch(`/leads?page=${page}&perPage=50`, token);
      if (!leadsRes.ok) {
        throw new Error('Leads fetch failed: ' + leadsRes.status);
      }
      const leads = leadsRes.data?.data || leadsRes.data?.leads || [];
      if (leads.length === 0) break;
      allLeads = allLeads.concat(leads);
      if (leads.length < 50) break;
      page++;
    }
    allLeads = allLeads.slice(0, 50);

    const publicProfileCounts = {};
    for (const lead of allLeads) {
      const ppId = lead?.publicProfile?.id;
      if (ppId !== undefined && ppId !== null) {
        publicProfileCounts[String(ppId)] = (publicProfileCounts[String(ppId)] || 0) + 1;
      }
    }

    report.section_1_leads_publicProfile_analysis = {
      total_leads_fetched: allLeads.length,
      distinct_publicProfile_ids: Object.keys(publicProfileCounts).length,
      publicProfile_id_counts: publicProfileCounts,
      analysis: Object.keys(publicProfileCounts).length === 1 ? 'SINGLE agent account' : 'MULTIPLE agents',
    };

    // SECTION 2: 3 complete raw leads
    report.section_2_three_complete_raw_leads = allLeads.slice(0, 3).map((lead, idx) => ({
      lead_index: idx,
      complete_raw_lead: lead,
    }));

    // SECTION 3: Listings with agent objects
    console.log('[diagPFAgentMapping] Fetching listings...');
    const listingsRes = await pfFetch('/listings?page=1&perPage=10', token);
    if (listingsRes.ok) {
      const listings = listingsRes.data?.data || listingsRes.data?.listings || [];
      report.section_3_listing_agent_objects = listings.slice(0, 3).map((listing, idx) => ({
        listing_index: idx,
        listing_id: listing.id,
        complete_agent_object: listing.agent || null,
        complete_publicProfile_object: listing.publicProfile || null,
      }));
    }

    // SECTION 4: Agent resolution endpoints
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
      const res = await pfFetch(ep.path, token);
      report.section_4_agent_resolution_endpoints[ep.name] = {
        status: res.status,
        ok: res.ok,
        response_body: res.data,
      };
    }

    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});