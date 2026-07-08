import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ──────────────────────────────────────────────────────────────────────────
// importAiBoostSheet — pulls the AI Boost owner/listing Google Sheet into the
// Erudite CRM landlord pipeline. Zero per-row LLM cost: pure CSV fetch + parse
// + clean + idempotent upsert.
//
// Payload:
//   { dry_run?: boolean, agent_email?: string, max_rows?: number }
//
// Dry run returns parsed data without writing. Actual run creates/updates
// Landlord + Property + LandlordProperty link records.
// ──────────────────────────────────────────────────────────────────────────

const CSV_URL = 'https://docs.google.com/spreadsheets/d/1Qu3xT9jrEW_xSVoRDk9cmeBGQVeMdyVId0LcN5v6NyE/export?format=csv';

// ═══════════════════════════════════════════════════════════════════════════
// CSV PARSER — handles quoted fields, escaped quotes ("") , \r\n, BOM
// ═══════════════════════════════════════════════════════════════════════════

function parseCSV(text: string): string[][] {
  // Strip BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field); field = '';
      } else if (ch === '\n') {
        row.push(field); field = ''; rows.push(row); row = [];
      } else if (ch !== '\r') {
        field += ch;
      }
    }
  }
  // trailing field/row
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  // strip trailing empty rows
  while (rows.length > 0 && rows[rows.length - 1].every(c => c.trim() === '')) rows.pop();
  return rows;
}

function csvToObjects(csvRows: string[][]): Record<string, string>[] {
  if (csvRows.length < 2) return [];
  const headers = csvRows[0].map(h => h.trim());
  const objects: Record<string, string>[] = [];
  for (let i = 1; i < csvRows.length; i++) {
    const r = csvRows[i];
    if (r.every(c => c.trim() === '')) continue;
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) obj[headers[j]] = r[j] || '';
    objects.push(obj);
  }
  return objects;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLEANERS
// ═══════════════════════════════════════════════════════════════════════════

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  // UAE mobile: 9-digit starting with 5, or 10-digit starting with 05
  if (digits.length === 9 && digits.startsWith('5')) digits = '971' + digits;
  if (digits.length === 10 && digits.startsWith('05')) digits = '971' + digits.slice(1);
  if (digits.length < 7) return null;             // too short
  if (/^(\d)\1+$/.test(digits)) return null;       // all-same-digit (0000000000, etc.)
  return '+' + digits;
}

function parsePhones(...cells: (string | undefined)[]): string[] {
  const result: string[] = [];
  for (const cell of cells) {
    if (!cell) continue;
    const parts = String(cell).split(/<br\s*\/?>|[\r\n]+/i).map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      const norm = normalizePhone(p);
      if (norm && !result.includes(norm)) result.push(norm);
    }
  }
  return result;
}

function isPlaceholderEmail(email: string): boolean {
  if (!email) return true;
  const e = String(email).trim().toLowerCase();
  if (!e || !e.includes('@')) return true;
  const local = e.split('@')[0];
  if (local.length <= 2) return true;  // M@, A0@, etc.
  if (['none', 'test', 'na', 'n/a', 'null', 'noemail', 'no_email', 'email'].includes(local)) return true;
  return false;
}

function parseEmails(cell: string | undefined): string[] {
  if (!cell) return [];
  const parts = String(cell).split(/<br\s*\/?>|[\r\n]+/i).map(s => s.trim()).filter(Boolean);
  const valid: string[] = [];
  for (const p of parts) {
    if (!isPlaceholderEmail(p)) {
      const lower = p.toLowerCase();
      if (!valid.includes(lower)) valid.push(lower);
    }
  }
  return valid;
}

function parseSize(raw: string | undefined): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s || s.toUpperCase() === 'N/A') return null;
  const normalized = s.replace(',', '.').replace(/[^\d.]/g, '');
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

function parseBedrooms(raw: string | undefined): number | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s || s === 'n/a') return null;
  if (s.includes('studio')) return 0;
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1]) : null;
}

function bedsToLayout(beds: number | null): string {
  if (beds == null) return '';
  if (beds === 0) return 'Studio';
  return beds + 'BHK';
}

