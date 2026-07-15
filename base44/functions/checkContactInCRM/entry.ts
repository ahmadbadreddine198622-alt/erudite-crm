import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// checkContactInCRM — admin-only internal cross-reference.
// For a list of phones + emails, returns how many records in each internal CRM
// database (Landlord, Lead, Contact, OwnerPortfolioUnit) contain that contact.
//
// Input:  { phones: [string], emails: [string] }
// Output: { phones: { "<original>": { landlords, leads, contacts, portfolio_units } }, emails: { ... } }
//
// Phones are matched on a canonical key (digits-only, last 9) so "+971501234567",
// "971501234567" and "0501234567" all resolve to the same record. Emails are
// lowercased + trimmed. Each record increments a key at most once per entity
// (no double-count across phone + whatsapp fields on the same record).

const onlyDigits = (v) => String(v || '').replace(/\D/g, '');
const normEmail = (v) => String(v || '').trim().toLowerCase();

// Single canonical phone key: last 9 digits (UAE mobile tail) when long enough,
// else the full digit string. Same number in any format → same key.
function phoneKey(raw) {
  const d = onlyDigits(raw);
  if (!d) return null;
  return d.length >= 9 ? d.slice(-9) : d;
}

async function loadAll(SR, entityName, cap = 6) {
  const all = [];
  const seen = new Set();
  let lastDate = null;
  for (let page = 0; page < cap; page++) {
    const query = lastDate ? { created_date: { $lt: lastDate } } : {};
    const res = await SR.entities[entityName].filter(query, '-created_date', 5000);
    const rows = Array.isArray(res) ? res : (res.items || []);
    if (!rows.length) break;
    let fresh = 0;
    let oldest = null;
    for (const r of rows) {
      if (!seen.has(r.id)) { seen.add(r.id); all.push(r); fresh++; }
      if (r.created_date && (!oldest || r.created_date < oldest)) oldest = r.created_date;
    }
    if (oldest) lastDate = oldest;
    if (fresh === 0 || rows.length < 5000) break;
  }
  return all;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const phones = Array.isArray(body.phones) ? body.phones.filter(Boolean) : [];
    const emails = Array.isArray(body.emails) ? body.emails.filter(Boolean) : [];

    if (!phones.length && !emails.length) {
      return Response.json({ ok: true, phones: {}, emails: {} });
    }

    const SR = base44.asServiceRole;

    // indexes: key -> { landlords, leads, contacts, portfolio_units }
    const pIdx = new Map();
    const eIdx = new Map();
    const zero = () => ({ landlords: 0, leads: 0, contacts: 0, portfolio_units: 0 });
    const bumpP = (key, field) => { if (!key) return; let e = pIdx.get(key); if (!e) { e = zero(); pIdx.set(key, e); } e[field]++; };
    const bumpE = (key, field) => { if (!key) return; let e = eIdx.get(key); if (!e) { e = zero(); eIdx.set(key, e); } e[field]++; };

    // Landlord — phone, whatsapp, additional_phones; email, additional_emails
    const landlords = await loadAll(SR, 'Landlord');
    for (const r of landlords) {
      const pKeys = new Set();
      [r.phone, r.whatsapp, ...(Array.isArray(r.additional_phones) ? r.additional_phones : [])].forEach((p) => { const k = phoneKey(p); if (k) pKeys.add(k); });
      pKeys.forEach((k) => bumpP(k, 'landlords'));
      const eKeys = new Set();
      [r.email, ...(Array.isArray(r.additional_emails) ? r.additional_emails : [])].forEach((e) => { const k = normEmail(e); if (k) eKeys.add(k); });
      eKeys.forEach((k) => bumpE(k, 'landlords'));
    }

    // Lead — phone, whatsapp; email
    const leads = await loadAll(SR, 'Lead');
    for (const r of leads) {
      const pKeys = new Set();
      [r.phone, r.whatsapp].forEach((p) => { const k = phoneKey(p); if (k) pKeys.add(k); });
      pKeys.forEach((k) => bumpP(k, 'leads'));
      const k = normEmail(r.email); if (k) bumpE(k, 'leads');
    }

    // Contact — phone, whatsapp; emails[]
    const contacts = await loadAll(SR, 'Contact');
    for (const r of contacts) {
      const pKeys = new Set();
      [r.phone, r.whatsapp].forEach((p) => { const k = phoneKey(p); if (k) pKeys.add(k); });
      pKeys.forEach((k) => bumpP(k, 'contacts'));
      const eKeys = new Set();
      (Array.isArray(r.emails) ? r.emails : []).forEach((e) => { const k = normEmail(e); if (k) eKeys.add(k); });
      eKeys.forEach((k) => bumpE(k, 'contacts'));
    }

    // OwnerPortfolioUnit — owner_phone, owner_email
    const opu = await loadAll(SR, 'OwnerPortfolioUnit');
    for (const r of opu) {
      const pk = phoneKey(r.owner_phone); if (pk) bumpP(pk, 'portfolio_units');
      const ek = normEmail(r.owner_email); if (ek) bumpE(ek, 'portfolio_units');
    }

    // Lookups — single canonical key per input (no summing → no double-count)
    const phoneResults = {};
    for (const p of phones) {
      const k = phoneKey(p);
      phoneResults[p] = (k && pIdx.get(k)) || zero();
    }
    const emailResults = {};
    for (const em of emails) {
      const k = normEmail(em);
      emailResults[em] = (k && eIdx.get(k)) || zero();
    }

    return Response.json({ ok: true, phones: phoneResults, emails: emailResults });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});