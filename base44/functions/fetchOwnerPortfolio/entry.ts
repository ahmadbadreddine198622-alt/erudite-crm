import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// fetchOwnerPortfolio — reads the synced OwnerPortfolioUnit entity (kept fresh
// by syncOwnerPortfolio) and returns the full unit portfolio for the landlord
// matching the supplied name / email / phone. Reading from the entity is
// instant (no Excel parse on every tab open), so the Owner History tab never
// needs a manual refresh.
//
// Matching strategy (two-pass, same as before):
//   Pass 1 — find entity rows that match the landlord by email > phone > name;
//            collect their owner_code(s) (the stable per-owner key).
//   Pass 2 — return every row with one of those owner codes (all projects,
//            all source files).

const clean = (v) => (v == null ? '' : String(v).trim());
const nameKey = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const emailKey = (s) => clean(s).toLowerCase();
const phoneKey = (s) => clean(s).replace(/[^0-9]/g, '');
const last9 = (d) => (d ? d.slice(-9) : '');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const listOwners = !!body.list_owners;

    const all = await base44.asServiceRole.entities.OwnerPortfolioUnit.list('-created_date', 5000);
    const rows = Array.isArray(all) ? all : (all.items || []);

    if (listOwners) {
      const map = new Map();
      for (const u of rows) {
        const key = u.owner_code || u.owner_name || '?';
        if (!map.has(key)) {
          map.set(key, {
            name: u.owner_name,
            email: u.owner_email,
            phone: u.owner_phone,
            unit_count: 0,
            unit_codes: [],
            projects: new Set(),
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

    const matchName = nameKey(clean(body.owner_name || ''));
    const matchEmail = emailKey(body.owner_email || '');
    const matchPhone = last9(phoneKey(body.owner_phone || ''));
    if (!matchName && !matchEmail && !matchPhone) {
      return Response.json({ error: 'No owner_name, owner_email or owner_phone supplied' });
    }

    const matchedCodes = new Set();
    let matchedName = null;
    let matchedEmail = '';
    let matchedPhone = '';
    for (const u of rows) {
      const e = emailKey(clean(u.owner_email));
      const p = last9(phoneKey(clean(u.owner_phone)));
      const nk = nameKey(clean(u.owner_name));
      let hit = false;
      if (matchEmail && e && e === matchEmail) hit = true;
      if (!hit && matchPhone && p && p === matchPhone) hit = true;
      if (!hit && matchName && nk && nk === matchName) hit = true;
      if (hit) {
        if (u.owner_code) matchedCodes.add(u.owner_code);
        if (!matchedName) matchedName = u.owner_name;
        if (!matchedEmail && e) matchedEmail = e;
        if (!matchedPhone && p) matchedPhone = p;
      }
    }

    if (matchedCodes.size === 0) {
      return Response.json({ ok: true, matched: false, totalUnits: rows.length });
    }

    const units = [];
    const projects = new Set();
    const areas = new Set();
    for (const u of rows) {
      if (!matchedCodes.has(u.owner_code)) continue;
      units.push({
        property_code: u.property_code,
        property_name: u.property_name,
        unit_code: u.unit_code,
        spa_status: u.spa_status,
        owner_status: u.owner_status,
        sales_agent: u.sales_agent,
        area: u.area,
        source_file: u.source_file,
      });
      if (u.property_name) { projects.add(u.property_name); areas.add(u.area); }
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
      units,
      totalUnits: rows.length,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});