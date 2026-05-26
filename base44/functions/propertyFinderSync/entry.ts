import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PF_BASE = 'https://atlas.propertyfinder.com/v1';

async function getPFToken() {
  const res = await fetch(`${PF_BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      apiKey: Deno.env.get('PROPERTY_FINDER_API_KEY'),
      apiSecret: Deno.env.get('PROPERTY_FINDER_API_SECRET'),
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error('PF auth failed: ' + res.status + ' ' + txt);
  }
  const data = await res.json();
  return data.accessToken;
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

async function fetchAllPFLeads(token) {
  const leads = [];
  let page = 1;
  const perPage = 50;
  while (true) {
    const data = await fetchPFLeadsPage(token, page, perPage);
    const items = data.data || data.leads || data.items || [];
    leads.push(...items);
    const total = (data.meta && data.meta.total) ? data.meta.total : (data.total || 0);
    if (leads.length >= total || items.length < perPage) break;
    page++;
  }
  return leads;
}

async function fetchPFListings(token) {
  const leads = [];
  let page = 1;
  const perPage = 50;
  while (true) {
    const res = await fetch(`${PF_BASE}/listings?page=${page}&perPage=${perPage}`, {
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    });
    if (!res.ok) break;
    const data = await res.json();
    const items = data.data || data.listings || data.items || [];
    leads.push(...items);
    const total = (data.meta && data.meta.total) ? data.meta.total : (data.total || 0);
    if (leads.length >= total || items.length < perPage) break;
    page++;
  }
  return leads;
}

function getSenderContact(sender, type) {
  if (!sender || !sender.contacts) return '';
  const c = sender.contacts.find(function(x) { return x.type === type; });
  return c ? c.value : '';
}

function mapPFLeadToCRM(pfLead) {
  // sender holds the real contact info
  const sender = pfLead.sender || {};
  const name = sender.name || pfLead.name || pfLead.fullName || 'Unknown';
  const phone = getSenderContact(sender, 'phone') || pfLead.phone || pfLead.phoneNumber || '';
  const email = getSenderContact(sender, 'email') || pfLead.email || '';
  const channel = pfLead.channel || 'unknown';

  const listingId = pfLead.listing ? String(pfLead.listing.id || pfLead.listing.reference || '') : '';
  const listingRef = pfLead.listing ? String(pfLead.listing.reference || '') : '';

  const agentName = (pfLead.agent && pfLead.agent.name) ? pfLead.agent.name :
    ((pfLead.agent && pfLead.agent.firstName) ? (pfLead.agent.firstName + ' ' + (pfLead.agent.lastName || '')).trim() : '');
  const agentEmail = (pfLead.agent && pfLead.agent.email) ? pfLead.agent.email : '';

  const hasCallRecording = pfLead.call && pfLead.call.recordFile ? pfLead.call.recordFile : '';

  return {
    name: name,
    phone: phone,
    email: email,
    source: 'property_finder',
    source_metadata: {
      pf_lead_id: String(pfLead.id || ''),
      listing_id: listingId,
      listing_reference: listingRef,
      channel: channel,
      pf_created_at: pfLead.createdAt || '',
      pf_status: pfLead.status || '',
      message: pfLead.message || pfLead.body || '',
      pf_agent_name: agentName,
      pf_agent_email: agentEmail,
      call_recording: hasCallRecording,
      entity_type: pfLead.entityType || '',
      public_profile_id: pfLead.publicProfile ? String(pfLead.publicProfile.id || '') : '',
      response_link: pfLead.responseLink || '',
    },
    notes: pfLead.message || pfLead.body || '',
    stage: 'new_lead',
    relationship_type: 'buyer',
    assigned_agent: agentEmail || undefined,
    assigned_agent_name: agentName || undefined,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'sync';

    // Fetch PF listings
    if (mode === 'listings') {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const token = await getPFToken();
      const listings = await fetchPFListings(token);
      return Response.json({ ok: true, listings: listings });
    }

    // Webhook mode
    if (mode === 'webhook') {
      const pfLead = body.data || body.lead || body.payload || body;
      if (!pfLead || !pfLead.id) {
        return Response.json({ ok: true, message: 'No lead data in webhook' });
      }
      const pfLeadId = String(pfLead.id);
      const crmData = mapPFLeadToCRM(pfLead);
      const existing = await base44.asServiceRole.entities.Lead.filter({ source: 'property_finder' });
      const match = existing.find(function(l) {
        return l.source_metadata && l.source_metadata.pf_lead_id === pfLeadId;
      });
      if (match) {
        await base44.asServiceRole.entities.Lead.update(match.id, Object.assign({}, crmData, { stage: match.stage }));
        return Response.json({ ok: true, action: 'updated', lead_id: match.id });
      } else {
        const created = await base44.asServiceRole.entities.Lead.create(crmData);
        return Response.json({ ok: true, action: 'created', lead_id: created.id });
      }
    }

    // Sync mode (default)
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const token = await getPFToken();
    const pfLeads = await fetchAllPFLeads(token);

    const allExisting = await base44.asServiceRole.entities.Lead.filter({ source: 'property_finder' });
    const existingMap = {};
    for (const l of allExisting) {
      if (l.source_metadata && l.source_metadata.pf_lead_id) {
        existingMap[l.source_metadata.pf_lead_id] = l;
      }
    }

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const pfLead of pfLeads) {
      try {
        const pfLeadId = String(pfLead.id || '');
        if (!pfLeadId) continue;
        const crmData = mapPFLeadToCRM(pfLead);
        if (existingMap[pfLeadId]) {
          await base44.asServiceRole.entities.Lead.update(existingMap[pfLeadId].id, Object.assign({}, crmData, { stage: existingMap[pfLeadId].stage }));
          updated++;
        } else {
          await base44.asServiceRole.entities.Lead.create(crmData);
          created++;
        }
      } catch (err) {
        errors++;
      }
    }

    return Response.json({ ok: true, total: pfLeads.length, created: created, updated: updated, errors: errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});