import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

// syncOwnerPortfolio — reads EVERY .xlsx in the shared Drive folder and
// replaces the OwnerPortfolioUnit entity rows with a fresh parse.
//
// Handles TWO spreadsheet formats found in the folder:
//   1. Peninsula portfolio format — header row starts with "Code","Name"
//      Columns: Code, Name, Owner Code, Owner Name, Unit Code, [x], SPA Status,
//               Owner Status, Sales Agent, Owner Email, Tel1, Tel2
//   2. DLD transaction registry format — header row starts with "ProcedureValue"
//      Columns: ProcedureValue, Master Project, Project, BuildingNameEn, Size,
//               UnitNumber, DmNo, DmSubNo, PropertyTypeEn, ..., ProcedurePartyTypeNameEn,
//               NameEn, Mobile, ProcedureNameEn, CountryNameEn, IdNumber, ...
//      Only "Buyer" rows are extracted (current owner = latest buyer).
//
// Runs under the service role; invoked by scheduled automation (every 30 min).

const FOLDER_ID = '1nKrU3mL_Mub78CLjDYXjcheuJXySLsTZ';

// Peninsula column indices (0-based, relative to header row)
const PEN_COLS = {
  property_code: 0, property_name: 1, owner_code: 2, owner_name: 3,
  unit_code: 4, spa_status: 6, owner_status: 7, sales_agent: 8,
  owner_email: 10, owner_tel1: 11, owner_tel2: 12,
};

// DLD column indices
const DLD_COLS = {
  master_project: 1, project: 2, building: 3, unit_number: 5,
  party_type: 11, name_en: 13, mobile: 14, procedure_name: 15,
  id_number: 16,
};

const PROJECT_AREA = {
  'peninsula one': 'Business Bay, Dubai', 'peninsula two': 'Business Bay, Dubai',
  'peninsula three': 'Business Bay, Dubai', 'peninsula five': 'Business Bay, Dubai',
  'p1': 'Business Bay, Dubai', 'p2': 'Business Bay, Dubai',
  'p3': 'Business Bay, Dubai', 'p5': 'Business Bay, Dubai',
};

const AREA_MAP = {
  'business bay': 'Business Bay, Dubai',
  'dubai marina': 'Dubai Marina, Dubai',
  'down town': 'Downtown Dubai',
  'downtown': 'Downtown Dubai',
  'palm jumeirah': 'Palm Jumeirah, Dubai',
  'jbr': 'JBR, Dubai',
  'jlt': 'JLT, Dubai',
  'arjan': 'Arjan, Dubai',
  'damac hills': 'Damac Hills, Dubai',
  'damac lagoons': 'Damac Lagoons, Dubai',
  'dubai hills': 'Dubai Hills, Dubai',
  'dubai south': 'Dubai South, Dubai',
  'emaar beachfront': 'Emaar Beachfront, Dubai',
  'emirates living': 'Emirates Living, Dubai',
  'falcon city': 'Falcon City, Dubai',
  'furjan': 'Al Furjan, Dubai',
  'barrari': 'Al Barari, Dubai',
  'bluewaters': 'Bluewaters, Dubai',
  'mudon': 'Mudon, Dubai',
  'creek': 'Dubai Creek Harbour, Dubai',
  'district one': 'District One, Meydan, Dubai',
  'jumeirah park': 'Jumeirah Park, Dubai',
  'jumeirah golf estates': 'Jumeirah Golf Estates, Dubai',
  'mira': 'Mira, Dubai',
  'port de la mer': 'Port De La Mer, Dubai',
  'serena': 'Serena, Dubai',
};

const clean = (v) => (v == null ? '' : String(v).trim());

function areaFor(projectName, masterProject) {
  const k = clean(projectName).toLowerCase();
  const mk = clean(masterProject).toLowerCase();
  if (PROJECT_AREA[k]) return PROJECT_AREA[k];
  for (const [key, val] of Object.entries(AREA_MAP)) {
    if (mk.includes(key) || k.includes(key)) return val;
  }
  if (k.includes('peninsula')) return 'Business Bay, Dubai';
  return clean(masterProject) || 'Dubai';
}

