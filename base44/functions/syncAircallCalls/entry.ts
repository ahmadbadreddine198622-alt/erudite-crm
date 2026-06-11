import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Syncs call history from Aircall REST API into CRM.
 * Matches callers to Leads and Landlords by phone number.
 * Stores/updates AircallCall records and logs Activity entries.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const AIRCALL_API_ID = Deno.env.get('AIRCALL_API_ID');
    const AIRCALL_API_TOKEN = Deno.env.get('AIRCALL_API_TOKEN');

    if (!AIRCALL_API_ID || !AIRCALL_API_TOKEN) {
      return Response.json({ error: 'Aircall API credentials not configured. Set AIRCALL_API_ID and AIRCALL_API_TOKEN in secrets.' }, { status: 500 });
    }

    const basicAuth = btoa(`${AIRCALL_API_ID}:${AIRCALL_API_TOKEN}`);
    const headers = { 'Authorization': `Basic ${basicAuth}`, 'Content-Type': 'application/json' };

    // Fetch recent calls from Aircall (last 200)
    const callsRes = await fetch('https://api.aircall.io/v1/calls?per_page=50&order=DESC', { headers });
    if (!callsRes.ok) {
      const err = await callsRes.text();
      return Response.json({ error: `Aircall API error: ${callsRes.status} — ${err}` }, { status: 502 });
    }
    const callsData = await callsRes.json();
    const aircallCalls = callsData.calls || [];

    // Fetch Aircall contacts for name enrichment
    let aircallContacts = [];
    try {
      const contactsRes = await fetch('https://api.aircall.io/v1/contacts?per_page=200', { headers });
      if (contactsRes.ok) {
        const cd = await contactsRes.json();
        aircallContacts = cd.contacts || [];
      }
    } catch (_) {}

    const contactByPhone = {};
    for (const c of aircallContacts) {
      const phones = c.phone_numbers || [];
      for (const p of phones) {
        const normalized = normalizePhone(p.value);
        if (normalized) contactByPhone[normalized] = c;
      }
    }

    // Fetch existing AircallCall records (dedup by aircall_id)
    const existingCalls = await base44.asServiceRole.entities.AircallCall.list('-started_at', 500);
    const existingIds = new Set(existingCalls.map(c => String(c.aircall_id)));

    // Fetch CRM Leads and Landlords for phone matching
    const [leads, landlords] = await Promise.all([
      base44.asServiceRole.entities.Lead.list('-created_date', 1000),
      base44.asServiceRole.entities.Landlord.list('-created_date', 1000),
    ]);

    // Build phone → entity maps
    const leadByPhone = {};
    for (const l of leads) {
      const p = normalizePhone(l.phone);
      if (p) leadByPhone[p] = l;
    }
    const landlordByPhone = {};
    for (const l of landlords) {
      const p = normalizePhone(l.phone);
      if (p) landlordByPhone[p] = l;
    }

    let synced = 0;
    let updated = 0;

    for (const call of aircallCalls) {
      const aircall_id = String(call.id);
      const direction = call.direction || 'inbound';
      const rawStatus = call.status || 'done';
      const status = ['done', 'missed', 'voicemail', 'busy'].includes(rawStatus) ? rawStatus : 'done';
      const duration = call.duration || 0;
      const started_at = call.started_at ? new Date(call.started_at * 1000).toISOString() : null;
      const ended_at = call.ended_at ? new Date(call.ended_at * 1000).toISOString() : null;

      // Extract phone numbers
      const rawFrom = call.number?.digits || call.raw_digits || '';
      const rawTo = call.asset || call.number?.digits || '';
      const callerPhone = direction === 'inbound'
        ? (call.raw_digits || call.number?.digits || '')
        : (call.number?.digits || '');
      const normalizedCaller = normalizePhone(callerPhone);

      // Agent info
      const agent_name = call.user?.name || '';
      const agent_email = call.user?.email || '';

      // Recording
      const recording_url = call.recording || null;

      // Line name
      const aircall_line_name = call.number?.name || '';

      // Match contact name
      let lead_id = null;
      let lead_name = null;
      const contact = normalizedCaller ? contactByPhone[normalizedCaller] : null;
      const contactName = contact ? [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() : null;

      // Match to CRM Lead
      if (normalizedCaller && leadByPhone[normalizedCaller]) {
        const crmLead = leadByPhone[normalizedCaller];
        lead_id = crmLead.id;
        lead_name = crmLead.full_name || contactName;
      } else if (contactName) {
        lead_name = contactName;
      }

      // Match to Landlord (for enrichment)
      let landlord_id = null;
      if (normalizedCaller && landlordByPhone[normalizedCaller]) {
        const crmLandlord = landlordByPhone[normalizedCaller];
        landlord_id = crmLandlord.id;
        if (!lead_name) lead_name = crmLandlord.full_name_en || crmLandlord.full_name;
      }

      const tags = (call.tags || []).map(t => t.name || t);

      if (existingIds.has(aircall_id)) {
        // Update recording/transcript if now available
        const existing = existingCalls.find(c => String(c.aircall_id) === aircall_id);
        if (existing && recording_url && !existing.recording_url) {
          await base44.asServiceRole.entities.AircallCall.update(existing.id, { recording_url, lead_name: lead_name || existing.lead_name });
          updated++;
        }
        continue;
      }

      // Create new AircallCall record
      await base44.asServiceRole.entities.AircallCall.create({
        aircall_id,
        direction,
        status,
        duration,
        started_at,
        ended_at,
        from_number: call.raw_digits || callerPhone || '',
        to_number: call.number?.digits || '',
        aircall_line_name,
        agent_name,
        agent_email,
        recording_url,
        lead_id: lead_id || '',
        lead_name: lead_name || '',
        tags,
        notes: status === 'missed' ? 'Missed call' : '',
      });
      synced++;

      // Log Activity on matched Lead
      if (lead_id) {
        await base44.asServiceRole.entities.Activity.create({
          lead_id,
          type: 'call',
          direction,
          title: `Aircall ${direction === 'inbound' ? 'Inbound' : 'Outbound'} Call`,
          description: `Duration: ${formatDuration(duration)}${status === 'missed' ? ' (Missed)' : ''}`,
          channel: 'phone',
          status: status === 'done' ? 'completed' : status,
          completed_at: ended_at || new Date().toISOString(),
          agent_email,
          agent_name,
          source: 'aircall_webhook',
          metadata: { aircall_id, duration, recording_url, tags },
        });
      }
    }

    // Also push CRM contacts back to Aircall (name enrichment)
    // For each AircallCall without a lead_name, try to push contact to Aircall
    let contactsPushed = 0;
    const unlabeled = await base44.asServiceRole.entities.AircallCall.filter({ lead_name: '' });
    for (const call of unlabeled.slice(0, 20)) {
      const phone = call.from_number;
      const normalized = normalizePhone(phone);
      if (!normalized) continue;
      const lead = leadByPhone[normalized] || null;
      const landlord = landlordByPhone[normalized] || null;
      const name = lead?.full_name || landlord?.full_name_en || null;
      if (name) {
        await base44.asServiceRole.entities.AircallCall.update(call.id, { lead_name: name, lead_id: lead?.id || '' });
        contactsPushed++;
      }
    }

    return Response.json({
      success: true,
      synced,
      updated,
      contactsPushed,
      total: aircallCalls.length,
      message: `Synced ${synced} new calls, updated ${updated}, enriched ${contactsPushed} contacts`,
    });
  } catch (error) {
    console.error('syncAircallCalls error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function normalizePhone(phone) {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('971') && cleaned.length === 12) return `+${cleaned}`;
  if (cleaned.startsWith('0') && cleaned.length === 10) return `+971${cleaned.substring(1)}`;
  if (cleaned.length >= 7 && cleaned.length <= 15) return `+${cleaned}`;
  return null;
}

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}