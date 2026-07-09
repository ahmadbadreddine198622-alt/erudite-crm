import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

// syncOwnerPortfolio — reads EVERY .xlsx in the shared Drive folder and
// replaces the OwnerPortfolioUnit entity rows with a fresh parse. Triggered by
// a scheduled automation (every 30 min) and a Google Drive webhook (on file
// upload / update), so the CRM always reflects the latest spreadsheets without
// anyone clicking "Refresh".
//
// Runs under the service role (no user auth) because it is a maintenance sync
// invoked by automations; direct invocation only re-parses reference data.

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

function areaFor(projectName) {
  const k = clean(projectName).toLowerCase();
  if (PROJECT_AREA[k]) return PROJECT_AREA[k];
  if (k.includes('peninsula')) return 'Business Bay, Dubai';
  return 'Dubai';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const q = `'${FOLDER_ID}' in parents and trashed=false`;
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size)&pageSize=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const listData = await listRes.json();
    if (!listData.files || listData.files.length === 0) {
      return Response.json({ ok: true, synced: 0, note: 'No files in folder' });
    }

    const records = [];
    let filesParsed = 0;

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
          const propertyName = clean(r[COLS.property_name]);
          records.push({
            owner_code: ownerCode,
            owner_name: ownerName,
            owner_email: clean(r[COLS.owner_email]),
            owner_phone: clean(r[COLS.owner_tel1]) || clean(r[COLS.owner_tel2]),
            property_code: clean(r[COLS.property_code]),
            property_name: propertyName,
            unit_code: clean(r[COLS.unit_code]),
            spa_status: clean(r[COLS.spa_status]),
            owner_status: clean(r[COLS.owner_status]),
            sales_agent: clean(r[COLS.sales_agent]),
            area: areaFor(propertyName),
            source_file: f.name,
          });
        }
      }
      filesParsed++;
    }

    // Full replace of the reference table. ~2k rows, chunked at 500 per bulkCreate.
    await base44.asServiceRole.entities.OwnerPortfolioUnit.deleteMany({});
    for (let i = 0; i < records.length; i += 500) {
      await base44.asServiceRole.entities.OwnerPortfolioUnit.bulkCreate(records.slice(i, i + 500));
    }

    return Response.json({ ok: true, synced: records.length, files_parsed: filesParsed });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});