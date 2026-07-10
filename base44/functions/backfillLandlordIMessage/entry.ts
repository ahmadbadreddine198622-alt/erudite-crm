import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Bulk-resolve iMessage handles for existing landlords that have not been resolved yet
// (imessage_resolved_at is null), or — with { force:true } — re-resolve everyone.
// Admin-gated. Processes in batches; returns has_more so a scheduled/manual drain can loop.
// Inlines the same resolution logic as resolveLandlordIMessage (no cross-function imports).
//
// Call with: { "batch_size": 25, "force": false }
// Returns: { processed, available_count, has_more, remaining }

const BATCH_SIZE_DEFAULT = 25;

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    let body = {};
    try { body = await req.json(); } catch (_) {}
    const batchSize = body.batch_size || BATCH_SIZE_DEFAULT;
    const force = body.force === true;

    const serverUrl = (Deno.env.get('BLUEBUBBLES_SERVER_URL') || '').replace(/\/+$/, '');
    const password = Deno.env.get('BLUEBUBBLES_PASSWORD') || '';
    if (!serverUrl || !password) {
      return Response.json({ error: 'BlueBubbles server is not configured' }, { status: 500 });
    }

    const all = await svc.entities.Landlord.list('-created_date', 5000);
    const pending = (all || []).filter((l) => force || !l.imessage_resolved_at);
    const batch = pending.slice(0, batchSize);

    if (batch.length === 0) {
      return Response.json({ status: 'complete', processed: 0, available_count: 0, has_more: false, remaining: 0, message: 'No landlords pending iMessage resolution' });
    }

    let processed = 0, availableCount = 0;
    const failures = [];
    const resolvedAt = new Date().toISOString();

    for (const L of batch) {
      try {
        const candidates = collectHandles(L);
        if (candidates.length === 0) {
          await svc.entities.Landlord.update(L.id, {
            imessage_handles: [], imessage_handle: '', imessage_status: 'unknown',
            imessage_checked_at: resolvedAt, imessage_resolved_at: resolvedAt,
          });
          processed++;
          continue;
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
        if (primary) availableCount++;
        await svc.entities.Landlord.update(L.id, {
          imessage_handles: handles, imessage_handle: primary, imessage_status: primaryStatus,
          imessage_checked_at: resolvedAt, imessage_resolved_at: resolvedAt,
        });
        processed++;
      } catch (err) {
        failures.push({ landlord_id: L.id, error: err.message || String(err) });
      }
    }

    const remaining = Math.max(0, pending.length - processed);
    return Response.json({
      status: 'in_progress',
      processed,
      available_count: availableCount,
      failures: failures.slice(0, 20),
      has_more: remaining > 0,
      remaining,
      summary: `Resolved iMessage for ${processed}/${batch.length} landlords (${availableCount} have an iMessage handle). ${remaining} remaining.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});