// Deduplicate files by normalizing name (strip " (1)", " 2", etc. copies)
function dedupeFiles(files) {
  const seen = new Map();
  for (const f of files) {
    const baseName = f.name.replace(/\s*\(\d+\)\s*\.xlsx?$/i, '.xlsx').replace(/\s*\d+\.xlsx?$/i, '.xlsx').toLowerCase();
    if (!seen.has(baseName) || (parseInt(f.size) > parseInt(seen.get(baseName).size))) {
      seen.set(baseName, f);
    }
  }
  return Array.from(seen.values());
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

    const xlsxFiles = listData.files.filter(f => /\.xlsx?$/i.test(f.name));
    const uniqueFiles = dedupeFiles(xlsxFiles);

    // Sort by size ascending — small files first to maximize coverage within memory limits
    uniqueFiles.sort((a, b) => parseInt(a.size || 0) - parseInt(b.size || 0));

    // Determine which files to process this run. On each run we process files
    // up to a total byte budget, cycling through the list so eventually every
    // file gets synced across multiple 30-min runs.
    const MAX_BYTES_PER_RUN = 15_000_000; // ~15MB of file downloads per run
    const syncState = await base44.asServiceRole.entities.SyncState.filter({ key: 'owner_portfolio_offset' });
    const offset = (syncState && syncState.length > 0) ? (syncState[0].value || 0) : 0;

    const toProcess = [];
    let totalBytes = 0;
    for (let i = 0; i < uniqueFiles.length; i++) {
      const idx = (offset + i) % uniqueFiles.length;
      const sz = parseInt(uniqueFiles[idx].size || 0);
      if (totalBytes + sz > MAX_BYTES_PER_RUN && toProcess.length > 0) break;
      toProcess.push(uniqueFiles[idx]);
      totalBytes += sz;
    }
    const nextOffset = (offset + toProcess.length) % uniqueFiles.length;
    await base44.asServiceRole.entities.SyncState.updateMany(
      { key: 'owner_portfolio_offset' },
      { $set: { value: nextOffset } }
    ).catch(async () => {
      await base44.asServiceRole.entities.SyncState.create({ key: 'owner_portfolio_offset', value: nextOffset });
    });

    const records = [];
    let filesParsed = 0;
    let filesSkipped = 0;
    const fileStats = [];

    for (const f of toProcess) {
      try {
        const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const buf = new Uint8Array(await dlRes.arrayBuffer());
        const wb = XLSX.read(buf, { type: 'array', cellHTML: false, cellFormula: false, cellStyles: false, dense: true });

        let fileRecords = 0;
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', range: 'A1:U10000', blankrows: false });
          if (rows.length === 0) continue;

          // Detect format from header
          let format = null;
          let headerRowIdx = -1;
          for (let i = 0; i < Math.min(rows.length, 20); i++) {
            const h0 = clean(rows[i][0]).toLowerCase();
            const h1 = clean(rows[i][1]);
            if (h0 === 'code' && h1 === 'Name') { format = 'peninsula'; headerRowIdx = i; break; }
            if (h0 === 'procedurevalue') { format = 'dld'; headerRowIdx = i; break; }
          }
          if (!format) continue;

          const dataStart = headerRowIdx + 1;

          if (format === 'peninsula') {
            for (let i = dataStart; i < rows.length; i++) {
              const r = rows[i] || [];
              const ownerName = clean(r[PEN_COLS.owner_name]);
              if (!ownerName || /^(total|grand total|subtotal)/i.test(ownerName)) continue;
              const ownerCode = clean(r[PEN_COLS.owner_code]);
              if (!ownerCode) continue;
              const propertyName = clean(r[PEN_COLS.property_name]);
              records.push({
                owner_code: ownerCode,
                owner_name: ownerName,
                owner_email: clean(r[PEN_COLS.owner_email]),
                owner_phone: clean(r[PEN_COLS.owner_tel1]) || clean(r[PEN_COLS.owner_tel2]),
                property_code: clean(r[PEN_COLS.property_code]),
                property_name: propertyName,
                unit_code: clean(r[PEN_COLS.unit_code]),
                spa_status: clean(r[PEN_COLS.spa_status]),
                owner_status: clean(r[PEN_COLS.owner_status]),
                sales_agent: clean(r[PEN_COLS.sales_agent]),
                area: areaFor(propertyName, ''),
                source_file: f.name,
              });
              fileRecords++;
            }
          } else if (format === 'dld') {
            // Build column map from header names (positions shift between files)
            const header = rows[headerRowIdx] || [];
            const colMap = {};
            for (let c = 0; c < header.length; c++) {
              const h = clean(header[c]).toLowerCase();
              if (h === 'master project') colMap.master_project = c;
              else if (h === 'project') colMap.project = c;
              else if (h === 'buildingnameen') colMap.building = c;
              else if (h === 'unitnumber') colMap.unit_number = c;
              else if (h === 'procedurepartytypenameen') colMap.party_type = c;
              else if (h === 'nameen') colMap.name_en = c;
              else if (h === 'mobile') colMap.mobile = c;
              else if (h === 'procedurenameen') colMap.procedure_name = c;
              else if (h === 'idnumber') colMap.id_number = c;
              else if (h === 'plot pre reg no') colMap.plot_no = c;
            }
            for (let i = dataStart; i < rows.length; i++) {
              const r = rows[i] || [];
              const partyType = clean(r[colMap.party_type]).toLowerCase();
              // Only extract Buyer rows — they represent the current owner
              if (partyType !== 'buyer') continue;
              const ownerName = clean(r[colMap.name_en]);
              if (!ownerName || /^(total|grand total|subtotal)/i.test(ownerName)) continue;
              const propertyName = clean(r[colMap.project]) || clean(r[colMap.building]);
              const masterProject = clean(r[colMap.master_project]);
              const unitNumber = clean(r[colMap.unit_number]);
              const idNum = clean(r[colMap.id_number]);
              const plotNo = clean(r[colMap.plot_no]);
              records.push({
                owner_code: idNum || plotNo || unitNumber + '-' + ownerName.substring(0, 10),
                owner_name: ownerName,
                owner_email: '',
                owner_phone: clean(r[colMap.mobile]),
                property_code: plotNo,
                property_name: propertyName,
                unit_code: unitNumber,
                spa_status: clean(r[colMap.procedure_name]),
                owner_status: 'Owner (DLD)',
                sales_agent: '',
                area: areaFor(propertyName, masterProject),
                source_file: f.name,
              });
              fileRecords++;
            }
          }
        }
        filesParsed++;
        fileStats.push({ file: f.name, records: fileRecords });
      } catch (fileErr) {
        filesSkipped++;
        fileStats.push({ file: f.name, error: fileErr.message });
      }
    }

    // Upsert (not full replace) — each run only processes a subset of files.
    // Delete only rows from files processed this run, then insert fresh ones.
    const processedFileNames = toProcess.map(f => f.name);
    for (const fn of processedFileNames) {
      await base44.asServiceRole.entities.OwnerPortfolioUnit.deleteMany({ source_file: fn });
    }
    for (let i = 0; i < records.length; i += 500) {
      await base44.asServiceRole.entities.OwnerPortfolioUnit.bulkCreate(records.slice(i, i + 500));
    }

    return Response.json({
      ok: true,
      synced: records.length,
      files_parsed: filesParsed,
      files_skipped: filesSkipped,
      total_files_in_folder: xlsxFiles.length,
      unique_files: uniqueFiles.length,
      processed_this_run: toProcess.length,
      next_offset: nextOffset,
      file_stats: fileStats,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});