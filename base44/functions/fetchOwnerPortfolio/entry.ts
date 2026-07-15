import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// fetchOwnerPortfolio — reads the synced OwnerPortfolioUnit entity and returns
// the full unit portfolio for the landlord matching the supplied name / email / phone.
//
// Uses targeted filter queries ($regex on email/phone/name, $in on owner_code)
// instead of loading all 45K+ records into memory. This is both faster and
// avoids the 5,000-record pagination limit (the SDK can't paginate built-in
// fields like created_date/id with $lt).
//
// Matching strategy:
//   Pass 1 — query entity rows by email ($regex, case-insensitive), phone (last 9
//            digits as $regex), and name ($regex, case-insensitive exact match).
//            Collect matched owner_code(s).
//   Pass 2 — fetch all rows with those owner_codes using $in.

const clean = (v) => (v == null ? '' : String(v).trim());
const phoneKey = (s) => clean(s).replace(/[^0-9]/g, '');
const last9 = (d) => (d ? d.slice(-9) : '');
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function upsertSyncState(base44, key, value) {
  const existing = await base44.asServiceRole.entities.SyncState.filter({ key });
  if (existing && existing.length > 0) {
    await base44.asServiceRole.entities.SyncState.update(existing[0].id, { value });
  } else {
    await base44.asServiceRole.entities.SyncState.create({ key, value });
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }

    // --- list_owners mode (limited to first 5000 — approximate) ---
    if (body.list_owners) {
      const page = await base44.asServiceRole.entities.OwnerPortfolioUnit.list('-created_date', 5000);
      const rows = Array.isArray(page) ? page : (page.items || []);
      const map = new Map();
      for (const u of rows) {
        const key = u.owner_code || u.owner_name || '?';
        if (!map.has(key)) {
          map.set(key, {
            name: u.owner_name, email: u.owner_email, phone: u.owner_phone,
            unit_count: 0, unit_codes: [], projects: new Set(),
          });
        }
        const o = map.get(key);
        o.unit_count++;
        if (u.unit_code) o.unit_codes.push(u.unit_code);
        if (u.property_name) o.projects.add(u.property_name);
      }
      const list = Array.from(map.values())
        .map((o) => ({ ...o, projects: Array.from(o.projects) }))
        .filter((o) => o.unit_count > 1)
        .sort((a, b) => b.unit_count - a.unit_count);
      return Response.json({ ok: true, multi_unit_owners: list, count: list.length, totalUnits: rows.length });
    }

    // --- single-landlord matching mode ---
    const matchName = clean(body.owner_name || '');
    const matchEmail = clean(body.owner_email || '').toLowerCase();
    const phoneLast9 = last9(phoneKey(body.owner_phone || ''));

    // Accept arrays of emails/phones so we match against every contact detail on the
    // landlord record (additional_emails, additional_phones), not just the primary ones.
    const matchEmails = Array.isArray(body.owner_emails)
      ? body.owner_emails.map(e => clean(e).toLowerCase()).filter(Boolean)
      : (matchEmail ? [matchEmail] : []);
    const matchPhonesLast9 = Array.isArray(body.owner_phones)
      ? body.owner_phones.map(p => last9(phoneKey(p))).filter(Boolean)
      : (phoneLast9 ? [phoneLast9] : []);

    if (!matchName && !matchEmails.length && !matchPhonesLast9.length) {
      return Response.json({ error: 'No owner_name, owner_email or owner_phone supplied' });
    }

    // Helper: collect owner_codes from a filter query
    const matchedCodes = new Set();
    let matchedName = null;
    let matchedEmail = '';
    let matchedPhone = '';

    async function collectFromFilter(query) {
      const page = await base44.asServiceRole.entities.OwnerPortfolioUnit.filter(
        query, '-created_date', 5000
      );
      const results = Array.isArray(page) ? page : (page.items || []);
      for (const u of results) {
        if (u.owner_code) matchedCodes.add(u.owner_code);
        if (!matchedName) matchedName = u.owner_name;
        if (!matchedEmail && u.owner_email) matchedEmail = u.owner_email;
        if (!matchedPhone) matchedPhone = u.owner_phone;
      }
      return results.length;
    }

    // 1. Query by every known email (case-insensitive exact match)
    for (const em of [...new Set(matchEmails)]) {
      await collectFromFilter({
        owner_email: { $regex: '^' + escapeRegex(em) + '$', $options: 'i' },
      });
    }

    // 2. Query by every known phone (last 9 digits — matches any phone ending in those digits)
    for (const p9 of [...new Set(matchPhonesLast9)]) {
      await collectFromFilter({
        owner_phone: { $regex: p9 },
      });
    }

    // 3. Query by name — token-based partial match. Portfolio names frequently include
    //    middle names or different ordering than the CRM record (e.g. CRM "Napoleon Enzo"
    //    vs portfolio "NAPOLEON VELLUCCI ENZO"), so an exact match misses real owners.
    //    Query by the most distinctive (longest) token, then require ALL CRM tokens to
    //    appear in the portfolio name to avoid false positives.
    if (matchName) {
      const tokens = matchName.toLowerCase().split(/\s+/).map(t => t.trim()).filter(t => t.length > 1);
      if (tokens.length) {
        const queryToken = tokens.slice().sort((a, b) => b.length - a.length)[0];
        const page = await base44.asServiceRole.entities.OwnerPortfolioUnit.filter(
          { owner_name: { $regex: escapeRegex(queryToken), $options: 'i' } },
          '-created_date', 5000
        );
        const results = Array.isArray(page) ? page : (page.items || []);
        for (const u of results) {
          const uname = clean(u.owner_name).toLowerCase();
          if (!uname) continue;
          if (tokens.every(t => uname.includes(t))) {
            if (u.owner_code) matchedCodes.add(u.owner_code);
            if (!matchedName) matchedName = u.owner_name;
            if (!matchedEmail && u.owner_email) matchedEmail = u.owner_email;
            if (!matchedPhone) matchedPhone = u.owner_phone;
          }
        }
      }
    }

    // Read total counts from SyncState (maintained by syncOwnerPortfolio)
    let totalUnits = 0;
    let totalOwners = 0;
    try {
      const unitsState = await base44.asServiceRole.entities.SyncState.filter({ key: 'owner_portfolio_total_units' });
      if (unitsState && unitsState.length > 0) totalUnits = parseInt(unitsState[0].value) || 0;
      const ownersState = await base44.asServiceRole.entities.SyncState.filter({ key: 'owner_portfolio_total_owners' });
      if (ownersState && ownersState.length > 0) totalOwners = parseInt(ownersState[0].value) || 0;
    } catch (_) {}

    if (matchedCodes.size === 0) {
      return Response.json({ ok: true, matched: false, totalUnits, totalOwners });
    }

    // Fetch ALL units for the matched owner codes
    const codesArray = Array.from(matchedCodes);
    const page = await base44.asServiceRole.entities.OwnerPortfolioUnit.filter(
      { owner_code: { $in: codesArray } },
      '-created_date', 5000
    );
    const allUnits = Array.isArray(page) ? page : (page.items || []);

    const units = [];
    const projects = new Set();
    const areas = new Set();
    const allPhones = new Set();
    const allEmails = new Set();
    for (const u of allUnits) {
      units.push({
        property_code: u.property_code,
        property_name: u.property_name,
        unit_code: u.unit_code,
        spa_status: u.spa_status,
        owner_status: u.owner_status,
        sales_agent: u.sales_agent,
        area: u.area,
        source_file: u.source_file,
        owner_phone: u.owner_phone,
        owner_email: u.owner_email,
      });
      if (u.property_name) { projects.add(u.property_name); areas.add(u.area); }
      if (u.owner_phone) { const p = String(u.owner_phone).trim(); if (p) allPhones.add(p); }
      if (u.owner_email) { const e = String(u.owner_email).trim().toLowerCase(); if (e) allEmails.add(e); }
    }

    return Response.json({
      ok: true,
      matched: true,
      owner_name: matchedName,
      owner_email: matchedEmail,
      owner_phone: matchedPhone,
      total_units: units.length,
      total_apartments: units.length,
      total_projects: projects.size,
      total_areas: areas.size,
      projects: Array.from(projects),
      areas: Array.from(areas),
      all_phones: Array.from(allPhones),
      all_emails: Array.from(allEmails),
      units,
      totalUnits,
      totalOwners,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});