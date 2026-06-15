import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Sync Property Finder leads from PF API into CRM Lead entity.
 * - perPage capped at 50 (PF API max)
 * - MAX_LEADS = 300 per run (5-min automation keeps DB fresh)
 * - Dedup by pf_lead_id: update existing, create new
 * - Null-guard: skip any lead with no pf_lead_id
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
  if (!res.ok) throw new Error('PF auth failed: ' + res.status + ' ' + await res.text());
  const data = await res.json();
  return data.accessToken;
}

async function fetchPFUsers(token) {
  const res = await fetch(`${PF_BASE}/users`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error('PF users failed: ' + res.status);
  const json = await res.json();
  const users = json.data || json.results || [];
  const map = {};
  for (const u of users) {
    if (u.publicProfile?.id && u.email) map[u.publicProfile.id] = u.email;
  }
  return map;
}

async function fetchPFLeadsPage(token, page, perPage) {
  const res = await fetch(`${PF_BASE}/leads?page=${page}&perPage=${perPage}&sort=-createdAt`, {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error('PF leads fetch failed: ' + res.status + ' ' + await res.text());
  return await res.json();
}

function resolveAgentEmail(pfLead, agentMap) {
  const id = pfLead.publicProfile?.id;
  const fallback = 'ahmad@erudite-estate.com';
  if (id && agentMap[id]) return { email: agentMap[id], unmapped: false };
  if (id) return { email: fallback, unmapped: true, publicProfileId: id };
  return { email: fallback, unmapped: false };
}

function mapPFLeadToCRM(pfLead, agentMap) {
  const sender = pfLead.sender || {};
  const phone = (sender.contacts || []).find(c => c.type === 'phone')?.value || '';
  const email = (sender.contacts || []).find(c => c.type === 'email')?.value || '';
  const pfLeadId = String(pfLead.id || '');
  const listingRef = pfLead.listing?.reference || pfLead.listing?.id || '';
  const responseLink = pfLead.responseLink || '';
  const channel = pfLead.channel || 'unknown';
  const createdAt = pfLead.createdAt || '';
  const { email: assigned_agent_email, unmapped, publicProfileId } = resolveAgentEmail(pfLead, agentMap);

  const notesParts = [`PF lead. id:${pfLeadId} | listing:${listingRef} | channel:${channel} | created:${createdAt}`];
  if (responseLink) notesParts.push(`respond:${responseLink}`);
  if (unmapped) notesParts.push(`[UNMAPPED PF profile ${publicProfileId}]`);

  return {
    pf_lead_id: pfLeadId,
    full_name: sender.name || 'Unknown',
    phone,
    email,
    source: 'property_finder',
    stage: 'intake_clarify',
    status: 'active',
    intent: 'buyer',
    closing_property_ref: listingRef,
    notes: notesParts.join(' | '),
    assigned_agent_email,
  };
}

async function withRetry(fn, attempts = 4) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      const is429 = /rate limit|429|too many/i.test(String(e?.message || e));
      if (!is429 || i === attempts) throw e;
      await new Promise(r => setTimeout(r, 600 * i));
    }
  }
  throw lastErr;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const perPage = 50;   // PF API max
    const MAX_LEADS = 300; // cap per run

    const diag = {
      pages_fetched: 0,
      total_leads_from_pf: 0,
      created_count: 0,
      updated_count: 0,
      skipped_null_id: 0,
      failed_count: 0,
      fetch_error: null,
      per_agent_counts: {},
      samples: [],
    };

    // Auth
    let token;
    try {
      token = await getPFToken();
      console.log('[syncPFLeads] Auth OK');
    } catch (err) {
      return Response.json({ ok: false, error: err.message, ...diag });
    }

    // Agent map
    let agentMap = {};
    try {
      agentMap = await fetchPFUsers(token);
      console.log('[syncPFLeads] Agent map:', Object.keys(agentMap).length, 'users');
    } catch (err) {
      console.error('[syncPFLeads] Agent map failed:', err.message);
    }

    // Build existing dedup map
    const existingLeadsMap = new Map();
    const existing = await base44.asServiceRole.entities.Lead.filter({ source: 'property_finder' });
    for (const lead of existing) {
      if (lead.pf_lead_id) existingLeadsMap.set(lead.pf_lead_id, lead);
    }
    console.log(`[syncPFLeads] ${existingLeadsMap.size} existing PF leads loaded`);

    // Fetch pages
    let page = 1;
    while (diag.total_leads_from_pf < MAX_LEADS) {
      let data;
      try {
        data = await fetchPFLeadsPage(token, page, perPage);
      } catch (err) {
        console.error('[syncPFLeads] Page fetch error:', err.message);
        diag.fetch_error = err.message;
        diag.failed_count++;
        break;
      }

      const leads = data.data || data.leads || [];
      if (leads.length === 0) break;

      const toProcess = leads.slice(0, MAX_LEADS - diag.total_leads_from_pf);
      diag.pages_fetched++;
      diag.total_leads_from_pf += toProcess.length;
      console.log(`[syncPFLeads] Page ${page}: ${toProcess.length} leads`);

      // Process in batches of 15
      for (let i = 0; i < toProcess.length; i += 15) {
        const batch = toProcess.slice(i, i + 15);
        await Promise.all(batch.map(async (pfLead) => {
          const pfLeadId = String(pfLead.id || '');

          // Null guard
          if (!pfLeadId || pfLeadId === 'undefined' || pfLeadId === '') {
            diag.skipped_null_id++;
            return;
          }

          const { email: correctAgent } = resolveAgentEmail(pfLead, agentMap);
          diag.per_agent_counts[correctAgent] = (diag.per_agent_counts[correctAgent] || 0) + 1;

          const existing = existingLeadsMap.get(pfLeadId);
          if (existing) {
            // Update agent if changed
            if (existing.assigned_agent_email !== correctAgent) {
              try {
                await withRetry(() => base44.asServiceRole.entities.Lead.update(existing.id, { assigned_agent_email: correctAgent }));
                diag.updated_count++;
              } catch (err) {
                diag.failed_count++;
              }
            }
            return;
          }

          // Create
          try {
            const crmData = mapPFLeadToCRM(pfLead, agentMap);
            const newLead = await withRetry(() => base44.asServiceRole.entities.Lead.create(crmData));
            diag.created_count++;
            existingLeadsMap.set(pfLeadId, newLead);
            if (diag.samples.length < 5) {
              diag.samples.push({ full_name: crmData.full_name, phone: crmData.phone, pf_lead_id: pfLeadId, agent: crmData.assigned_agent_email });
            }
          } catch (err) {
            console.error('[syncPFLeads] Create failed:', pfLeadId, err.message);
            diag.failed_count++;
          }
        }));

        await new Promise(r => setTimeout(r, 250));
      }

      if (diag.total_leads_from_pf >= MAX_LEADS || toProcess.length < perPage) break;
      page++;
    }

    console.log('[syncPFLeads] Done:', JSON.stringify(diag));
    return Response.json({ ok: true, ...diag });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});