import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Sync Property Finder leads from PF API into CRM Lead entity.
 * Uses buyer name/phone from sender.*, deduped by PF lead id.
 * Reuses auth + endpoints from propertyFinderSync.
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

async function fetchPFUsers(token) {
  const res = await fetch(`${PF_BASE}/users`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error('PF users fetch failed: ' + res.status + ' ' + body);
  }
  const json = await res.json();
  const users = json.data || json.results || [];
  // Build map: publicProfile.id (number) → email
  const map = {};
  for (const u of users) {
    if (u.publicProfile?.id && u.email) {
      map[u.publicProfile.id] = u.email;
    }
  }
  return map;
}

async function fetchPFLeadsPage(token, page, perPage) {
  const res = await fetch(`${PF_BASE}/leads?page=${page}&perPage=${perPage}`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error('PF leads fetch failed: ' + res.status + ' ' + body);
  }
  return await res.json();
}

function mapPFLeadToCRM(pfLead) {
  const sender = pfLead.sender || {};
  const phoneContact = (sender.contacts || []).find(c => c.type === 'phone');
  const emailContact = (sender.contacts || []).find(c => c.type === 'email');
  
  const pfLeadId = String(pfLead.id || '');
  const listingRef = pfLead.listing?.reference || pfLead.listing?.id || '';
  const responseLink = pfLead.responseLink || '';
  const channel = pfLead.channel || 'unknown';
  const createdAt = pfLead.createdAt || '';
  
  // Build notes
  const notesParts = [
    `PF lead. id:${pfLeadId} | listing:${listingRef} | channel:${channel} | created:${createdAt}`,
  ];
  if (responseLink) {
    notesParts.push(`respond:${responseLink}`);
  }
  const notes = notesParts.join(' | ');
  
  return {
    pf_lead_id: pfLeadId,
    full_name: sender.name || 'Unknown',
    phone: phoneContact?.value || '',
    email: emailContact?.value || '',
    source: 'property_finder',
    stage: 'intake_clarify',
    status: 'active',
    intent: 'buyer',
    closing_property_ref: listingRef,
    notes: notes,
    assigned_agent_email: 'ahmad.badreddine198622@gmail.com',
  };
}

async function withRetry(fn, attempts = 6) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      const is429 = e?.status === 429 || /rate limit|429|too many requests/i.test(msg);
      if (!is429 || i === attempts) {
        console.warn(`[withRetry] failed after ${i} attempts: ${msg}`);
        throw e;
      }
      const delay = 500 * Math.pow(2, i - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const maxPages = body.maxPages || 5; // Default: fetch 5 pages (250 leads)
    const perPage = 50;
    
    const diagnostics = {
      pages_fetched: 0,
      total_leads_from_pf: 0,
      created_count: 0,
      skipped_count: 0,
      failed_count: 0,
      samples: [],
    };

    // Get auth token
    let token;
    try {
      token = await getPFToken();
      console.log('[syncPFLeads] Auth successful');
    } catch (err) {
      return Response.json({
        ok: false,
        error: err.message,
        ...diagnostics,
      });
    }

    // Build dedup map of existing PF leads by pf_lead_id field
    const existingPFLeadIds = new Set();
    const existingLeads = await base44.asServiceRole.entities.Lead.filter({ source: 'property_finder' });
    for (const lead of existingLeads) {
      if (lead.pf_lead_id) {
        existingPFLeadIds.add(lead.pf_lead_id);
      }
    }
    console.log(`[syncPFLeads] Found ${existingPFLeadIds.size} existing PF leads for dedup`);

    // Fetch and process leads page by page
    let page = 1;
    while (page <= maxPages) {
      let data;
      try {
        data = await fetchPFLeadsPage(token, page, perPage);
      } catch (err) {
        console.error('[syncPFLeads] Fetch failed page=' + page + ':', err.message);
        diagnostics.failed_count++;
        break;
      }
      
      const leads = data.data || data.leads || [];
      if (leads.length === 0) {
        console.log('[syncPFLeads] Empty page, stopping');
        break;
      }
      
      diagnostics.pages_fetched++;
      diagnostics.total_leads_from_pf += leads.length;
      console.log(`[syncPFLeads] Page ${page}: ${leads.length} leads`);
      
      // Process leads in batches of 20 with throttling
      const batchSize = 20;
      for (let i = 0; i < leads.length; i += batchSize) {
        const batch = leads.slice(i, i + batchSize);
        const batchPromises = batch.map(async (pfLead) => {
          const pfLeadId = String(pfLead.id || '');
          
          // Dedupe check
          if (existingPFLeadIds.has(pfLeadId)) {
            diagnostics.skipped_count++;
            return;
          }
          
          // Map and create
          try {
            const crmData = mapPFLeadToCRM(pfLead);
            const newLead = await withRetry(() => 
              base44.asServiceRole.entities.Lead.create(crmData)
            );
            
            diagnostics.created_count++;
            existingPFLeadIds.add(pfLeadId);
            
            // Collect samples (first 5)
            if (diagnostics.samples.length < 5) {
              diagnostics.samples.push({
                full_name: crmData.full_name,
                phone: crmData.phone,
                closing_property_ref: crmData.closing_property_ref,
                pf_lead_id: pfLeadId,
              });
            }
          } catch (err) {
            console.error('[syncPFLeads] Create failed for', pfLeadId, ':', err.message);
            diagnostics.failed_count++;
          }
        });
        
        await Promise.all(batchPromises);
        
        // Throttle between batches
        if (page < maxPages || i + batchSize < leads.length) {
          await new Promise(r => setTimeout(r, 400));
        }
      }
      
      // Check if there are more pages
      if (leads.length < perPage) {
        console.log('[syncPFLeads] Partial page, stopping');
        break;
      }
      
      page++;
    }

    console.log('[syncPFLeads] Done:', JSON.stringify(diagnostics));
    
    return Response.json({
      ok: true,
      ...diagnostics,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});