import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

// fetchOwnerPortfolio — reads the owner-portfolio Excel files from the shared
// Google Drive folder and returns the full unit portfolio for the landlord
// matching the supplied name / email / phone.
//
// Spreadsheet columns (0-indexed):
//   0 Property Code | 1 Property Name | 2 Owner Code | 3 Owner Name
//   4 Unit Code | 5 Purchase Date | 6 SPA Status | 7 Owner Status
//   8 Sales Agent | 9 No. Car Parking | 10 Owner Email | 11 Tel(1) | 12 Tel(2)
//
// Matching strategy (robust against blank contact fields & name collisions):
//   Pass 1 — scan every row; a row "identifies" the landlord if its owner
//            email, phone (last 9 digits), or normalized name matches.
//            Record the first matched row's Owner Code (the stable key that
//            is identical on every row for the same owner).
//   Pass 2 — collect every row whose Owner Code === that matched code.
//   This guarantees we capture ALL of that owner's units across both files
//   and all projects, even rows where the email/phone cell is blank, and
//   never merge units belonging to a different owner who merely shares a name.
//
// The sheet's stored !ref spans the full 1M rows and OOMs sheet_to_json, so
// the parse range is capped to 5000 rows.

const FOLDER_ID = '1nKrU3mL_Mub78CLjDYXjcheuJXySLsTZ';
const COLS = {
  property_code: 0, property_name: 1, owner_code: 2, owner_name: 3,
  unit_code: 4, spa_status: 6, owner_status: 7, sales_agent: 8,
  owner_email: 10, owner_tel1: 11, owner_tel2: 12,
};

const PROJECT_AREA = {
  'peninsula one': 'Business Bay, Dubai', 'peninsula two': 'Business Bay, Dubai',
  'peninsula three': 'Business Bay, Dubai', 'peninsula five': 'Business Bay, Dubai',
  'p1': 'Business Bay, Dubai', 'p2': 'Business Bay, Dubai',
  'p3': 'Business Bay, Dubai', 'p5': 'Business Bay, Dubai',
};

const clean = (v) => (v == null ? '' : String(v).trim());
const nameKey = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const emailKey = (s) => clean(s).toLowerCase();
const phoneKey = (s) => clean(s).replace(/[^0-9]/g, '');
const last9 = (d) => (d ? d.slice(-9) : '');

function areaFor(projectName) {
  const k = clean(projectName).toLowerCase();
  if (PROJECT_AREA[k]) return PROJECT_AREA[k];
  if (k.includes('peninsula')) return 'Business Bay, Dubai';
  return 'Dubai';
}

// Does this spreadsheet row belong to the same owner identified in pass 1?
// We match on the SHEET owner's own identifiers (email > phone > name), so all
// of that owner's units are captured — even rows where one contact field is
// blank — while a different owner who merely shares a name (but has a
// different email/phone) is excluded once a strong identifier is known.
function rowIsOwner(r, ownerEmail, ownerPhone, ownerNameKey) {
  const rEmail = emailKey(clean(r[COLS.owner_email]));
  const rPhone = last9(phoneKey(clean(r[COLS.owner_tel1]) || clean(r[COLS.owner_tel2])));
  const rNameKey = nameKey(clean(r[COLS.owner_name]));
  if (ownerEmail && rEmail && rEmail === ownerEmail) return true;
  if (ownerPhone && rPhone && rPhone === ownerPhone) return true;
  if (ownerNameKey && rNameKey && rNameKey === ownerNameKey) return true;
  return false;
}

