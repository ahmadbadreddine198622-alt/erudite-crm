import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { extractText, getDocumentProxy } from 'npm:unpdf';

// PREVIEW/TEST ONLY — never writes. Parses a DLD Form A "Real Estate Brokerage
// Contract" PDF and RETURNS proposed mandate updates as JSON. Real write is a
// separate per-landlord approved step.
//
// OWNER (landlord) name comes ONLY from the "Owner Details" block.
// BROKER name/office/ORN come ONLY from the "Seller Broker Details" block.
// Landlord matching uses owner_name + property identifiers — NEVER the broker.
//
// Input (POST JSON or query): { file_url } or { text }.

const PAGE = 200;
const ERUDITE_ORN = '29322';
// Erudite agents: broker first-name -> {first}@erudite-estate.com
const KNOWN_AGENTS = new Set(['ahmad', 'alisher', 'aizah', 'ajwa', 'adeyemi', 'manusher', 'same', 'selin', 'ola']);

function normSpaces(s: string): string {
  // non-breaking space U+00A0 -> space; soft hyphen U+00AD -> '-'
  return s.replace(/\u00a0/g, ' ').replace(/\u00ad/g, '-');
}
function normName(s: string): string { return (s || '').replace(/\s+/g, ' ').trim().toUpperCase(); }
function toISO(d: string | null): string | null {
  if (!d) return null;
  const m = d.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}T00:00:00.000Z` : null;
}
function num(s: string | null): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}
function between(t: string, a: string, b: string): string {
  const i = t.indexOf(a);
  if (i < 0) return '';
  const j = t.indexOf(b, i + a.length);
  return t.slice(i, j >= 0 ? j : i + 1500);
}

const TERM = '(?=[^\\x00-\\x7f]|\\n|$)';

function parseFormA(rawText: string) {
  const text = normSpaces(rawText);
  const f = (pat: string, src = text) => {
    const m = src.match(new RegExp(pat));
    return m && m[1] ? m[1].trim() : null;
  };

  // ---- sections ----
  const ownerBlock = between(text, 'Owner Details', 'Property Details');
  const brokerBlock = between(text, 'Seller Broker Details', 'Terms & Conditions');

  // OWNER (landlord) — strictly from Owner Details block
  const owner_name = f("Seller Name\\s*\\n[^\\n]*\\n([A-Z][A-Z .'-]+?)" + TERM, ownerBlock);
  const owner_signature_date = f('Signature Date\\s+(\\d{2}/\\d{2}/\\d{4}\\s+\\d{1,2}:\\d{2}\\s+[AP]M)', ownerBlock);

  // BROKER — strictly from Seller Broker Details block
  const broker_name = f("Broker Name\\s*\\(English\\)\\s*([A-Z][A-Z .'-]+?)" + TERM, brokerBlock);
  const broker_office = f("Office Name\\s*\\(English\\)\\s*([A-Z0-9 .'&-]+?)" + TERM, brokerBlock);
  const broker_orn = f('ORN\\s+(\\d+)', brokerBlock);
  const broker_brn = f('BRN:?\\s*(\\d+)', brokerBlock);

  const contractNo = f('Contract Number\\s+([A-Z]{2}\\d+)');
  const prefix = (contractNo || '').slice(0, 2);
  const ctype = ({ CA: 'Contract A (brokerage/marketing)', CF: 'Unified Sale F', CB: 'Contract B' } as Record<string, string>)[prefix] || null;

  return {
    contract_number: contractNo,
    contract_type: ctype ? `${prefix} = ${ctype}` : null,
    status: f('Status\\s+([A-Za-z]+)' + TERM),
    start_date: f('Start Date\\s+(\\d{2}/\\d{2}/\\d{4})'),
    end_date: f('End Date\\s+(\\d{2}/\\d{2}/\\d{4})'),
    is_exclusive: f('Is Exclusive\\?\\s+(Yes|No)'),
    noc_from_developer: f('Noc From\\s*Developer\\s+(Yes|No)'),
    is_seller_covering_marketing_fees: f('marketing fees\\?\\s+(Yes|No)'),
    commission_aed: f('Commission AED\\s+([\\d,]+(?:\\.\\d+)?)'),
    title_deed_no: f('Title Deed #\\s+(\\d+/\\d+)'),
    sell_price_aed: f('Sell Price AED\\s+([\\d,]+\\.\\d{2})'),
    outstanding_service_charge_aed: f('Charge Amount AED\\s+([\\d,]+\\.\\d{2})'),
    // OWNER (landlord)
    owner_name,
    owner_signature_date,
    owner_mobile: null, owner_email: null, owner_nationality: null, owner_passport_no: null,
    // BROKER (separate)
    broker_name,
    broker_office,
    broker_orn,
    broker_brn,
    // property
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

async function listAll(entity: any, filter: any) {
  const out: any[] = [];
  for (let p = 0; ; p++) {
    const b = await entity.filter(filter, '-created_date', PAGE, p * PAGE);
    out.push(...b);
    if (!b || b.length < PAGE) break;
  }
  return out;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user: any = null;
  try { user = await base44.auth.me(); } catch (_) { /* gate */ }
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  let body: any = {};
  try { body = await req.json(); } catch (_) { /* query-only */ }
  const url = new URL(req.url);
  const fileUrl = body.file_url || url.searchParams.get('file_url');
  let rawText: string | null = body.text || null;

  if (!rawText) {
    if (!fileUrl) return Response.json({ error: 'Provide file_url (PDF) or text' }, { status: 400 });
    try {
      const buf = new Uint8Array(await (await fetch(fileUrl)).arrayBuffer());
      const pdf = await getDocumentProxy(buf);
      const r: any = await extractText(pdf, { mergePages: true });
      rawText = Array.isArray(r.text) ? r.text.join('\n') : r.text;
    } catch (e) {
      return Response.json({ error: 'PDF extraction failed', detail: String(e), hint: 'Retry with a {text} body.' }, { status: 422 });
    }
  }

  const c = parseFormA(rawText!);
  const svc = base44.asServiceRole.entities;
  const warnings: string[] = [];

  // ---- handling agent from broker (Erudite agent list) ----
  const brokerFirst = (c.broker_name || '').trim().split(' ')[0].toLowerCase();
  const handling_agent_email = KNOWN_AGENTS.has(brokerFirst) ? `${brokerFirst}@erudite-estate.com` : null;

  // ---- office / competitor check ----
  const officeIsErudite = !!(c.broker_office && normName(c.broker_office).startsWith('ERUDITE REAL ESTATE') && c.broker_orn === ERUDITE_ORN);
  if (!officeIsErudite) {
    warnings.push(`Contract held by another brokerage — possible competitor mandate. Office: ${c.broker_office || 'unknown'} (ORN ${c.broker_orn || 'n/a'}).`);
  } else if (!handling_agent_email) {
    warnings.push(`Broker "${c.broker_name}" is on the Erudite office but not in the known agent list — verify handling agent.`);
  }
  warnings.push('Owner contact (mobile/email/nationality/passport) is not present in this DLD format — owner matched by name + property identifiers only.');

  // ---- match landlord (property identifiers first; NEVER broker name) ----
  let match: any = { tier: null, via: null, landlord_id: null, landlord_name: null };
  const setMatch = (tier: number, via: string, L: any) => { match = { tier, via, landlord_id: L.id, landlord_name: L.full_name_en }; };

  if (c.contract_number) {
    const hit = await listAll(svc.Landlord, { form_a_contract_number: c.contract_number });
    if (hit.length) setMatch(1, 'form_a_contract_number', hit[0]);
  }
  if (!match.tier && c.title_deed_no) {
    const lp = await listAll(svc.LandlordProperty, { title_deed_number: c.title_deed_no });
    if (lp.length) { const L = await svc.Landlord.filter({ id: lp[0].landlord_id }); if (L && L[0]) setMatch(2, 'title_deed_number', L[0]); }
  }
  if (!match.tier && c.property_number) {
    const props = (await listAll(svc.Property, { unit_no: c.property_number }))
      .filter((p: any) => !c.building_name || normName(p.building_name) === normName(c.building_name) || normName(p.location) === normName(c.building_name));
    for (const p of props) {
      const lp = await listAll(svc.LandlordProperty, { property_id: p.id });
      if (lp.length) { const L = await svc.Landlord.filter({ id: lp[0].landlord_id }); if (L && L[0]) { setMatch(3, 'unit_no+building', L[0]); break; } }
    }
  }
  let candidates: any[] = [];
  if (!match.tier && c.owner_name) {
    const target = normName(c.owner_name);
    const all = await listAll(svc.Landlord, {});
    const exact = all.filter((L: any) => normName(L.full_name_en) === target);
    if (exact.length === 1) setMatch(4, 'owner_name_exact', exact[0]);
    else {
      const tokens = new Set(target.split(' ').filter((t) => t.length > 2));
      candidates = all
        .map((L: any) => ({ L, overlap: normName(L.full_name_en).split(' ').filter((t: string) => tokens.has(t)).length }))
        .filter((x: any) => x.overlap > 0)
        .sort((a: any, b: any) => b.overlap - a.overlap)
        .slice(0, 5)
        .map((x: any) => ({ landlord_id: x.L.id, name: x.L.full_name_en, shared_name_tokens: x.overlap }));
    }
  }

  // ---- proposed updates (NOT written) ----
  let proposed_landlord_updates: any = null;
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
    };
  }
  const proposed_landlordproperty_updates = match.tier ? { title_deed_number: c.title_deed_no, is_off_plan: c.is_off_plan } : null;

  return Response.json({
    mode: 'preview_no_write',
    extracted: c,
    broker: { broker_name: c.broker_name, broker_office: c.broker_office, broker_orn: c.broker_orn, office_is_erudite: officeIsErudite, handling_agent_email },
    match: match.tier ? match : { tier: null, via: 'no_confident_match', candidates },
    proposed_landlord_updates,
    proposed_landlordproperty_updates,
    warnings,
    note: 'Nothing was written. Approve a real write separately, per landlord.',
  });
});
