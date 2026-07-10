import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Full CRM → Aircall contact sync.
 * Creates missing contacts and updates existing ones so names
 * appear on both inbound and outbound calls.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const AIRCALL_API_ID = Deno.env.get('AIRCALL_API_ID');
    const AIRCALL_API_TOKEN = Deno.env.get('AIRCALL_API_TOKEN');
    if (!AIRCALL_API_ID || !AIRCALL_API_TOKEN) {
      return Response.json({ error: 'Aircall credentials not configured' }, { status: 500 });
    }

    const basicAuth = btoa(`${AIRCALL_API_ID}:${AIRCALL_API_TOKEN}`);
    const headers = { 'Authorization': `Basic ${basicAuth}`, 'Content-Type': 'application/json' };

    // --- 1. Fetch ALL existing Aircall contacts (paginated) ---
    const aircallContactMap = {}; // normalized phone → { id, first_name, last_name }
    let page = 1;
    while (true) {
      const res = await fetch(`https://api.aircall.io/v1/contacts?per_page=200&page=${page}`, { headers });
      if (!res.ok) break;
      const data = await res.json();
      const contacts = data.contacts || [];
      for (const c of contacts) {
        for (const p of (c.phone_numbers || [])) {
          const norm = normalizePhone(p.value);
          if (norm) aircallContactMap[norm] = { id: c.id, first_name: c.first_name, last_name: c.last_name };
        }
      }
      if (contacts.length < 200) break;
      page++;
    }

    // --- 2. Fetch CRM Leads + Landlords ---
    const [leads, landlords] = await Promise.all([
      base44.asServiceRole.entities.Lead.list('-created_date', 2000),
      base44.asServiceRole.entities.Landlord.list('-created_date', 2000),
    ]);

    // Build deduplicated CRM contact list (phone → name)
    const crmContacts = {}; // normalized phone → name
    for (const lead of leads) {
      const p = normalizePhone(lead.phone);
      const name = (lead.full_name || '').trim();
      if (p && name) crmContacts[p] = name;
    }
    for (const ll of landlords) {
      const p = normalizePhone(ll.phone);
      const name = (ll.full_name_en || ll.full_name || '').trim();
      if (p && name && !crmContacts[p]) crmContacts[p] = name; // leads take priority on dupe
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const [phone, name] of Object.entries(crmContacts)) {
      const [firstName, ...rest] = name.split(' ');
      const lastName = rest.join(' ') || '';
      const existing = aircallContactMap[phone];

      if (!existing) {
        // Create new contact
        const res = await fetch('https://api.aircall.io/v1/contacts', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            phone_numbers: [{ label: 'mobile', value: phone }],
          }),
        });
        if (res.ok) { created++; }
        else {
          const e = await res.text();
          errors.push(`CREATE ${phone}: ${e.slice(0, 80)}`);
          if (e.includes('RateLimitExceeded') || e.includes('TooManyRequest')) break; // stop on rate limit
        }
        await new Promise(r => setTimeout(r, 150)); // 150ms gap to respect rate limits
      } else {
        // Update if name has changed
        const existingName = `${existing.first_name || ''} ${existing.last_name || ''}`.trim();
        if (existingName !== name) {
          const res = await fetch(`https://api.aircall.io/v1/contacts/${existing.id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ first_name: firstName, last_name: lastName }),
          });
          if (res.ok) { updated++; }
          else {
            const e = await res.text();
            errors.push(`UPDATE ${phone}: ${e.slice(0, 80)}`);
            if (e.includes('RateLimitExceeded') || e.includes('TooManyRequest')) break;
          }
          await new Promise(r => setTimeout(r, 150));
        } else {
          skipped++;
        }
      }
    }

    return Response.json({
      success: true,
      total_crm: Object.keys(crmContacts).length,
      created,
      updated,
      skipped,
      errors: errors.slice(0, 10),
      message: `Pushed ${created} new + ${updated} updated contacts to Aircall`,
    });
  } catch (error) {
    console.error('syncCRMContactsToAircall error:', error);
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