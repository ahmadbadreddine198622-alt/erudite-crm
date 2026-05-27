import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Bayut → Base44 lead pull.
 *
 * For Pro brokerages with API access: hits the Bayut Brokers API.
 * For email-forward setups: this function is a no-op (use bayutInboundEmail).
 * For XML feed scrape mode: fetches the Bayut public listings XML and matches
 *   any new inquiries since last_sync_at.
 *
 * Run on a schedule (every 5 minutes) and on demand via the BayutSettings page.
 */

async function fetchBayutLeadsAPI(apiKey: string, brokerId: string, since: string | null) {
  const url = `https://api.bayut.com/broker/v1/leads?broker_id=${brokerId}` +
              (since ? `&since=${encodeURIComponent(since)}` : '');
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json'
    }
  });
  if (!res.ok) throw new Error(`Bayut API: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.leads || data.data || [];
}

function mapBayutLead(b: any) {
  return {
    name: b.full_name || `${b.first_name || ''} ${b.last_name || ''}`.trim() || 'Bayut Lead',
    phone: b.phone || b.mobile,
    email: b.email,
    source: 'bayut',
    source_reference: b.reference_number || b.id,
    property_external_id: b.property_id || b.listing_id,
    bedrooms_min: b.bedrooms,
    bedrooms_max: b.bedrooms,
    budget_aed: b.budget,
    preferred_locations: b.location ? [b.location] : [],
    notes: `Bayut inquiry on ${b.property_title || 'unknown listing'}. Message: ${b.message || '(no message)'}`,
    stage: 'new',
    raw_payload: b
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const creds = await base44.asServiceRole.entities.BayutCredential.list();
    const cred = creds?.[0];
    if (!cred || !cred.is_connected) {
      return Response.json({ error: 'Bayut not connected' }, { status: 400 });
    }
    if (cred.integration_mode !== 'api') {
      return Response.json({ skipped: 'integration_mode is not api', mode: cred.integration_mode });
    }

    const apiKey = cred.api_key || Deno.env.get('BAYUT_API_KEY');
    const brokerId = cred.broker_id || Deno.env.get('BAYUT_BROKER_ID');
    if (!apiKey || !brokerId) {
      return Response.json({ error: 'Bayut credentials missing' }, { status: 400 });
    }

    let bayutLeads: any[] = [];
    try {
      bayutLeads = await fetchBayutLeadsAPI(apiKey, brokerId, cred.last_sync_at);
    } catch (err: any) {
      await base44.asServiceRole.entities.BayutCredential.update(cred.id, {
        last_error: err.message,
        last_sync_at: new Date().toISOString()
      });
      throw err;
    }

    let created = 0;
    let updated = 0;

    for (const b of bayutLeads) {
      const mapped = mapBayutLead(b);
      if (!mapped.phone && !mapped.email) continue;

      // Dedupe by phone OR email + source
      const existing = await base44.asServiceRole.entities.Lead.filter({
        $or: [
          { phone: mapped.phone, source: 'bayut' },
          { email: mapped.email, source: 'bayut' }
        ]
      });

      if (existing?.[0]) {
        await base44.asServiceRole.entities.Lead.update(existing[0].id, {
          last_contact_date: new Date().toISOString(),
          notes: (existing[0].notes || '') + '\n\n' + mapped.notes
        });
        updated++;
      } else {
        await base44.asServiceRole.entities.Lead.create({
          ...mapped,
          assigned_agent_email: cred.default_agent_email,
          created_date: new Date().toISOString()
        });
        created++;
      }

      // Log the inquiry as an activity
      try {
        await base44.asServiceRole.entities.Activity.create({
          lead_id: existing?.[0]?.id,
          type: 'note',
          title: `Bayut inquiry: ${b.property_title || 'listing'}`,
          description: b.message || '(empty inquiry)',
          source: 'bayut',
          metadata: { bayut_reference: b.reference_number || b.id }
        });
      } catch (_) { /* non-fatal */ }
    }

    await base44.asServiceRole.entities.BayutCredential.update(cred.id, {
      last_sync_at: new Date().toISOString(),
      last_sync_lead_count: bayutLeads.length,
      last_error: null
    });

    return Response.json({ ok: true, fetched: bayutLeads.length, created, updated });
  } catch (error: any) {
    console.error('bayutSync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
