import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { extractText, getDocumentProxy } from 'npm:unpdf';

// PREVIEW/TEST ONLY — never writes. Parses a DLD Form A "Real Estate Brokerage
// Contract" PDF, matches it to a Landlord, and RETURNS the proposed mandate
// updates as JSON. The real write is a separate, per-landlord approved step.
//
// Input (POST JSON or query): { file_url } to fetch+extract the PDF, OR
// { text } to parse already-extracted text (for testing without the PDF lib).
// Match priority: 1) form_a_contract_number  2) title_deed_number
//                 3) unit_no + building/project  4) normalized seller name
//                 5) no confident match -> report candidates, write nothing.

const PROJECT_PAGE = 200;

function normSpaces(s: string): string {
  // non-breaking space U+00A0 -> space; soft hyphen U+00AD -> '-'
  return s.replace(/\u00a0/g, ' ').replace(/\u00ad/g, '-');
}
function normName(s: string): string {
  return (s || '').replace(/\s+/g, ' ').trim().toUpperCase();
}
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

const TERM = '(?=[^\\x00-\\x7f]|\\n|$)';
function parseFormA(rawText: string) {
  const text = normSpaces(rawText);
  const f = (pat: string, flags = '') => {
    const m = text.match(new RegExp(pat, flags));
    return m && m[1] ? m[1].trim() : null;
  };
  const contractNo = f('Contract Number\\s+([A-Z]{2}\\d+)');
  const prefix = (contractNo || '').slice(0, 2);
  const ctype = ({ CA: 'Contract A (brokerage/marketing)', CF: 'Unified Sale F', CB: 'Contract B' } as Record<string, string>)[prefix] || null;

  let seller = f('Seller Name\\s*\\n[^\\n]*\\n([A-Z][A-Z .\'-]+?)' + TERM);
  if (!seller) {
    // fallback: first all-caps run before non-ASCII that isn't the broker/office
    const re = /([A-Z][A-Z][A-Z .'\-]{2,}?)(?=[^\x00-\x7f])/g;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(text))) {
      const cand = mm[1].trim();
      if (!/AHMAD BADREDDINE|ERUDITE REAL ESTATE/.test(cand)) { seller = cand; break; }
    }
  }

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
    seller_name_en: seller,
    seller_signature_date: f('Signature Date\\s+(\\d{2}/\\d{2}/\\d{4}\\s+\\d{1,2}:\\d{2}\\s+[AP]M)'),
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
    // seller contact: not present in this DLD format
    seller_mobile: null, seller_email: null, seller_nationality: null, seller_passport_no: null,
  };
}

async function listAll(entity: any, filter: any) {
  const out: any[] = [];
  for (let p = 0; ; p++) {
    const b = await entity.filter(filter, '-created_date', PROJECT_PAGE, p * PROJECT_PAGE);
    out.push(...b);
    if (!b || b.length < PROJECT_PAGE) break;
  }
  return out;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user: any = null;
  try { user = await base44.auth.me(); } catch (_) { /* gate */ }
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  let body: any = {};
  try { body = await req.json(); } catch (_) { /* may be query-only */ }
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
      return Response.json({ error: 'PDF extraction failed', detail: String(e), hint: 'Retry with a {text} body to test parsing/matching independently.' }, { status: 422 });
    }
  }

  const c = parseFormA(rawText!);
  const svc = base44.asServiceRole.entities;
  const warnings: string[] = [];
  if (!c.seller_mobile && !c.seller_email) warnings.push('Seller contact (mobile/email/nationality/passport) not present in this DLD format — matched on property/name only.');

  // ---- match (priority order) ----
  let match: any = { tier: null, via: null, landlord_id: null, landlord_name: null };
  const setMatch = (tier: number, via: string, L: any) => { match = { tier, via, landlord_id: L.id, landlord_name: L.full_name_en }; };

  // 1) form_a_contract_number (re-run / already linked)
  if (c.contract_number) {
    const hit = await listAll(svc.Landlord, { form_a_contract_number: c.contract_number });
    if (hit.length) setMatch(1, 'form_a_contract_number', hit[0]);
  }
  // 2) title_deed_number (on LandlordProperty)
  if (!match.tier && c.title_deed_no) {
    const lp = await listAll(svc.LandlordProperty, { title_deed_number: c.title_deed_no });
    if (lp.length) {
      const L = await svc.Landlord.filter({ id: lp[0].landlord_id });
      if (L && L[0]) setMatch(2, 'title_deed_number', L[0]);
    }
  }
  // 3) unit_no + building/project
  if (!match.tier && c.property_number) {
    const props = (await listAll(svc.Property, { unit_no: c.property_number }))
      .filter((p: any) => !c.building_name || normName(p.building_name) === normName(c.building_name) || normName(p.location) === normName(c.building_name));
    for (const p of props) {
      const lp = await listAll(svc.LandlordProperty, { property_id: p.id });
      if (lp.length) { const L = await svc.Landlord.filter({ id: lp[0].landlord_id }); if (L && L[0]) { setMatch(3, 'unit_no+building', L[0]); break; } }
    }
  }
  // 4) normalized seller name
  let candidates: any[] = [];
  if (!match.tier && c.seller_name_en) {
    const target = normName(c.seller_name_en);
    const all = await listAll(svc.Landlord, {});
    const exact = all.filter((L: any) => normName(L.full_name_en) === target);
    if (exact.length === 1) setMatch(4, 'seller_name_exact', exact[0]);
    else {
      // 5) no confident match -> candidates (shared name tokens)
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
      ...(c.seller_passport_no ? { passport_no: c.seller_passport_no } : {}),
    };
  }
  const proposed_landlordproperty_updates = match.tier ? {
    title_deed_number: c.title_deed_no,
    is_off_plan: c.is_off_plan,
  } : null;

  return Response.json({
    mode: 'preview_no_write',
    extracted: c,
    match: match.tier ? match : { tier: null, via: 'no_confident_match', candidates },
    proposed_landlord_updates,
    proposed_landlordproperty_updates,
    warnings,
    note: 'Nothing was written. Approve a real write separately, per landlord.',
  });
});
