import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Diagnostic: inspect Property Finder API lead + listing objects for agent/owner assignment fields.
 * Returns raw lead and listing samples with all fields that might indicate agent/user/owner assignment.
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

async function fetchPFLeads(token, page = 1, perPage = 10) {
  const res = await fetch(`${PF_BASE}/leads?page=${page}&perPage=${perPage}`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error('PF leads fetch failed: ' + res.status + ' ' + body);
  }
  return await res.json();
}

async function fetchPFListings(token, page = 1, perPage = 10) {
  const res = await fetch(`${PF_BASE}/listings?page=${page}&perPage=${perPage}`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error('PF listings fetch failed: ' + res.status + ' ' + body);
  }
  return await res.json();
}

function extractAgentFields(obj, prefix = '') {
  const results = {};
  if (!obj || typeof obj !== 'object') return results;
  
  const agentKeys = ['agent', 'user', 'owner', 'assignedTo', 'broker', 'listingAgent', 'publicProfile', 'assigned_agent', 'agent_id', 'user_id', 'owner_id', 'broker_id', 'contact'];
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const fullPath = prefix ? `${prefix}.${key}` : key;
    
    // Check if this key matches agent-related patterns
    if (agentKeys.some(ak => lowerKey.includes(ak.toLowerCase()))) {
      results[fullPath] = value;
    }
    
    // Recurse into nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(results, extractAgentFields(value, fullPath));
    }
    
    // Check for email/name/id fields at any level
    if (lowerKey.includes('email') || lowerKey.includes('name') || lowerKey.includes('id')) {
      if (!agentKeys.some(ak => lowerKey.includes(ak.toLowerCase()))) {
        results[fullPath] = value;
      }
    }
  }
  
  return results;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const token = await getPFToken();
    
    // Fetch leads
    const leadsRes = await fetchPFLeads(token, 1, 5);
    const leads = leadsRes.data || leadsRes.leads || [];
    
    // Fetch listings
    const listingsRes = await fetchPFListings(token, 1, 5);
    const listings = listingsRes.data || listingsRes.listings || [];
    
    const report = {
      timestamp: new Date().toISOString(),
      leads_sample: leads.map((lead, idx) => ({
        lead_index: idx,
        lead_id: lead.id,
        full_raw_lead: lead,
        extracted_agent_fields: extractAgentFields(lead),
      })),
      listings_sample: listings.map((listing, idx) => ({
        listing_index: idx,
        listing_id: listing.id,
        reference: listing.reference,
        full_raw_listing: listing,
        extracted_agent_fields: extractAgentFields(listing),
      })),
      summary: {
        leads_count: leads.length,
        listings_count: listings.length,
        note: 'Check extracted_agent_fields in each sample for agent/user/owner assignment data',
      },
    };
    
    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});