import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * DIAGNOSTIC ONLY - Read-only probe of Property Finder Lead API.
 * Tests whether we can fetch buyer details (name, phone, inquiry) for a lead.
 * Does NOT create or modify any entities.
 */

const PF_BASE = 'https://atlas.propertyfinder.com/v1';

async function getPFToken(apiKey, apiSecret) {
  const key = apiKey || Deno.env.get('PROPERTY_FINDER_API_KEY');
  const secret = apiSecret || Deno.env.get('PROPERTY_FINDER_API_SECRET');
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    
    // Test reference from WhatsApp notification
    const targetReference = body.reference || 'JA6PVYJ04VC4R2NGH20FWZ134M';
    
    const results = {
      auth: null,
      endpoints_tested: [],
      buyer_data_found: null,
      matching_lead: null,
      raw_responses: [],
      summary: '',
    };

    // Step 1: Get auth token
    const token = await getPFToken();
    results.auth = {
      ok: true,
      token_acquired_ms: Date.now(),
    };
    
    // Step 2: Fetch leads list (this contains sender/buyer data inline)
    const leadsRes = await fetch(`${PF_BASE}/leads?page=1&perPage=20`, {
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    });
    const leadsBody = await leadsRes.json().catch(() => null);
    
    results.endpoints_tested.push({
      endpoint: 'GET /leads',
      url: `${PF_BASE}/leads?page=1&perPage=20`,
      status: leadsRes.status,
      ok: leadsRes.ok,
      response_size_chars: JSON.stringify(leadsBody).length,
    });
    
    if (leadsRes.ok && leadsBody) {
      const leads = leadsBody.data || leadsBody.leads || [];
      
      // Look for the target reference
      const matchingLead = leads.find(l => 
        l.listing?.reference === targetReference || 
        l.listing?.id === targetReference
      );
      
      if (matchingLead) {
        const sender = matchingLead.sender || {};
        const phoneContact = (sender.contacts || []).find(c => c.type === 'phone');
        const emailContact = (sender.contacts || []).find(c => c.type === 'email');
        
        results.matching_lead = {
          lead_id: matchingLead.id,
          channel: matchingLead.channel,
          created_at: matchingLead.createdAt,
          status: matchingLead.status,
          
          // BUYER INFO (from sender object) - THIS IS THE ANSWER
          buyer_name: sender.name || null,
          buyer_phone: phoneContact?.value || null,
          buyer_email: emailContact?.value || null,
          buyer_contacts: sender.contacts || [],
          
          // LISTING INFO (what they inquired about)
          listing_id: matchingLead.listing?.id || null,
          listing_reference: matchingLead.listing?.reference || null,
          
          // MESSAGE/INQUIRY CONTENT
          message: matchingLead.message || matchingLead.body || null,
          
          // AGENT INFO (who the lead is assigned to)
          agent_name: matchingLead.assignedTo?.name || null,
          agent_email: matchingLead.assignedTo?.email || null,
          
          // RESPONSE LINK (the URL to respond via PF)
          response_link: matchingLead.responseLink || null,
        };
        
        results.buyer_data_found = {
          name: sender.name,
          phone: phoneContact?.value,
          email: emailContact?.value,
          listing_reference: matchingLead.listing?.reference,
        };
        
        results.summary = `✅ FOUND: Lead with reference ${targetReference} has buyer "${sender.name}" (${phoneContact?.value})`;
      } else {
        results.summary = `❌ NOT FOUND: No lead with reference ${targetReference} in first 20 leads`;
        
        // Show what we DID find
        if (leads.length > 0) {
          results.raw_responses.push({
            source: 'Available leads (first 3)',
            data: leads.slice(0, 3).map(l => ({
              id: l.id,
              reference: l.listing?.reference,
              sender_name: l.sender?.name,
              sender_phone: (l.sender?.contacts || []).find(c => c.type === 'phone')?.value,
            })),
          });
        }
      }
      
      // Also include raw sample
      results.raw_responses.push({
        source: 'Full lead structure (first item)',
        data: leads[0] || null,
      });
    }

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});