function parsePrice(raw: string | undefined): number | null {
  if (!raw) return null;
  const s = String(raw).trim().replace(/[^\d]/g, '');
  if (!s) return null;
  const num = parseInt(s);
  return isNaN(num) ? null : num;
}

function parseCoords(raw: string | undefined): { lat: number; lng: number } | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/q=(-?[\d.]+),(-?[\d.]+)/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

function parsePropertyType(link: string | undefined, subType: string | undefined): string {
  const l = (link || '').toLowerCase();
  if (l.includes('villa')) return 'villa';
  if (l.includes('townhouse')) return 'townhouse';
  if (l.includes('penthouse')) return 'penthouse';
  if (l.includes('studio')) return 'studio';
  if (l.includes('apartment')) return 'apartment';
  if (l.includes('office')) return 'office';
  if (l.includes('retail')) return 'retail';
  if (l.includes('warehouse')) return 'warehouse';
  if (l.includes('land') && !l.includes('island')) return 'land';
  if (l.includes('duplex')) return 'apartment'; // no duplex enum
  const st = (subType || '').toLowerCase();
  if (st.includes('villa')) return 'villa';
  if (st.includes('flat') || st.includes('unit')) return 'apartment';
  return 'apartment';
}

function parseTimestamp(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/(\d+)-(\d+)-(\d+)\s+(\d+):(\d+):(\d+)/);
  if (!m) return null;
  const dd = parseInt(m[1]), mm = parseInt(m[2]), yyyy = parseInt(m[3]);
  const hh = parseInt(m[4]), min = parseInt(m[5]), ss = parseInt(m[6]);
  const date = new Date(Date.UTC(yyyy, mm - 1, dd, hh, min, ss));
  return isNaN(date.getTime()) ? null : date.toISOString();
}

function makeDedupKey(name: string, unit: string, building: string): string {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ') + '|' +
         (unit || '').trim().toLowerCase() + '|' +
         (building || '').trim().toLowerCase();
}

function makePropertyKey(building: string, unit: string): string {
  return (building || '').trim().toLowerCase() + '|' + (unit || '').trim().toLowerCase();
}

