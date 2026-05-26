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

async function fetchAllPFLeads(token) {
  const leads = [];
  let page = 1;
  const perPage = 50;
  while (true) {
    const res = await fetch(`${PF_BASE}/leads?page=${page}&perPage=${perPage}`, {
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error('PF leads fetch failed: ' + res.status + ' ' + body);
    }
    const data = await res.json();
    const items = data.data || data.leads || data.items || [];
    leads.push(...items);
    const total = (data.meta && data.meta.total) ? data.meta.total : (data.total || 0);
    if (leads.length >= total || items.length < perPage) break;
    page++;
  }
  return leads;
}

function mapPFLeadToCRM(pfLead) {
  const firstName = pfLead.firstName || '';
  const lastName = pfLead.lastName || '';
  const name = (firstName + ' ' + lastName).trim() || pfLead.name || 'Unknown';
  return {
    name: name,
    phone: pfLead.phone || pfLead.phoneNumber || '',
    email: pfLead.email || '',
    source: 'property_finder',
    source_metadata: {
      pf_lead_id: String(pfLead.id || pfLead.leadId || ''),
      listing_id: String((pfLead.listing && pfLead.listing.id) ? pfLead.listing.id : (pfLead.listingId || '')),
      listing_title: (pfLead.listing && pfLead.listing.title) ? pfLead.listing.title : '',
      pf_created_at: pfLead.createdAt || '',
      message: pfLead.message || pfLead.notes || '',
    },
    notes: pfLead.message || pfLead.notes || '',
    stage: 'new_lead',
    relationship_type: 'buyer',
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'sync';

    if (mode === 'webhook') {
      const pfLead = body.data || body.lead || body.payload || body;
      if (!pfLead || (!pfLead.id && !pfLead.leadId)) {
        return Response.json({ ok: true, message: 'No lead data in webhook' });
      }
      const pfLeadId = String(pfLead.id || pfLead.leadId);
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

    // sync mode
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
        const pfLeadId = String(pfLead.id || pfLead.leadId || '');
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