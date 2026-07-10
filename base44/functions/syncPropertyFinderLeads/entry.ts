import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Sync Property Finder leads from PF API into CRM Lead entity.
 * - perPage capped at 50 (PF API max)
 * - MAX_LEADS = 300 per run (5-min automation keeps DB fresh)
 * - Dedup by pf_lead_id: update existing, create new
 * - Null-guard: skip any lead with no pf_lead_id
 */

const PROD_BASE = 'https://atlas.propertyfinder.com/v1';
const SANDBOX_BASE = 'https://sandbox.atlas.propertyfinder.com/v1';
const TOKEN_SAFETY_BUFFER_MS = 60 * 1000;

/**
 * getPFToken — reads active_environment from PFCredential, returns the right JWT.
 * Returns { token, baseUrl, environment }.
 */
async function getPFToken(base44) {
  const creds = await base44.asServiceRole.entities.PFCredential.list();
  if (!creds || creds.length === 0) {
    throw new Error('No Property Finder credentials configured. Set them in Property Finder Sync → Settings.');
  }
  const cred = creds[0];
  const env = cred.active_environment || 'sandbox';
  const isSandbox = env === 'sandbox';
  const baseUrl = isSandbox ? SANDBOX_BASE : PROD_BASE;

  const apiKey = isSandbox ? cred.sandbox_api_key : cred.api_key;
  const apiSecret = isSandbox ? cred.sandbox_api_secret : cred.api_secret;
  const cachedToken = isSandbox ? cred.sandbox_access_token : cred.access_token;
  const cachedExpiry = isSandbox ? cred.sandbox_token_expires_at : cred.token_expires_at;

  const now = Date.now();

  // Return cached token if still valid
  if (cachedToken && cachedExpiry) {
    const expiresAtMs = new Date(cachedExpiry).getTime();
    if (expiresAtMs - now > TOKEN_SAFETY_BUFFER_MS) {
      return { token: cachedToken, baseUrl, environment: env };
    }
  }

  if (!apiKey || !apiSecret) {
    throw new Error(`PF ${env} API key or secret missing in PFCredential record`);
  }

  const res = await fetch(`${baseUrl}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret }),
  });
  if (!res.ok) throw new Error('PF auth failed: ' + res.status + ' ' + await res.text());
  const data = await res.json();
  const accessToken = data.accessToken;
  if (!accessToken) throw new Error('PF auth returned no accessToken');

  const expiresInSec = data.expiresIn || 1800;
  const expiresAt = new Date(now + expiresInSec * 1000 - TOKEN_SAFETY_BUFFER_MS).toISOString();
  const updateData = isSandbox
    ? { sandbox_access_token: accessToken, sandbox_token_expires_at: expiresAt }
    : { access_token: accessToken, token_expires_at: expiresAt };
  if (data.scopes) updateData.scopes_granted = Array.isArray(data.scopes) ? data.scopes : [data.scopes];
  await base44.asServiceRole.entities.PFCredential.update(cred.id, updateData);

  return { token: accessToken, baseUrl, environment: env };
}

async function fetchPFUsers(token, baseUrl) {
  const res = await fetch(`${baseUrl}/users`, {
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

async function fetchPFLeadsPage(token, baseUrl, page, perPage) {
  const res = await fetch(`${baseUrl}/leads?page=${page}&perPage=${perPage}&sort=-createdAt`, {
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

async function notifyAgent(base44, lead, crmData) {
  const agentEmail = crmData.assigned_agent_email;
  const leadName = crmData.full_name || 'Unknown';
  const listingRef = crmData.closing_property_ref || '';
  const leadId = lead.id;

  // 1. CRM in-app notification
  try {
    await base44.asServiceRole.entities.Notification.create({
      type: 'lead_assigned',
      title: '🎯 New PF Lead Assigned',
      message: `${leadName} enquired about ${listingRef || 'your listing'} on Property Finder.`,
      recipient_email: agentEmail,
      lead_id: leadId,
      is_read: false,
    });
  } catch (e) { console.error('[notify] CRM notification failed:', e.message); }

  // 2. Email notification
  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: agentEmail,
      subject: `🎯 New Lead: ${leadName} — Property Finder`,
      body: `Hi,\n\nYou have a new lead from Property Finder:\n\nName: ${leadName}\nPhone: ${crmData.phone || '—'}\nListing: ${listingRef || '—'}\n\nLog in to the CRM to follow up.\n\nErudite CRM`,
    });
  } catch (e) { console.error('[notify] Email failed:', e.message); }

  // 3. WhatsApp notification — look up agent's phone
  try {
    const agentUsers = await base44.asServiceRole.entities.User.filter({ email: agentEmail });
    const agent = agentUsers[0];
    if (agent?.phone) {
      const waPhone = String(agent.phone).replace(/\D/g, '');
      const waMsg = `🎯 *New Lead — Property Finder*\n\nName: ${leadName}\nPhone: ${crmData.phone || '—'}\nListing: ${listingRef || '—'}\n\nLog in to the CRM to follow up immediately.`;
      await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
        to_phone: waPhone.startsWith('0') ? '971' + waPhone.slice(1) : waPhone,
        message: waMsg,
        message_text: waMsg,
      });
    }
  } catch (e) { console.error('[notify] WhatsApp failed:', e.message); }
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
    let token, baseUrl, environment;
    try {
      ({ token, baseUrl, environment } = await getPFToken(base44));
      console.log(`[syncPFLeads] Auth OK — environment: ${environment}, baseUrl: ${baseUrl}`);
    } catch (err) {
      return Response.json({ ok: false, error: err.message, ...diag });
    }

    // Agent map
    let agentMap = {};
    try {
      agentMap = await fetchPFUsers(token, baseUrl);
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
        data = await fetchPFLeadsPage(token, baseUrl, page, perPage);
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
            // Fire-and-forget: notify the assigned agent via email, WhatsApp, and CRM notification
            if (crmData.assigned_agent_email) {
              notifyAgent(base44, newLead, crmData).catch(e => console.error('[syncPFLeads] notify failed:', e.message));
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
    return Response.json({ ok: true, environment, ...diag });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});