function completenessScore(row: { phones: string[]; emails: string[]; price: number | null; coords: any; size: number | null; beds: number | null }): number {
  let s = 0;
  s += (row.phones?.length || 0) * 3;
  s += (row.emails?.length || 0) * 2;
  if (row.price) s += 2;
  if (row.coords) s += 1;
  if (row.size) s += 1;
  if (row.beds != null) s += 1;
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req: Request) => {
  let payload: any = null;
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    payload = await req.json().catch(() => ({}));
    const agentEmail: string = payload?.agent_email || user.email;
    const dryRun: boolean = payload?.dry_run === true;
    const maxRows: number = parseInt(payload?.max_rows) || 0;

    // ── 1. Fetch CSV ──
    const csvRes = await fetch(CSV_URL, { redirect: 'follow' });
    if (!csvRes.ok) {
      return Response.json({ error: 'CSV fetch failed: HTTP ' + csvRes.status }, { status: 502 });
    }
    const csvText = await csvRes.text();

    // HTML check (sheet link-sharing off)
    const trimmed = csvText.trim();
    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<')) {
      return Response.json({
        error: 'CSV URL returned HTML instead of CSV. The sheet link-sharing may be turned off. Please re-share the sheet or add a gid parameter.'
      }, { status: 502 });
    }

    // ── 2. Parse CSV ──
    const csvRows = parseCSV(csvText);
    const objects = csvToObjects(csvRows);
    const totalCsvRows = objects.length;

    // ── 3. Clean rows ──
    const cleaned: any[] = [];
    const skipped: { name: string; reason: string }[] = [];

    for (const row of objects) {
      const ownerName = String(row['Owner Name'] || '').trim();
      const buildingName = String(row['BuildingName'] || row['Building Name'] || '').trim();

      if (!ownerName || ownerName.toLowerCase() === 'contact support for owner') {
        skipped.push({ name: ownerName || '(empty)', reason: 'Contact Support / empty name' });
        continue;
      }

      const phones = parsePhones(row['Phone 1'], row['Phone 2']);
      const emails = parseEmails(row['Email']);
      const size = parseSize(row['Size']);
      const beds = parseBedrooms(row['Bedrooms']);
      const price = parsePrice(row['Price']);
      const coords = parseCoords(row['Google Map']);
      const propType = parsePropertyType(row['Link'], row['Type'], row['Sub Type']);
      const timestamp = parseTimestamp(row['Timestamp']);
      const unitNumber = String(row['Unit Number'] || '').trim();
      const zone = String(row['Zone'] || '').trim();
      const bathrooms = row['Bathrooms'] ? parseInt(String(row['Bathrooms']).replace(/[^\d]/g, '')) : null;
      const rawLink = String(row['Link'] || '').trim();
      const pfLink = rawLink.startsWith('http') ? rawLink : '';
      const landNumber = String(row['Land Number'] || '').trim();
      const municipalityNumber = String(row['Municipality Number'] || '').trim();

      cleaned.push({
        ownerName, phones, emails, unitNumber, buildingName, beds, size, zone,
        propType, timestamp, price, bathrooms, coords, pfLink, landNumber, municipalityNumber,
        completeness: completenessScore({ phones, emails, price, coords, size, beds }),
      });
    }

    let workingSet = cleaned;
    if (maxRows > 0 && maxRows < cleaned.length) workingSet = cleaned.slice(0, maxRows);

    // ── 4. Deduplicate on (Owner Name + Unit Number + Building Name) ──
    const dedupMap = new Map<string, any>();
    for (const row of workingSet) {
      const key = makeDedupKey(row.ownerName, row.unitNumber, row.buildingName);
      const existing = dedupMap.get(key);
      if (!existing) { dedupMap.set(key, row); continue; }
      if (row.completeness > existing.completeness) { dedupMap.set(key, row); continue; }
      if (row.completeness === existing.completeness) {
        if (row.timestamp && existing.timestamp) {
          if (new Date(row.timestamp) > new Date(existing.timestamp)) dedupMap.set(key, row);
        } else if (row.timestamp && !existing.timestamp) {
          dedupMap.set(key, row);
        }
      }
    }
    const deduped = Array.from(dedupMap.values());

    // ── Dry run: return parsed data, no writes ──
    if (dryRun) {
      return Response.json({
        ok: true,
        dry_run: true,
        csv_rows: totalCsvRows,
        after_cleaning: cleaned.length,
        after_dedup: deduped.length,
        dropped_contact_support: skipped.length,
        dropped_duplicates: cleaned.length - deduped.length,
        skipped_sample: skipped.slice(0, 10),
        sample_records: deduped.slice(0, 10).map((r: any) => ({
          name: r.ownerName, phones: r.phones, emails: r.emails,
          unit: r.unitNumber, building: r.buildingName, beds: r.beds,
          size: r.size, price: r.price, zone: r.zone, prop_type: r.propType,
          coords: r.coords, pf_link: r.pfLink,
        })),
      });
    }

    // ── 5. Fetch existing landlords for matching ──
    const svc = base44.asServiceRole;
    const existingLandlords = await svc.entities.Landlord.filter({}, '-created_date', 5000);
    const landlordMap = new Map<string, any>();
    for (const ll of existingLandlords) {
      const key = makeDedupKey(ll.full_name_en, ll.unit_reference, ll.project_name);
      if (!landlordMap.has(key)) landlordMap.set(key, ll);
    }

    // ── 6. Fetch existing properties for matching ──
    const existingProperties = await svc.entities.Property.filter({}, '-created_date', 5000);
    const propertyMap = new Map<string, any>();
    for (const p of existingProperties) {
      const key = makePropertyKey(p.building_name, p.unit_no);
      if (!propertyMap.has(key)) propertyMap.set(key, p);
    }

    // ── 7. Separate creates vs updates ──
    const newLandlordData: any[] = [];
    const newLandlordMeta: { dedupKey: string; rowIndex: number }[] = [];
    const updateLandlordOps: { id: string; data: any; rowIndex: number }[] = [];
    const newPropertyData: any[] = [];
    const newPropertyMeta: { propKey: string; rowIndex: number }[] = [];
    const updatePropertyOps: { id: string; data: any; rowIndex: number }[] = [];
    const linkPairs: { dedupKey: string; propKey: string; rowIndex: number }[] = [];

    for (let idx = 0; idx < deduped.length; idx++) {
      const row = deduped[idx];
      const dedupKey = makeDedupKey(row.ownerName, row.unitNumber, row.buildingName);
      const propKey = makePropertyKey(row.buildingName, row.unitNumber);
      const existingLl = landlordMap.get(dedupKey);
      const existingProp = propertyMap.get(propKey);

      // Landlord data
      const llData: any = {
        full_name_en: row.ownerName,
        phone: row.phones[0] || '',
        additional_phones: row.phones.slice(1),
        whatsapp: row.phones.find((p: string) => p.startsWith('+9715')) || row.phones[0] || '',
        email: row.emails[0] || '',
        additional_emails: row.emails.slice(1),
        unit_reference: row.unitNumber,
        project_name: row.buildingName,
        unit_layout: bedsToLayout(row.beds),
        asking_price_aed: row.price,
        source: 'fsbo_portal',
        assigned_agent_email: agentEmail,
        notes_internal: row.pfLink
          ? 'AI Boost Import\nProperty Finder: ' + row.pfLink
          : 'AI Boost Import',
      };

      // Property data
      const propData: any = {
        title: (row.buildingName || 'Property') + (row.unitNumber ? ' ' + row.unitNumber : '') +
               (row.beds != null ? ' — ' + bedsToLayout(row.beds) : ''),
        property_type: row.propType,
        listing_type: 'sale',
        price_aed: row.price,
        unit_no: row.unitNumber,
        building_name: row.buildingName,
        area_sqft: row.size,
        bedrooms: row.beds,
        bathrooms: row.bathrooms,
        location: row.zone,
        latitude: row.coords ? row.coords.lat : null,
        longitude: row.coords ? row.coords.lng : null,
        status: 'off_market',
        agent_email: agentEmail,
      };

      if (existingLl) {
        // Only fill missing fields — don't overwrite manual edits
        const update: any = {};
        if (!existingLl.phone && llData.phone) update.phone = llData.phone;
        if ((!existingLl.additional_phones || existingLl.additional_phones.length === 0) && llData.additional_phones.length > 0)
          update.additional_phones = llData.additional_phones;
        if (!existingLl.whatsapp && llData.whatsapp) update.whatsapp = llData.whatsapp;
        if (!existingLl.email && llData.email) update.email = llData.email;
        if ((!existingLl.additional_emails || existingLl.additional_emails.length === 0) && llData.additional_emails.length > 0)
          update.additional_emails = llData.additional_emails;
        if (!existingLl.unit_reference && llData.unit_reference) update.unit_reference = llData.unit_reference;
        if (!existingLl.project_name && llData.project_name) update.project_name = llData.project_name;
        if (!existingLl.unit_layout && llData.unit_layout) update.unit_layout = llData.unit_layout;
        if (!existingLl.asking_price_aed && llData.asking_price_aed) update.asking_price_aed = llData.asking_price_aed;
        if (!existingLl.assigned_agent_email && llData.assigned_agent_email) update.assigned_agent_email = llData.assigned_agent_email;
        if (!existingLl.source) update.source = 'fsbo_portal';
        if (row.pfLink && (!existingLl.notes_internal || !String(existingLl.notes_internal).includes('Property Finder')))
          update.notes_internal = (existingLl.notes_internal ? existingLl.notes_internal + '\n' : '') + 'Property Finder: ' + row.pfLink;
        if (Object.keys(update).length > 0) updateLandlordOps.push({ id: existingLl.id, data: update, rowIndex: idx });
        row._landlordId = existingLl.id;
      } else {
        newLandlordData.push(llData);
        newLandlordMeta.push({ dedupKey, rowIndex: idx });
      }

      if (existingProp) {
        const update: any = {};
        if (!existingProp.price_aed && propData.price_aed) update.price_aed = propData.price_aed;
        if (!existingProp.area_sqft && propData.area_sqft) update.area_sqft = propData.area_sqft;
        if (existingProp.bedrooms == null && propData.bedrooms != null) update.bedrooms = propData.bedrooms;
        if (existingProp.bathrooms == null && propData.bathrooms != null) update.bathrooms = propData.bathrooms;
        if (!existingProp.location && propData.location) update.location = propData.location;
        if (!existingProp.latitude && propData.latitude) update.latitude = propData.latitude;
        if (!existingProp.longitude && propData.longitude) update.longitude = propData.longitude;
        if (!existingProp.building_name && propData.building_name) update.building_name = propData.building_name;
        if (!existingProp.unit_no && propData.unit_no) update.unit_no = propData.unit_no;
        if (!existingProp.agent_email && propData.agent_email) update.agent_email = propData.agent_email;
        if (Object.keys(update).length > 0) updatePropertyOps.push({ id: existingProp.id, data: update, rowIndex: idx });
        row._propertyId = existingProp.id;
      } else {
        newPropertyData.push(propData);
        newPropertyMeta.push({ propKey, rowIndex: idx });
      }

      linkPairs.push({ dedupKey, propKey, rowIndex: idx });
    }

    // ── 8. Execute creates ──
    let createdCount = 0;
    let updatedCount = 0;
    const landlordIdMap = new Map<string, string>();  // dedupKey → landlord id
    const propertyIdMap = new Map<string, string>();  // propKey → property id

    // Bulk create new landlords
    if (newLandlordData.length > 0) {
      const createdLls: any = await svc.entities.Landlord.bulkCreate(newLandlordData);
      const arr = Array.isArray(createdLls) ? createdLls : [];
      createdCount += arr.length;
      newLandlordMeta.forEach((meta, i) => {
        const ll = arr[i];
        if (ll && ll.id) landlordIdMap.set(meta.dedupKey, ll.id);
      });
    }

    // Bulk create new properties
    if (newPropertyData.length > 0) {
      const createdProps: any = await svc.entities.Property.bulkCreate(newPropertyData);
      const arr = Array.isArray(createdProps) ? createdProps : [];
      createdCount += arr.length;
      newPropertyMeta.forEach((meta, i) => {
        const p = arr[i];
        if (p && p.id) propertyIdMap.set(meta.propKey, p.id);
      });
    }

    // Individual updates for existing landlords (single-value, not $in)
    for (const op of updateLandlordOps) {
      await svc.entities.Landlord.update(op.id, op.data);
      updatedCount++;
    }

    // Individual updates for existing properties
    for (const op of updatePropertyOps) {
      await svc.entities.Property.update(op.id, op.data);
      updatedCount++;
    }

    // ── 9. Create LandlordProperty links ──
    const existingLinks = await svc.entities.LandlordProperty.filter({}, '-created_date', 5000);
    const linkSet = new Set<string>();
    for (const lp of existingLinks) {
      if (lp.landlord_id && lp.property_id) linkSet.add(lp.landlord_id + '|' + lp.property_id);
    }

    const newLinks: any[] = [];
    for (const pair of linkPairs) {
      const row = deduped[pair.rowIndex];
      const landlordId = landlordIdMap.get(pair.dedupKey) || row._landlordId;
      const propertyId = propertyIdMap.get(pair.propKey) || row._propertyId;
      if (!landlordId || !propertyId) continue;
      const key = landlordId + '|' + propertyId;
      if (linkSet.has(key)) continue;
      linkSet.add(key);
      newLinks.push({ landlord_id: landlordId, property_id: propertyId, role: 'sole_owner' });
    }

    if (newLinks.length > 0) {
      const createdLinks: any = await svc.entities.LandlordProperty.bulkCreate(newLinks);
      createdCount += Array.isArray(createdLinks) ? createdLinks.length : 0;
    }

    // ── 10. Summary ──
    return Response.json({
      ok: true,
      dry_run: false,
      csv_rows: totalCsvRows,
      after_cleaning: cleaned.length,
      after_dedup: deduped.length,
      dropped_contact_support: skipped.length,
      dropped_duplicates: cleaned.length - deduped.length,
      created_landlords: newLandlordData.length,
      updated_landlords: updateLandlordOps.length,
      created_properties: newPropertyData.length,
      updated_properties: updatePropertyOps.length,
      created_links: newLinks.length,
      total_created: createdCount,
      total_updated: updatedCount,
      skipped_sample: skipped.slice(0, 20),
    });

  } catch (error) {
    console.error('importAiBoostSheet error:', error);
    return Response.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
});