// Identify the landlord against the supplied name/email/phone.
function rowIdentifiesLandlord(r, matchName, matchEmail, matchPhone) {
  return rowIsOwner(r, matchEmail, matchPhone, matchName);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const listOwners = !!body.list_owners;
    const matchName = nameKey(clean(body.owner_name || ''));
    const matchEmail = emailKey(body.owner_email || '');
    const matchPhone = last9(phoneKey(body.owner_phone || ''));
    if (!listOwners && !matchName && !matchEmail && !matchPhone) {
      return Response.json({ error: 'No owner_name, owner_email or owner_phone supplied' });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const q = `'${FOLDER_ID}' in parents and trashed=false`;
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size)&pageSize=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const listData = await listRes.json();
    if (!listData.files || listData.files.length === 0) {
      return Response.json({ error: 'No files found in folder' });
    }

    // Collect normalized owner rows from every file/sheet into one flat list.
    const allRows = [];
    let totalUnits = 0;

    for (const f of listData.files) {
      if (!/\.xlsx?$/i.test(f.name)) continue;
      const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const buf = new Uint8Array(await dlRes.arrayBuffer());
      const wb = XLSX.read(buf, { type: 'array', cellHTML: false, cellFormula: false, cellStyles: false, dense: true });

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', range: 'A1:U5000', blankrows: false });
        if (rows.length === 0) continue;

        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          if (clean(rows[i][0]) === 'Code' && clean(rows[i][1]) === 'Name') { headerRowIdx = i; break; }
        }
        if (headerRowIdx < 0) continue;
        const dataStart = headerRowIdx + 1;

        for (let i = dataStart; i < rows.length; i++) {
          const r = rows[i] || [];
          const ownerName = clean(r[COLS.owner_name]);
          if (!ownerName || /^(total|grand total|subtotal)/i.test(ownerName)) continue;
          const ownerCode = clean(r[COLS.owner_code]);
          if (!ownerCode) continue;
          allRows.push({ r, ownerCode, file: f.name });
          totalUnits++;
        }
      }
    }

    // List mode: aggregate every owner and return those with multiple units.
    if (listOwners) {
      const byEmail = new Map();
      const byPhone = new Map();
      const byNameKey = new Map();
      const owners = new Map(); // key -> { name, email, phone, units: [], projects: Set }

      const getOrCreate = (key, r) => {
        if (!owners.has(key)) {
          owners.set(key, {
            name: clean(r[COLS.owner_name]),
            email: emailKey(clean(r[COLS.owner_email])),
            phone: clean(r[COLS.owner_tel1]) || clean(r[COLS.owner_tel2]),
            unit_count: 0,
            unit_codes: [],
            projects: new Set(),
          });
        }
        return owners.get(key);
      };

      for (const { r } of allRows) {
        const e = emailKey(clean(r[COLS.owner_email]));
        const p = last9(phoneKey(clean(r[COLS.owner_tel1]) || clean(r[COLS.owner_tel2])));
        const nk = nameKey(clean(r[COLS.owner_name]));
        let key = null;
        if (e && byEmail.has(e)) key = byEmail.get(e);
        else if (p && byPhone.has(p)) key = byPhone.get(p);
        else if (nk && byNameKey.has(nk)) key = byNameKey.get(nk);
        if (!key) {
          key = 'o' + (owners.size + 1);
          if (e) byEmail.set(e, key);
          if (p) byPhone.set(p, key);
          if (nk) byNameKey.set(nk, key);
        } else {
          if (e && !byEmail.has(e)) byEmail.set(e, key);
          if (p && !byPhone.has(p)) byPhone.set(p, key);
        }
        const o = getOrCreate(key, r);
        o.unit_count++;
        const uc = clean(r[COLS.unit_code]);
        if (uc) o.unit_codes.push(uc);
        const pn = clean(r[COLS.property_name]);
        if (pn) o.projects.add(pn);
      }

      const list = Array.from(owners.values())
        .map((o) => ({ ...o, projects: Array.from(o.projects) }))
        .filter((o) => o.unit_count > 1)
        .sort((a, b) => b.unit_count - a.unit_count);

      return Response.json({ ok: true, multi_unit_owners: list, count: list.length, totalUnits });
    }

    // Pass 1: identify the landlord against the supplied name/email/phone.
    let matchedOwnerName = null;
    let matchedEmail = '';
    let matchedPhone = '';
    let matchedNameKey = '';
    for (const { r } of allRows) {
      if (rowIdentifiesLandlord(r, matchName, matchEmail, matchPhone)) {
        matchedOwnerName = clean(r[COLS.owner_name]);
        matchedEmail = emailKey(clean(r[COLS.owner_email]));
        matchedPhone = last9(phoneKey(clean(r[COLS.owner_tel1]) || clean(r[COLS.owner_tel2])));
        matchedNameKey = nameKey(matchedOwnerName);
        break;
      }
    }

    if (!matchedOwnerName) {
      return Response.json({ ok: true, matched: false, totalUnits });
    }

    // Pass 2: collect every row belonging to that owner (all projects, all files).
    const units = [];
    const projects = new Set();
    const areas = new Set();
    for (const { r, file } of allRows) {
      if (!rowIsOwner(r, matchedEmail, matchedPhone, matchedNameKey)) continue;
      const propertyName = clean(r[COLS.property_name]);
      units.push({
        property_code: clean(r[COLS.property_code]),
        property_name: propertyName,
        unit_code: clean(r[COLS.unit_code]),
        spa_status: clean(r[COLS.spa_status]),
        owner_status: clean(r[COLS.owner_status]),
        sales_agent: clean(r[COLS.sales_agent]),
        area: areaFor(propertyName),
        file,
      });
      if (propertyName) { projects.add(propertyName); areas.add(areaFor(propertyName)); }
    }

    return Response.json({
      ok: true,
      matched: true,
      owner_name: matchedOwnerName,
      owner_email: matchedEmail,
      owner_phone: matchedPhone,
      total_units: units.length,
      total_apartments: units.length,
      total_projects: projects.size,
      total_areas: areas.size,
      projects: Array.from(projects),
      areas: Array.from(areas),
      units,
      totalUnits,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});