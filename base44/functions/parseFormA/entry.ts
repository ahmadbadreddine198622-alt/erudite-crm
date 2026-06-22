import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { extractText, getDocumentProxy } from 'npm:unpdf';

// Parses a DLD Form A "Real Estate Brokerage Contract" PDF, matches the owner
// to a Landlord, and returns proposed mandate updates. PREVIEW by default
// (writes nothing); pass { confirm: true } to apply the mandate.
//
// The write ALWAYS targets match.landlord_id (the parser's matched owner),
// NEVER the upload-location landlord. OWNER name comes ONLY from "Owner Details";
// BROKER name/office/ORN come ONLY from "Seller Broker Details". Matching uses
// owner_name + property identifiers — NEVER the broker.
//
// Input (POST JSON): { file_url | text, confirm?, expected_landlord_id? }.

const PAGE = 200;
const ERUDITE_ORN = '29322';
const KNOWN_AGENTS = new Set(['ahmad', 'alisher', 'aizah', 'ajwa', 'adeyemi', 'manusher', 'same', 'selin', 'ola']);

function normSpaces(s) {
  return s.replace(/\u00a0/g, ' ').replace(/\u00ad/g, '-');
}
function normName(s) { return (s || '').replace(/\s+/g, ' ').trim().toUpperCase(); }
function toISO(d) {
  if (!d) return null;
  const m = d.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}T00:00:00.000Z` : null;
}
function num(s) {
  if (!s) return null;
  const n = parseFloat(s.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}
function between(t, a, b) {
  const i = t.indexOf(a);
  if (i < 0) return '';
  const j = t.indexOf(b, i + a.length);
  return t.slice(i, j >= 0 ? j : i + 1500);
}

const TERM = '(?=[^\\x00-\\x7f]|\\n|$)';

function parseFormA(rawText) {
  const text = normSpaces(rawText);
  const f = (pat, src) => {
    const m = (src || text).match(new RegExp(pat));
    return m && m[1] ? m[1].trim() : null;
  };

  const ownerBlock = between(text, 'Owner Details', 'Property Details');
  const brokerBlock = between(text, 'Seller Broker Details', 'Terms & Conditions');

  const firstAllCaps = (block) => {
    const m = block.match(/([A-Z][A-Z][A-Z][A-Z][A-Z .'\-]*?)(?=[^\x00-\x7f]|\n|$)/);
    return m ? m[1].trim() : null;
  };
  const beforeBroker = text.indexOf('Broker Name') > 0 ? text.slice(0, text.indexOf('Broker Name')) : text.slice(0, 400);
  const owner_name =
    f("Seller Name\\s*\\n[^\\n]*\\n([A-Z][A-Z .'-]+?)" + TERM, ownerBlock)
    || f("Seller Name\\s*\\n([A-Z][A-Z .'-]+?)" + TERM, ownerBlock)
    || firstAllCaps(ownerBlock)
    || firstAllCaps(beforeBroker);
  const owner_signature_date = f('Signature Date\\s+(\\d{2}/\\d{2}/\\d{4}\\s+\\d{1,2}:\\d{2}\\s+[AP]M)', ownerBlock);

  const STATUS = '(Active|Approved|Accepted|Expired|Cancelled|Pending|Draft|Rejected|New)';
  const contractInfoBlock = between(text, 'Contract Information', 'Owner Details');
  const status =
    f('Status[\\s\\S]{0,20}?' + STATUS)
    || f('(?:^|[^A-Za-z])' + STATUS + '(?=[^\\x00-\\x7f]|\\n|$)', contractInfoBlock);

  const broker_name = f("Broker Name\\s*\\(English\\)\\s*([A-Z][A-Z .'-]+?)" + TERM, brokerBlock);
  const broker_office = f("Office Name\\s*\\(English\\)\\s*([A-Z0-9 .'&-]+?)" + TERM, brokerBlock);
  const broker_orn = f('ORN\\s+(\\d+)', brokerBlock);
  const broker_brn = f('BRN:?\\s*(\\d+)', brokerBlock);

  const contractNo = f('Contract Number\\s+([A-Z]{2}\\d+)');
  const prefix = (contractNo || '').slice(0, 2);
  const ctypeMap = { CA: 'Contract A (brokerage/marketing)', CF: 'Unified Sale F', CB: 'Contract B' };
  const ctype = ctypeMap[prefix] || null;

  return {
    contract_number: contractNo,
    contract_type: ctype ? `${prefix} = ${ctype}` : null,
    status,
    start_date: f('Start Date\\s+(\\d{2}/\\d{2}/\\d{4})'),
    end_date: f('End Date\\s+(\\d{2}/\\d{2}/\\d{4})'),
    is_exclusive: f('Is Exclusive\\?\\s+(Yes|No)'),
    noc_from_developer: f('Noc From\\s*Developer\\s+(Yes|No)'),
    is_seller_covering_marketing_fees: f('marketing fees\\?\\s+(Yes|No)'),
    commission_aed: f('Commission AED\\s+([\\d,]+(?:\\.\\d+)?)'),
    commission_pct: f('Commission\\s+([\\d.]+)\\s*%'),
    title_deed_no: f('Title Deed #\\s+(\\d+/\\d+)'),
    sell_price_aed: f('Sell Price AED\\s+([\\d,]+\\.\\d{2})'),
    outstanding_service_charge_aed: f('Charge Amount AED\\s+([\\d,]+\\.\\d{2})'),
    owner_name,
    owner_signature_date,
    owner_mobile: null, owner_email: null, owner_nationality: null, owner_passport_no: null,
    broker_name,
    broker_office,
    broker_orn,
    broker_brn,
    location: f('Location\\s+([\\x20-\\x7e]+?)' + TERM),
    building_name: f('Building Name\\s+([\\x20-\\x7e]+?)' + TERM),
    project_name: f('Project Name\\s+([\\x20-\\x7e]+?)' + TERM),
    property_number: f('Property\\s*Number\\s+([A-Za-z0-9-]+)'),
    building_number: f('Building Number\\s+(\\d+)'),
    plot_number: f('Plot Number\\s+([\\d/]+)'),
    floor_number: f('Floor Number\\s+(\\d+)'),
    no_of_bedrooms: f('Bedrooms\\s+(\\d+)'),
    area_size_sqmt: f('Area Size \\(SqMt\\)\\s+([\\d.]+)'),
    is_off_plan: /is off-plan/i.test(text),
  };
}

async function listAll(entity, filter) {
  const out = [];
  for (let p = 0; ; p++) {
    const b = await entity.filter(filter, '-created_date', PAGE, p * PAGE);
    out.push(...b);
    if (!b || b.length < PAGE) break;
  }
  return out;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user = null;
  try { user = await base44.auth.me(); } catch (_) { /* gate */ }
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  let body = {};
  try { body = await req.json(); } catch (_) { /* query-only */ }
  const url = new URL(req.url);
  const fileUrl = body.file_url || url.searchParams.get('file_url');
  let rawText = body.text || null;

  if (!rawText) {
    if (!fileUrl) return Response.json({ error: 'Provide file_url (PDF) or text' }, { status: 400 });
    try {
      const buf = new Uint8Array(await (await fetch(fileUrl)).arrayBuffer());
      const pdf = await getDocumentProxy(buf);
      const r = await extractText(pdf, { mergePages: true });
      rawText = Array.isArray(r.text) ? r.text.join('\n') : r.text;
    } catch (e) {
      return Response.json({ error: 'PDF extraction failed', detail: String(e), hint: 'Retry with a {text} body.' }, { status: 422 });
    }
  }

  const c = parseFormA(rawText);

  if (body.debug === true) {
    return Response.json({
      parser_version: 'v9-form-a-contracts-list',
      extracted: { status: c.status, owner_name: c.owner_name, contract_number: c.contract_number, property_number: c.property_number, broker_name: c.broker_name },
      raw_text_first_2600: (rawText || '').slice(0, 2600),
      raw_text_length: (rawText || '').length,
    });
  }

  const svc = base44.asServiceRole.entities;
  const warnings = [];

  const brokerFirst = (c.broker_name || '').trim().split(' ')[0].toLowerCase();
  const handling_agent_email = KNOWN_AGENTS.has(brokerFirst) ? `${brokerFirst}@erudite-estate.com` : null;

  const officeIsErudite = !!(c.broker_office && normName(c.broker_office).startsWith('ERUDITE REAL ESTATE') && c.broker_orn === ERUDITE_ORN);
  if (!officeIsErudite) {
    warnings.push(`Contract held by another brokerage — possible competitor mandate. Office: ${c.broker_office || 'unknown'} (ORN ${c.broker_orn || 'n/a'}).`);
  } else if (!handling_agent_email) {
    warnings.push(`Broker "${c.broker_name}" is on the Erudite office but not in the known agent list — verify handling agent.`);
  }
  warnings.push('Owner contact (mobile/email/nationality/passport) is not present in this DLD format — owner matched by name + property identifiers only.');

  let match = { tier: null, via: null, landlord_id: null, landlord_name: null, landlord_stage: null };
  let matchedLandlord = null;
  const setMatch = (tier, via, L) => { match = { tier, via, landlord_id: L.id, landlord_name: L.full_name_en, landlord_stage: L.stage || null }; matchedLandlord = L; };
  let needsReview = null;

  if (c.contract_number) {
    const hit = await listAll(svc.Landlord, { form_a_contract_number: c.contract_number });
    if (hit.length) setMatch(1, 'form_a_contract_number', hit[0]);
  }
  if (!match.tier && c.title_deed_no) {
    const lp = await listAll(svc.LandlordProperty, { title_deed_number: c.title_deed_no });
    if (lp.length) {
      const L = await svc.Landlord.filter({ id: lp[0].landlord_id });
      if (L && L[0]) setMatch(2, 'title_deed_number', L[0]);
    }
  }
  if (!match.tier && c.property_number) {
    const targetOwner = normName(c.owner_name);
    const props = (await listAll(svc.Property, { unit_no: c.property_number }))
      .filter((p) => !c.building_name || normName(p.building_name) === normName(c.building_name) || normName(p.location) === normName(c.building_name));
    for (const p of props) {
      const links = await listAll(svc.LandlordProperty, { property_id: p.id });
      if (!links.length) continue;
      const coOwners = [];
      for (const lp of links) {
        const L = await svc.Landlord.filter({ id: lp.landlord_id });
        if (L && L[0]) coOwners.push(L[0]);
      }
      if (!coOwners.length) continue;
      if (coOwners.length === 1) { setMatch(3, 'unit_no+building (sole owner)', coOwners[0]); break; }
      const byName = targetOwner ? coOwners.filter((L) => normName(L.full_name_en) === targetOwner) : [];
      if (byName.length === 1) { setMatch(3, 'unit_no+owner_name_tiebreak (joint unit)', byName[0]); break; }
      needsReview = {
        reason: byName.length > 1 ? 'joint_unit_multiple_name_matches' : 'joint_unit_no_owner_name_match',
        unit: c.property_number,
        building: c.building_name,
        contract_owner_name: c.owner_name,
        candidate_co_owners: coOwners.map((L) => ({ landlord_id: L.id, name: L.full_name_en })),
      };
      break;
    }
  }
  let candidates = [];
  if (!match.tier && !needsReview && c.owner_name) {
    const target = normName(c.owner_name);
    const all = await listAll(svc.Landlord, {});
    const exact = all.filter((L) => normName(L.full_name_en) === target);
    if (exact.length === 1) setMatch(4, 'owner_name_exact', exact[0]);
    else {
      const tokens = new Set(target.split(' ').filter((t) => t.length > 2));
      candidates = all
        .map((L) => ({ L, overlap: normName(L.full_name_en).split(' ').filter((t) => tokens.has(t)).length }))
        .filter((x) => x.overlap > 0)
        .sort((a, b) => b.overlap - a.overlap)
        .slice(0, 5)
        .map((x) => ({ landlord_id: x.L.id, name: x.L.full_name_en, shared_name_tokens: x.overlap }));
    }
  }

  // Stage order for auto-advance
  const STAGE_ORDER = ['initial_contact', 'price_discovery', 'listing_commitment', 'form_a_initiation', 'form_a_signing', 'owner_documents', 'photos_videos', 'photographer_scheduling', 'listing_creation', 'internal_verification', 'listing_publication', 'final_confirmation'];

  let proposed_landlord_updates = null;
  if (match.tier) {
    proposed_landlord_updates = {
      form_a_contract_number: c.contract_number,
      form_a_pdf_url: fileUrl || null,
      mandate_type: c.is_exclusive === 'Yes' ? 'exclusive' : (c.is_exclusive === 'No' ? 'non_exclusive' : null),
      mandate_status: (c.status === 'Active' || c.status === 'Approved' || c.status === 'Accepted') ? 'form_a_signed' : (c.status === 'Expired' ? 'expired' : (c.status === 'Cancelled' ? 'cancelled' : null)),
      mandate_start_date: toISO(c.start_date),
      mandate_expires_at: toISO(c.end_date),
      asking_price_aed: num(c.sell_price_aed),
      ...(handling_agent_email ? { assigned_agent_email: handling_agent_email } : {}),
      ...(c.commission_pct ? { commission_pct_negotiated: num(c.commission_pct) } : {}),
    };

    // ---- form_a_contracts list: append/update (dedupe by contract_number) ----
    const newEntry = {
      contract_number: c.contract_number,
      unit: c.property_number || null,
      pdf_url: fileUrl || null,
      mandate_type: proposed_landlord_updates.mandate_type,
      mandate_status: proposed_landlord_updates.mandate_status,
      mandate_start_date: proposed_landlord_updates.mandate_start_date,
      mandate_expires_at: proposed_landlord_updates.mandate_expires_at,
      asking_price_aed: proposed_landlord_updates.asking_price_aed,
    };
    let contracts = Array.isArray(matchedLandlord && matchedLandlord.form_a_contracts)
      ? matchedLandlord.form_a_contracts.slice()
      : [];
    // Migrate existing single-field mandate into the list if list is empty
    if (contracts.length === 0 && matchedLandlord && matchedLandlord.form_a_contract_number) {
      contracts.push({
        contract_number: matchedLandlord.form_a_contract_number,
        unit: matchedLandlord.unit_reference || null,
        pdf_url: matchedLandlord.form_a_pdf_url || null,
        mandate_type: matchedLandlord.mandate_type || null,
        mandate_status: matchedLandlord.mandate_status || null,
        mandate_start_date: matchedLandlord.mandate_start_date || null,
        mandate_expires_at: matchedLandlord.mandate_expires_at || null,
        asking_price_aed: (matchedLandlord.asking_price_aed != null ? matchedLandlord.asking_price_aed : null),
      });
    }
    const exIdx = contracts.findIndex((e) => e && e.contract_number === newEntry.contract_number);
    if (exIdx >= 0) contracts[exIdx] = newEntry;
    else contracts.push(newEntry);
    proposed_landlord_updates.form_a_contracts = contracts;

    // Stage auto-advance: only forward, never backward
    if (proposed_landlord_updates.mandate_status === 'form_a_signed') {
      const curIdx = STAGE_ORDER.indexOf(match.landlord_stage);
      const targetIdx = STAGE_ORDER.indexOf('form_a_signing'); // index 4
      // curIdx === -1 means unknown/null stage — advance in that case too
      if (curIdx < targetIdx) {
        proposed_landlord_updates.stage = 'form_a_signing';
        proposed_landlord_updates.stage_entered_at = new Date().toISOString();
      }
    }
  }

  const proposed_landlordproperty_updates = match.tier ? { title_deed_number: c.title_deed_no, is_off_plan: c.is_off_plan } : null;

  const expected_landlord_id = body.expected_landlord_id || null;
  if (expected_landlord_id && match.tier && expected_landlord_id !== match.landlord_id) {
    warnings.push(`Upload-location landlord (${expected_landlord_id}) differs from the MATCHED landlord (${match.landlord_id} / ${match.landlord_name}). The write targets the MATCHED landlord; the upload location is ignored.`);
  }

  const wantWrite = body.confirm === true;
  if (wantWrite && needsReview) {
    return Response.json({ mode: 'refused', reason: 'needs_review', needs_review: needsReview, warnings, note: 'No write — unit is jointly owned and the contract seller could not be uniquely matched to a co-owner. Resolve manually.' });
  }
  if (wantWrite && (!match.tier || !match.landlord_id || !proposed_landlord_updates)) {
    return Response.json({ mode: 'refused', reason: 'no_confident_match', match, warnings, note: 'No write — owner was not confidently matched.' });
  }

  let written = null;
  if (wantWrite) {
    if (match.tier && proposed_landlord_updates) {
      try {
        await svc.FormA.create({
          contract_number: c.contract_number,
          status: c.status,
          start_date: toISO(c.start_date),
          end_date: toISO(c.end_date),
          is_exclusive: c.is_exclusive === 'Yes',
          commission_pct: num(c.commission_pct),
          sell_price_aed: num(c.sell_price_aed),
          owner_name: c.owner_name,
          broker_name: c.broker_name,
          broker_office: c.broker_office,
          broker_orn: c.broker_orn,
          landlord_id: match.landlord_id,
          pdf_url: fileUrl || null,
        });
      } catch (e) {
        warnings.push(`Failed to create FormA entity record: ${e.message}`);
      }
    }
    written = { landlord_id: match.landlord_id, landlord_name: match.landlord_name, landlord_updated: false, landlordproperty_updated: false };
    try {
      await svc.Landlord.update(match.landlord_id, proposed_landlord_updates);
      written.landlord_updated = true;
      written.stage_advanced_to = proposed_landlord_updates.stage || null;
    } catch (e) {
      return Response.json({
        parser_version: 'v9-form-a-contracts-list',
        mode: 'write_error',
        step: 'landlord_update',
        landlord_id: match.landlord_id,
        attempted_update: proposed_landlord_updates,
        error: String(e && e.message ? e.message : e),
      });
    }
    if (proposed_landlordproperty_updates && c.property_number) {
      try {
        const props = (await listAll(svc.Property, { unit_no: c.property_number }))
          .filter((p) => !c.building_name || normName(p.building_name) === normName(c.building_name));
        for (const p of props) {
          const lps = await listAll(svc.LandlordProperty, { landlord_id: match.landlord_id, property_id: p.id });
          if (lps.length) {
            await svc.LandlordProperty.update(lps[0].id, proposed_landlordproperty_updates);
            written.landlordproperty_updated = true;
            written.landlordproperty_id = lps[0].id;
            break;
          }
        }
        if (!written.landlordproperty_updated) warnings.push('Could not locate the matched landlord\'s LandlordProperty row for this unit; title-deed/off-plan not written.');
      } catch (e) {
        written.landlordproperty_error = String(e && e.message ? e.message : e);
      }
    }
  }

  if (needsReview && !match.tier) {
    warnings.push(`Joint unit ${needsReview.unit}: contract seller "${needsReview.contract_owner_name}" did not uniquely match a co-owner. No auto-target — see needs_review.candidate_co_owners.`);
  }

  return Response.json({
    parser_version: 'v9-form-a-contracts-list',
    mode: wantWrite ? 'written' : (needsReview && !match.tier ? 'needs_review' : 'preview_no_write'),
    extracted: c,
    broker: { broker_name: c.broker_name, broker_office: c.broker_office, broker_orn: c.broker_orn, office_is_erudite: officeIsErudite, handling_agent_email },
    match: match.tier ? match : (needsReview ? { tier: null, via: 'needs_review' } : { tier: null, via: 'no_confident_match', candidates }),
    needs_review: needsReview,
    will_write_to: match.tier ? { landlord_id: match.landlord_id, landlord_name: match.landlord_name, matched_via: match.via, tier: match.tier } : null,
    upload_location_landlord_id: expected_landlord_id,
    ignored_upload_location: !!(expected_landlord_id && match.tier && expected_landlord_id !== match.landlord_id),
    proposed_landlord_updates,
    proposed_landlordproperty_updates,
    written,
    warnings,
    note: wantWrite
      ? `Mandate written to the MATCHED landlord ${match.landlord_name} (${match.landlord_id}). Upload location was not used as the write target.`
      : (needsReview && !match.tier
        ? 'Joint unit — the contract seller was not uniquely matched to a co-owner. Review needs_review.candidate_co_owners; no auto-write.'
        : 'Nothing written. Pass { confirm: true } to write to the MATCHED landlord shown in will_write_to (never the upload card).'),
  });
});