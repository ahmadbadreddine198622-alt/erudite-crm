import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { unzipSync, strFromU8 } from 'npm:fflate@0.8.2';

// syncOwnerPortfolio — reads .xlsx files from the shared Drive folder and
// replaces the OwnerPortfolioUnit entity rows with a fresh parse.
//
// Uses a lightweight custom XLSX parser (fflate for unzip + manual XML
// parsing) instead of the heavy xlsx library. This avoids memory/CPU limits.
//
// Handles empty cells correctly by reading the cell reference attribute
// (r="A1", r="N1") to determine the true column position — empty cells are
// omitted from XLSX XML, so without this, columns shift left and data is
// garbled (e.g. procedure name ends up in the phone column).
//
// Two formats:
//   1. Peninsula portfolio — header starts with "Code","Name"
//   2. DLD transaction registry — header starts with "ProcedureValue"
//      Only "Buyer" rows extracted (current owner = latest buyer).

const FOLDER_ID = '1nKrU3mL_Mub78CLjDYXjcheuJXySLsTZ';

const PEN_COLS = {
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

const AREA_MAP = {
  'business bay': 'Business Bay, Dubai', 'dubai marina': 'Dubai Marina, Dubai',
  'down town': 'Downtown Dubai', 'downtown': 'Downtown Dubai',
  'palm jumeirah': 'Palm Jumeirah, Dubai', 'jbr': 'JBR, Dubai',
  'jlt': 'JLT, Dubai', 'arjan': 'Arjan, Dubai',
  'damac hills': 'Damac Hills, Dubai', 'damac lagoons': 'Damac Lagoons, Dubai',
  'dubai hills': 'Dubai Hills, Dubai', 'dubai south': 'Dubai South, Dubai',
  'emaar beachfront': 'Emaar Beachfront, Dubai', 'emirates living': 'Emirates Living, Dubai',
  'falcon city': 'Falcon City, Dubai', 'furjan': 'Al Furjan, Dubai',
  'barrari': 'Al Barari, Dubai', 'bluewaters': 'Bluewaters, Dubai',
  'mudon': 'Mudon, Dubai', 'creek': 'Dubai Creek Harbour, Dubai',
  'district one': 'District One, Meydan, Dubai',
  'jumeirah park': 'Jumeirah Park, Dubai',
  'jumeirah golf estates': 'Jumeirah Golf Estates, Dubai',
  'mira': 'Mira, Dubai', 'port de la mer': 'Port De La Mer, Dubai',
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

// --- Cell reference column parser ---
// "A1" → 0, "B1" → 1, "AA1" → 26, etc.
function colFromRef(ref) {
  if (!ref) return -1;
  let col = 0;
  for (let i = 0; i < ref.length; i++) {
    const ch = ref.charCodeAt(i);
    if (ch >= 65 && ch <= 90) {
      col = col * 26 + (ch - 64);
    } else {
      break; // hit a digit (row number)
    }
  }
  return col - 1; // 0-based
}

function decodeXml(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function parseSharedStrings(text) {
  const strings = [];
  let pos = 0;
  while (pos < text.length) {
    const siStart = text.indexOf('<si', pos);
    if (siStart === -1) break;
    const siEnd = text.indexOf('</si>', siStart);
    if (siEnd === -1) break;
    const siContent = text.slice(siStart, siEnd + 5);
    let str = '';
    let tPos = 0;
    while (true) {
      const tStart = siContent.indexOf('<t', tPos);
      if (tStart === -1) break;
      const tGt = siContent.indexOf('>', tStart);
      if (tGt === -1) break;
      const tEnd = siContent.indexOf('</t>', tGt);
      if (tEnd === -1) break;
      str += decodeXml(siContent.slice(tGt + 1, tEnd));
      tPos = tEnd + 4;
    }
    strings.push(str);
    pos = siEnd + 5;
  }
  return strings;
}

// Parse sheet XML into rows, using cell references (r attribute) to place
// values at the correct column index. This handles empty/omitted cells.
function parseSheet(text, sharedStrings) {
  const sdStart = text.indexOf('<sheetData');
  if (sdStart === -1) return [];
  const sdEnd = text.indexOf('</sheetData>', sdStart);
  const sd = sdEnd === -1 ? text.slice(sdStart) : text.slice(sdStart, sdEnd);

  const rows = [];
  let pos = 0;
  while (pos < sd.length) {
    const rowStart = sd.indexOf('<row', pos);
    if (rowStart === -1) break;
    const rowEnd = sd.indexOf('</row>', rowStart);
    if (rowEnd === -1) break;
    const rowXml = sd.slice(rowStart, rowEnd + 6);

    const cells = [];
    let cPos = 0;
    while (cPos < rowXml.length) {
      const cStart = rowXml.indexOf('<c', cPos);
      if (cStart === -1) break;

      const cClose = rowXml.indexOf('</c>', cStart);
      const cSelfClose = rowXml.indexOf('/>', cStart);

      let cellXml, nextPos;
      if (cSelfClose !== -1 && (cClose === -1 || cSelfClose < cClose)) {
        cellXml = rowXml.slice(cStart, cSelfClose + 2);
        nextPos = cSelfClose + 2;
      } else if (cClose !== -1) {
        cellXml = rowXml.slice(cStart, cClose + 4);
        nextPos = cClose + 4;
      } else break;

      // Extract cell reference (r="A1", r="B1", etc.)
      let colIdx = cells.length; // fallback: sequential
      const rIdx = cellXml.indexOf('r="');
      if (rIdx !== -1) {
        const rEndQ = cellXml.indexOf('"', rIdx + 3);
        if (rEndQ !== -1) {
          colIdx = colFromRef(cellXml.slice(rIdx + 3, rEndQ));
        }
      }

      // Extract type
      let type = 'n';
      const tIdx = cellXml.indexOf('t="');
      if (tIdx !== -1) {
        const tEndQ = cellXml.indexOf('"', tIdx + 3);
        if (tEndQ !== -1) type = cellXml.slice(tIdx + 3, tEndQ);
      }

      // Extract value
      let value = '';
      if (type === 's') {
        const vStart = cellXml.indexOf('<v>');
        if (vStart !== -1) {
          const vEnd = cellXml.indexOf('</v>', vStart);
          if (vEnd !== -1) {
            const idx = parseInt(cellXml.slice(vStart + 3, vEnd));
            value = sharedStrings[idx] || '';
          }
        }
      } else if (type === 'inlineStr') {
        const tStart = cellXml.indexOf('<t');
        if (tStart !== -1) {
          const tGt = cellXml.indexOf('>', tStart);
          const tEnd = cellXml.indexOf('</t>', tGt);
          if (tGt !== -1 && tEnd !== -1) value = decodeXml(cellXml.slice(tGt + 1, tEnd));
        }
      } else {
        const vStart = cellXml.indexOf('<v>');
        if (vStart !== -1) {
          const vEnd = cellXml.indexOf('</v>', vStart);
          if (vEnd !== -1) value = cellXml.slice(vStart + 3, vEnd);
        }
      }

      // Place at correct column index, filling gaps with empty strings
      while (cells.length < colIdx) cells.push('');
      cells.push(value);

      cPos = nextPos;
    }
    if (cells.length > 0) rows.push(cells);
    pos = rowEnd + 6;
  }
  return rows;
}

function readXLSX(buf) {
  const files = unzipSync(new Uint8Array(buf), {
    filter: (file) =>
      file.name === 'xl/sharedStrings.xml' ||
      file.name === 'xl/worksheets/sheet1.xml',
  });

  const sharedStrings = [];
  if (files['xl/sharedStrings.xml']) {
    sharedStrings.push(...parseSharedStrings(strFromU8(files['xl/sharedStrings.xml'])));
  }

  const sheetFile = files['xl/worksheets/sheet1.xml'];
  if (!sheetFile) return [];
  return parseSheet(strFromU8(sheetFile), sharedStrings);
}

function extractRecords(rows, fileName) {
  if (!rows || rows.length === 0) return [];

  let format = null;
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const h0 = clean(rows[i][0]).toLowerCase();
    const h1 = clean(rows[i][1]);
    if (h0 === 'code' && h1 === 'Name') { format = 'peninsula'; headerRowIdx = i; break; }
    if (h0 === 'procedurevalue') { format = 'dld'; headerRowIdx = i; break; }
  }
  if (!format) return [];

  const dataStart = headerRowIdx + 1;
  const records = [];

  if (format === 'peninsula') {
    for (let i = dataStart; i < rows.length; i++) {
      const r = rows[i] || [];
      const ownerName = clean(r[PEN_COLS.owner_name]);
      if (!ownerName || /^(total|grand total|subtotal)/i.test(ownerName)) continue;
      const ownerCode = clean(r[PEN_COLS.owner_code]);
      if (!ownerCode) continue;
      const propertyName = clean(r[PEN_COLS.property_name]);
      records.push({
        owner_code: ownerCode, owner_name: ownerName,
        owner_email: clean(r[PEN_COLS.owner_email]),
        owner_phone: clean(r[PEN_COLS.owner_tel1]) || clean(r[PEN_COLS.owner_tel2]),
        property_code: clean(r[PEN_COLS.property_code]),
        property_name: propertyName,
        unit_code: clean(r[PEN_COLS.unit_code]),
        spa_status: clean(r[PEN_COLS.spa_status]),
        owner_status: clean(r[PEN_COLS.owner_status]),
        sales_agent: clean(r[PEN_COLS.sales_agent]),
        area: areaFor(propertyName, ''),
        source_file: fileName,
      });
    }
  } else if (format === 'dld') {
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
      else if (h === 'landnumber') colMap.land_no = c;
    }
    for (let i = dataStart; i < rows.length; i++) {
      const r = rows[i] || [];
      const partyType = clean(r[colMap.party_type]).toLowerCase();
      if (partyType !== 'buyer') continue;
      const ownerName = clean(r[colMap.name_en]);
      if (!ownerName || /^(total|grand total|subtotal)/i.test(ownerName)) continue;
      const propertyName = clean(r[colMap.project]) || clean(r[colMap.building]);
      const masterProject = clean(r[colMap.master_project]);
      const unitNumber = clean(r[colMap.unit_number]);
      const idNum = clean(r[colMap.id_number]);
      const landNo = clean(r[colMap.land_no]);
      records.push({
        owner_code: idNum || landNo || unitNumber + '-' + ownerName.substring(0, 10),
        owner_name: ownerName, owner_email: '',
        owner_phone: clean(r[colMap.mobile]),
        property_code: landNo,
        property_name: propertyName,
        unit_code: unitNumber,
        spa_status: clean(r[colMap.procedure_name]),
        owner_status: 'Owner (DLD)',
        sales_agent: '',
        area: areaFor(propertyName, masterProject),
        source_file: fileName,
      });
    }
  }
  return records;
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
    uniqueFiles.sort((a, b) => parseInt(a.size || 0) - parseInt(b.size || 0));

    // Process a subset per run using a byte budget, cycling through files
    const MAX_BYTES_PER_RUN = 15_000_000;
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
        const buf = await dlRes.arrayBuffer();
        const rows = readXLSX(buf);
        const fileRecords = extractRecords(rows, f.name);

        // Delete old rows for this file, then insert fresh ones
        await base44.asServiceRole.entities.OwnerPortfolioUnit.deleteMany({ source_file: f.name });
        for (let i = 0; i < fileRecords.length; i += 500) {
          await base44.asServiceRole.entities.OwnerPortfolioUnit.bulkCreate(fileRecords.slice(i, i + 500));
        }
        records.push(...fileRecords);
        filesParsed++;
        fileStats.push({ file: f.name, records: fileRecords.length });
      } catch (fileErr) {
        filesSkipped++;
        fileStats.push({ file: f.name, error: fileErr.message });
      }
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