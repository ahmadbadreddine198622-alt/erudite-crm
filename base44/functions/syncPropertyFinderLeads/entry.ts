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
  // Sort by createdAt descending (newest first)
  const res = await fetch(`${PF_BASE}/leads?page=${page}&perPage=${perPage}&sort=-createdAt`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error('PF leads fetch failed: ' + res.status + ' ' + body);
  }
  return await res.json();
}

function resolveAgentEmail(pfLead, agentMap) {
  const publicProfileId = pfLead.publicProfile?.id;
  const fallbackEmail = 'ahmad@erudite-estate.com';
  
  if (publicProfileId && agentMap[publicProfileId]) {
    return { email: agentMap[publicProfileId], unmapped: false };
  } else if (publicProfileId) {
    return { email: fallbackEmail, unmapped: true, publicProfileId };
  }
  return { email: fallbackEmail, unmapped: false };
}

function mapPFLeadToCRM(pfLead, agentMap) {
  const sender = pfLead.sender || {};
  const phoneContact = (sender.contacts || []).find(c => c.type === 'phone');
  const emailContact = (sender.contacts || []).find(c => c.type === 'email');
  
  const pfLeadId = String(pfLead.id || '');
  const listingRef = pfLead.listing?.reference || pfLead.listing?.id || '';
  const responseLink = pfLead.responseLink || '';
  const channel = pfLead.channel || 'unknown';
  const createdAt = pfLead.createdAt || '';
  
  const { email: assigned_agent_email, unmapped, publicProfileId } = resolveAgentEmail(pfLead, agentMap);
  
  // Build notes
  const notesParts = [
    `PF lead. id:${pfLeadId} | listing:${listingRef} | channel:${channel} | created:${createdAt}`,
  ];
  if (responseLink) {
    notesParts.push(`respond:${responseLink}`);
  }
  if (unmapped) {
    notesParts.push(`[UNMAPPED PF profile ${publicProfileId}]`);
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
    assigned_agent_email,
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
    const perPage = 100; // Fetch 100 per page for efficiency
    const MAX_LEADS = 1000; // Hard cap: only sync latest 1,000 leads
    
    const diagnostics = {
      pages_fetched: 0,
      total_leads_from_pf: 0,
      created_count: 0,
      skipped_count: 0,
      failed_count: 0,
      per_agent_counts: {},
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

    // Fetch agent map once: publicProfile.id → email
    let agentMap = {};
    try {
      agentMap = await fetchPFUsers(token);
      console.log('[syncPFLeads] Agent map loaded:', Object.keys(agentMap).length, 'users');
    } catch (err) {
      console.error('[syncPFLeads] Failed to load agent map:', err.message);
      agentMap = {};
    }

    // Build dedup map of existing PF leads by pf_lead_id field
    const existingPFLeadIds = new Set();
    const existingLeads = await base44.asServiceRole.entities.Lead.filter({ source: 'property_finder' });
    const existingLeadsMap = new Map();
    for (const lead of existingLeads) {
      if (lead.pf_lead_id) {
        existingPFLeadIds.add(lead.pf_lead_id);
        existingLeadsMap.set(lead.pf_lead_id, lead);
      }
    }
    console.log(`[syncPFLeads] Found ${existingPFLeadIds.size} existing PF leads for dedup`);

    // Fetch and process leads page by page (newest-first, cap at 1,000)
    let page = 1;
    while (diagnostics.total_leads_from_pf < MAX_LEADS) {
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
      
      // Cap at MAX_LEADS
      const remaining = MAX_LEADS - diagnostics.total_leads_from_pf;
      const leadsToProcess = leads.slice(0, remaining);
      
      diagnostics.pages_fetched++;
      diagnostics.total_leads_from_pf += leadsToProcess.length;
      console.log(`[syncPFLeads] Page ${page}: ${leadsToProcess.length} leads (total: ${diagnostics.total_leads_from_pf}/${MAX_LEADS})`);
      
      // Process leads in batches of 20 with throttling
      const batchSize = 20;
      for (let i = 0; i < leadsToProcess.length; i += batchSize) {
        const batch = leadsToProcess.slice(i, i + batchSize);
        const batchPromises = batch.map(async (pfLead) => {
          const pfLeadId = String(pfLead.id || '');
          const publicProfileId = pfLead.publicProfile?.id;
          const { email: correctAgentEmail } = resolveAgentEmail(pfLead, agentMap);
          
          // Track per-agent counts
          diagnostics.per_agent_counts[correctAgentEmail] = (diagnostics.per_agent_counts[correctAgentEmail] || 0) + 1;
          
          // Check if lead already exists
          const existingLead = existingLeadsMap.get(pfLeadId);
          if (existingLead) {
            // UPDATE: correct the assigned_agent_email if it's wrong
            if (existingLead.assigned_agent_email !== correctAgentEmail) {
              try {
                await withRetry(() =>
                  base44.asServiceRole.entities.Lead.update(existingLead.id, {
                    assigned_agent_email: correctAgentEmail,
                  })
                );
                console.log('[syncPFLeads] Updated agent for', pfLeadId, ':', existingLead.assigned_agent_email, '→', correctAgentEmail);
              } catch (err) {
                console.error('[syncPFLeads] Update failed for', pfLeadId, ':', err.message);
                diagnostics.failed_count++;
              }
            }
            diagnostics.skipped_count++; // counted as "not created" but may have been updated
            return;
          }
          
          // Create new lead
          try {
            const crmData = mapPFLeadToCRM(pfLead, agentMap);
            const newLead = await withRetry(() => 
              base44.asServiceRole.entities.Lead.create(crmData)
            );
            
            diagnostics.created_count++;
            existingPFLeadIds.add(pfLeadId);
            existingLeadsMap.set(pfLeadId, newLead);
            
            // Collect samples (first 5)
            if (diagnostics.samples.length < 5) {
              diagnostics.samples.push({
                full_name: crmData.full_name,
                phone: crmData.phone,
                closing_property_ref: crmData.closing_property_ref,
                pf_lead_id: pfLeadId,
                assigned_agent_email: crmData.assigned_agent_email,
              });
            }
          } catch (err) {
            console.error('[syncPFLeads] Create failed for', pfLeadId, ':', err.message);
            diagnostics.failed_count++;
          }
        });
        
        await Promise.all(batchPromises);
        
        // Throttle between batches
        if (diagnostics.total_leads_from_pf < MAX_LEADS && i + batchSize < leadsToProcess.length) {
          await new Promise(r => setTimeout(r, 400));
        }
      }
      
      // Stop if we've hit the cap or got a partial page
      if (diagnostics.total_leads_from_pf >= MAX_LEADS) {
        console.log('[syncPFLeads] Reached 1,000 lead cap, stopping');
        break;
      }
      if (leadsToProcess.length < perPage) {
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