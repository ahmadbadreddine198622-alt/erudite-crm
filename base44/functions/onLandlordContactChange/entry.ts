import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Entity-automation handler: re-derive a landlord's iMessage handles whenever the
// record is created or its phone/email/whatsapp contact fields change.
// Runs unauthenticated (automation context) → service role; inlines the same
// resolution logic as resolveLandlordIMessage (no local imports across functions).

function normalizePhone(raw) {
  if (!raw) return '';
  let digits = String(raw).trim().replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  if (digits.startsWith('971')) return '+' + digits;
  if (digits.startsWith('0')) return '+971' + digits.slice(1);
  return '+971' + digits;
}
function normalizeEmail(raw) {
  if (!raw) return '';
  const t = String(raw).trim().toLowerCase();
  return t.includes('@') ? t : '';
}
function parseVCard(vcf) {
  const out = { phones: [], emails: [] };
  if (!vcf || typeof vcf !== 'string') return out;
  for (const line of vcf.split(/\r?\n/)) {
    const trimmed = line.trim();
    const upper = trimmed.toUpperCase();
    const colon = trimmed.indexOf(':');
    if (colon < 0) continue;
    const value = trimmed.slice(colon + 1).trim();
    if (!value) continue;
    if (upper.startsWith('TEL')) out.phones.push(value);
    else if (upper.startsWith('EMAIL')) out.emails.push(value);
  }
  return out;
}
function collectHandles(L) {
  const phoneFields = ['phone', 'phone_2', 'phone2', 'mobile', 'mobile1', 'mobile2', 'whatsapp', 'landline', 'tel', 'secondary_phone'];
  const emailFields = ['email', 'email_2', 'email2', 'personal_email', 'work_email', 'secondary_email'];
  const seen = new Set();
  const result = [];
  const add = (norm, type, sourceField) => {
    if (!norm) return;
    const key = type + ':' + norm;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ handle: norm, type, source_field: sourceField });
  };
  for (const f of phoneFields) add(normalizePhone(L[f]), 'phone', f);
  for (const f of emailFields) add(normalizeEmail(L[f]), 'email', f);
  if (Array.isArray(L.additional_phones)) L.additional_phones.forEach((p) => add(normalizePhone(p), 'phone', 'additional_phones'));
  if (Array.isArray(L.additional_emails)) L.additional_emails.forEach((e) => add(normalizeEmail(e), 'email', 'additional_emails'));
  const vcfRaw = L.vcard || L.vcf || L.raw_vcard || L.contact_vcard || '';
  if (vcfRaw) {
    const parsed = parseVCard(vcfRaw);
    parsed.phones.forEach((p) => add(normalizePhone(p), 'phone', 'vcard'));
    parsed.emails.forEach((e) => add(normalizeEmail(e), 'email', 'vcard'));
  }
  return result;
}
async function checkHandle(serverUrl, password, handle) {
  try {
    const url = `${serverUrl}/api/v1/handle/availability/imessage?address=${encodeURIComponent(handle)}&password=${encodeURIComponent(password)}`;
    const resp = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json', 'skip_zrok_interstitial': 'true' } });
    const raw = await resp.text();
    let data; try { data = JSON.parse(raw); } catch { data = { raw }; }
    if (!resp.ok) return 'error';
    const d = data?.data ?? data;
    const available = d?.available === true || d?.available === 'true' || d === true;
    return available ? 'available' : 'not_available';
  } catch (_) { return 'error'; }
}
function pickPrimary(handles) {
  const ap = handles.find((h) => h.type === 'phone' && h.imessage_status === 'available');
  if (ap) return ap.handle;
  const ae = handles.find((h) => h.type === 'email' && h.imessage_status === 'available');
  if (ae) return ae.handle;
  return '';
}

// Only re-resolve when a contact field actually changed (avoids loops + needless relay calls).
const CONTACT_FIELDS = ['phone', 'whatsapp', 'email', 'additional_phones', 'additional_emails', 'vcard', 'vcf', 'raw_vcard', 'contact_vcard'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const event = payload?.event || {};
    const landlordId = event.entity_id;
    if (!landlordId) return Response.json({ skipped: 'no entity_id' });

    // On update, skip when no contact field changed.
    if (event.type === 'update') {
      const cf = Array.isArray(payload.changed_fields) ? payload.changed_fields : [];
      const touched = cf.some((f) => CONTACT_FIELDS.includes(f));
      if (cf.length && !touched) return Response.json({ skipped: 'no contact field changed', changed_fields: cf });
    }

    const landlord = await base44.asServiceRole.entities.Landlord.get(landlordId).catch(() => null);
    if (!landlord) return Response.json({ skipped: 'landlord not found' });

    const resolvedAt = new Date().toISOString();
    const candidates = collectHandles(landlord);

    if (candidates.length === 0) {
      await base44.asServiceRole.entities.Landlord.update(landlordId, {
        imessage_handles: [], imessage_handle: '', imessage_status: 'unknown',
        imessage_checked_at: resolvedAt, imessage_resolved_at: resolvedAt,
      }).catch(() => {});
      return Response.json({ success: true, landlord_id: landlordId, imessage_status: 'unknown' });
    }

    const serverUrl = (Deno.env.get('BLUEBUBBLES_SERVER_URL') || '').replace(/\/+$/, '');
    const password = Deno.env.get('BLUEBUBBLES_PASSWORD') || '';
    if (!serverUrl || !password) {
      const handles = candidates.map((c) => ({ ...c, imessage_status: 'unknown' }));
      await base44.asServiceRole.entities.Landlord.update(landlordId, {
        imessage_handles: handles, imessage_handle: '', imessage_status: 'error',
        imessage_checked_at: resolvedAt, imessage_resolved_at: resolvedAt,
      }).catch(() => {});
      return Response.json({ success: true, landlord_id: landlordId, imessage_status: 'error', detail: 'relay not configured' });
    }

    const handles = [];
    for (const c of candidates) {
      handles.push({ ...c, imessage_status: await checkHandle(serverUrl, password, c.handle) });
    }
    const primary = pickPrimary(handles);
    let primaryStatus;
    if (primary) primaryStatus = 'available';
    else if (handles.some((h) => h.imessage_status === 'error')) primaryStatus = 'error';
    else primaryStatus = 'not_available';

    await base44.asServiceRole.entities.Landlord.update(landlordId, {
      imessage_handles: handles, imessage_handle: primary, imessage_status: primaryStatus,
      imessage_checked_at: resolvedAt, imessage_resolved_at: resolvedAt,
    }).catch(() => {});

    return Response.json({ success: true, landlord_id: landlordId, imessage_handle: primary, imessage_status: primaryStatus, handle_count: handles.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});