import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

// fetchOwnerPortfolio — reads the two owner-portfolio Excel files from the
// shared Google Drive folder and returns the full unit portfolio for the
// landlord matching the supplied name / email / phone.
//
// Spreadsheet layout (both files share the same columns; header row position
// differs by one row between the two files, so we detect it dynamically):
//   Columns (0-indexed):
//     0  Property Code
//     1  Property Name   (project / building, e.g. "Peninsula Three")
//     2  Owner Code
//     3  Owner Name
//     4  Unit Code       (unit number, e.g. "P3-2204")
//     5  Purchase Date
//     6  SPA Status
//     7  Owner Status
//     8  Sales Agent
//     9  No. Of Car Parking
//    10  Owner Email
//    11  Owner Tel No.(1)
//    12  Owner Tel No.(2)
//
// The sheet's stored !ref spans the full 1M rows, which OOMs sheet_to_json,
// so we cap the parse range to 5000 rows.
//
// Matching priority: email (exact, case-insensitive) > phone (last 9 digits)
// > normalized owner name.

const FOLDER_ID = '1nKrU3mL_Mub78CLjDYXjcheuJXySLsTZ';
const COLS = {
  property_code: 0,
  property_name: 1,
  owner_code: 2,
  owner_name: 3,
  unit_code: 4,
  spa_status: 6,
  owner_status: 7,
  sales_agent: 8,
  owner_email: 10,
  owner_tel1: 11,
  owner_tel2: 12,
};

// Peninsula projects → area mapping (all in Business Bay, Dubai)
const PROJECT_AREA = {
  'peninsula one': 'Business Bay, Dubai',
  'peninsula two': 'Business Bay, Dubai',
  'peninsula three': 'Business Bay, Dubai',
  'peninsula five': 'Business Bay, Dubai',
  'p1': 'Business Bay, Dubai',
  'p2': 'Business Bay, Dubai',
  'p3': 'Business Bay, Dubai',
  'p5': 'Business Bay, Dubai',
};

function clean(v) {
  if (v == null) return '';
  return String(v).trim();
}
function nameKey(s) {
  return clean(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}
function emailKey(s) {
  return clean(s).toLowerCase();
}
function phoneKey(s) {
  return clean(s).replace(/[^0-9]/g, '');
}
function last9(digits) {
  if (!digits) return '';
  return digits.slice(-9);
}
function areaFor(projectName) {
  const k = clean(projectName).toLowerCase();
  if (PROJECT_AREA[k]) return PROJECT_AREA[k];
  // fallback: any peninsula -> Business Bay
  if (k.includes('peninsula')) return 'Business Bay, Dubai';
  return 'Dubai';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const matchName = clean(body.owner_name || '');
    const matchEmail = emailKey(body.owner_email || '');
    const matchPhone = last9(phoneKey(body.owner_phone || ''));

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const q = `'${FOLDER_ID}' in parents and trashed=false`;
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size)&pageSize=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();
    if (!listData.files || listData.files.length === 0) {
      return Response.json({ error: 'No files found in folder' });
    }

    let matchedOwner = null;
    let totalUnits = 0;
    let totalOwners = 0;
    const ownerKeys = new Set();

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

        // Detect header row: first row where cell[0]==="Code" && cell[1]==="Name"
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          if (clean(rows[i][0]) === 'Code' && clean(rows[i][1]) === 'Name') { headerRowIdx = i; break; }
        }
        if (headerRowIdx < 0) continue; // unknown layout, skip
        const dataStart = headerRowIdx + 1;

        for (let i = dataStart; i < rows.length; i++) {
          const r = rows[i] || [];
          const ownerName = clean(r[COLS.owner_name]);
          if (!ownerName) continue;
          if (/^(total|grand total|subtotal)/i.test(ownerName)) continue;

          const ownerEmail = emailKey(clean(r[COLS.owner_email]));
          const ownerPhoneDigits = phoneKey(clean(r[COLS.owner_tel1]) || clean(r[COLS.owner_tel2]));
          const ownerNameKey = nameKey(ownerName);
          ownerKeys.add(ownerNameKey || ownerName.toLowerCase());

          // Match against the requested landlord
          let isMatch = false;
          if (matchEmail && ownerEmail && ownerEmail === matchEmail) isMatch = true;
          else if (matchPhone && ownerPhoneDigits && last9(ownerPhoneDigits) === matchPhone) isMatch = true;
          else if (matchName && ownerNameKey && ownerNameKey === nameKey(matchName)) isMatch = true;

          if (isMatch) {
            if (!matchedOwner) {
              matchedOwner = { owner_name: ownerName, owner_email: ownerEmail, owner_phone: clean(r[COLS.owner_tel1]) || clean(r[COLS.owner_tel2]), units: [] };
            }
            const propertyName = clean(r[COLS.property_name]);
            matchedOwner.units.push({
              property_code: clean(r[COLS.property_code]),
              property_name: propertyName,
              unit_code: clean(r[COLS.unit_code]),
              spa_status: clean(r[COLS.spa_status]),
              owner_status: clean(r[COLS.owner_status]),
              sales_agent: clean(r[COLS.sales_agent]),
              area: areaFor(propertyName),
              file: f.name,
            });
          }
          totalUnits++;
        }
      }
    }

    totalOwners = ownerKeys.size;

    if (!matchedOwner) {
      return Response.json({ ok: true, matched: false, totalOwners, totalUnits });
    }

    const units = matchedOwner.units;
    const projects = new Set(units.map((u) => u.property_name).filter(Boolean));
    const areas = new Set(units.map((u) => u.area).filter(Boolean));

    return Response.json({
      ok: true,
      matched: true,
      owner_name: matchedOwner.owner_name,
      owner_email: matchedOwner.owner_email,
      owner_phone: matchedOwner.owner_phone,
      total_units: units.length,
      total_apartments: units.length,
      total_projects: projects.size,
      total_areas: areas.size,
      projects: Array.from(projects),
      areas: Array.from(areas),
      units,
      totalOwners,
      totalUnits,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});