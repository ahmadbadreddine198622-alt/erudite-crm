import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── Normalization ──────────────────────────────────────────────────────────
// Phone → E.164 (UAE default +971). Strip spaces/dashes/parens; preserve any
// explicit country code; treat a leading 0 as a local UAE trunk prefix.
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

// Parse every TEL and EMAIL line from a raw vCard / VCF blob.
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

// Collect every candidate handle from a landlord record across all known + ad-hoc
// phone/email fields, plus any stored vCard. Returns deduped [{handle,type,source_field}].
function collectHandles(L) {
  const phoneFields = [
    'phone', 'phone_2', 'phone2', 'mobile', 'mobile1', 'mobile2',
    'whatsapp', 'landline', 'tel', 'secondary_phone',
  ];
  const emailFields = [
    'email', 'email_2', 'email2', 'personal_email', 'work_email', 'secondary_email',
  ];
  const arrayPhoneFields = ['additional_phones'];
  const arrayEmailFields = ['additional_emails'];

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
  for (const f of arrayPhoneFields) {
    if (Array.isArray(L[f])) L[f].forEach((p) => add(normalizePhone(p), 'phone', f));
  }
  for (const f of arrayEmailFields) {
    if (Array.isArray(L[f])) L[f].forEach((e) => add(normalizeEmail(e), 'email', f));
  }

  // vCard / raw VCF (try a few likely field names).
  const vcfRaw = L.vcard || L.vcf || L.raw_vcard || L.contact_vcard || '';
  if (vcfRaw) {
    const parsed = parseVCard(vcfRaw);
    parsed.phones.forEach((p) => add(normalizePhone(p), 'phone', 'vcard'));
    parsed.emails.forEach((e) => add(normalizeEmail(e), 'email', 'vcard'));
  }

  return result;
}

// Check one handle against BlueBubbles. Returns 'available' | 'not_available' | 'error'.
async function checkHandle(serverUrl, password, handle) {
  try {
    const url = `${serverUrl}/api/v1/handle/availability/imessage?address=${encodeURIComponent(handle)}&password=${encodeURIComponent(password)}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'skip_zrok_interstitial': 'true' },
    });
    const raw = await resp.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = { raw }; }
    if (!resp.ok) return 'error';
    const d = data?.data ?? data;
    const available = d?.available === true || d?.available === 'true' || d === true;
    return available ? 'available' : 'not_available';
  } catch (_) {
    return 'error';
  }
}

// Pick the primary handle: first confirmed-available, phones before emails.
function pickPrimary(handles) {
  const availPhone = handles.find((h) => h.type === 'phone' && h.imessage_status === 'available');
  if (availPhone) return availPhone.handle;
  const availEmail = handles.find((h) => h.type === 'email' && h.imessage_status === 'available');
  if (availEmail) return availEmail.handle;
  return '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { landlord_id } = body;
    if (!landlord_id) return Response.json({ error: 'landlord_id is required' }, { status: 400 });

    const landlord = await base44.entities.Landlord.get(landlord_id).catch(() => null);
    if (!landlord) return Response.json({ error: 'Landlord not found' }, { status: 404 });

    const resolvedAt = new Date().toISOString();
    const candidates = collectHandles(landlord);

    // No contact data → mark unknown, never error.
    if (candidates.length === 0) {
      await base44.entities.Landlord.update(landlord_id, {
        imessage_handles: [],
        imessage_handle: '',
        imessage_status: 'unknown',
        imessage_checked_at: resolvedAt,
        imessage_resolved_at: resolvedAt,
      }).catch(() => {});
      return Response.json({ success: true, landlord_id, handles: [], imessage_handle: '', imessage_status: 'unknown', imessage_resolved_at: resolvedAt });
    }

    // Route to the correct BlueBubbles server by caller (Ahmad → primary, others → secondary).
    const AHMAD_EMAILS = new Set(['ahmad@erudite-estate.com', 'ahmad.badreddine198622@gmail.com']);
    const isAhmad = AHMAD_EMAILS.has(String(user.email || '').toLowerCase());
    const serverUrl = (Deno.env.get(isAhmad ? 'BLUEBUBBLES_SERVER_URL' : 'BB2_URL') || '').replace(/\/+$/, '');
    const password = Deno.env.get(isAhmad ? 'BLUEBUBBLES_PASSWORD' : 'BB2_PASSWORD') || '';

    // Relay not configured → record candidates as unknown rather than failing.
    if (!serverUrl || !password) {
      const handles = candidates.map((c) => ({ ...c, imessage_status: 'unknown' }));
      await base44.entities.Landlord.update(landlord_id, {
        imessage_handles: handles,
        imessage_handle: '',
        imessage_status: 'error',
        imessage_checked_at: resolvedAt,
        imessage_resolved_at: resolvedAt,
      }).catch(() => {});
      return Response.json({ error: 'BlueBubbles server is not configured', landlord_id, handles, imessage_status: 'error', imessage_resolved_at: resolvedAt }, { status: 500 });
    }

    // Check each candidate (sequential — keeps relay load gentle; handle counts are small).
    const handles = [];
    for (const c of candidates) {
      const status = await checkHandle(serverUrl, password, c.handle);
      handles.push({ ...c, imessage_status: status });
    }

    const primary = pickPrimary(handles);
    // Primary status mirrors the best handle; if any check errored and nothing is available,
    // surface 'error' (relay reachable but a check failed) else 'not_available'.
    let primaryStatus;
    if (primary) primaryStatus = 'available';
    else if (handles.some((h) => h.imessage_status === 'error')) primaryStatus = 'error';
    else primaryStatus = 'not_available';

    await base44.entities.Landlord.update(landlord_id, {
      imessage_handles: handles,
      imessage_handle: primary,
      imessage_status: primaryStatus,
      imessage_checked_at: resolvedAt,
      imessage_resolved_at: resolvedAt,
    }).catch(() => {});

    return Response.json({
      success: true,
      landlord_id,
      handles,
      imessage_handle: primary,
      imessage_status: primaryStatus,
      imessage_resolved_at: resolvedAt,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});