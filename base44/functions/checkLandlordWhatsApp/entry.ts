import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Checks every phone number on a Landlord (primary phone, whatsapp, additional_phones)
 * against the WhatsApp Graph API and persists the result on the Landlord record.
 *
 * Mirrors resolveLandlordIMessage. Caches each number in the WhatsAppNumberCache entity
 * (reusing the same TTL strategy as bulkCheckWhatsAppNumbers) so repeat checks are free.
 *
 * Input:  { landlord_id: string }
 * Output:  { whatsapp_status, whatsapp_handles, whatsapp_handle, whatsapp_checked_at, whatsapp_resolved_at }
 */

const PREFIX_MAP: Record<string, string> = {
  "971": "AE", "966": "SA", "974": "QA", "973": "BH", "965": "KW",
  "968": "OM", "962": "JO", "961": "LB", "20": "EG", "44": "GB",
  "1": "US", "33": "FR", "49": "DE", "39": "IT", "34": "ES",
  "7": "RU", "86": "CN", "91": "IN", "92": "PK", "63": "PH",
  "90": "TR", "98": "IR"
};

const TTL_DAYS = { yes: 30, no: 7, unknown: 1 };

function normalize(raw: string): string | null {
  if (!raw) return null;
  let cleaned = String(raw).replace(/[^\d+]/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('05') && cleaned.length === 10) return '+971' + cleaned.slice(1);
  if (cleaned.startsWith('5') && cleaned.length === 9) return '+971' + cleaned;
  if (cleaned.startsWith('00')) return '+' + cleaned.slice(2);
  if (cleaned.length >= 10) return '+' + cleaned;
  return null;
}

function inferCountry(e164: string): string | null {
  const num = e164.replace(/^\+/, '');
  for (const len of [3, 2, 1]) {
    if (PREFIX_MAP[num.slice(0, len)]) return PREFIX_MAP[num.slice(0, len)];
  }
  return null;
}

function ttlExpiry(isValid: boolean | null): string {
  const days = isValid === true ? TTL_DAYS.yes : isValid === false ? TTL_DAYS.no : TTL_DAYS.unknown;
  return new Date(Date.now() + days * 86400000).toISOString();
}

function heuristicHasWhatsApp(e164: string, country: string | null): boolean {
  if (!country) return false;
  const HIGH_ADOPTION = new Set([
    'AE', 'SA', 'QA', 'BH', 'KW', 'OM', 'EG', 'JO', 'LB',
    'GB', 'IN', 'PK', 'PH', 'TR', 'BR', 'MX', 'IT', 'ES',
    'NL', 'DE', 'FR', 'RU', 'ID', 'MY', 'TH', 'ZA', 'NG'
  ]);
  if (!HIGH_ADOPTION.has(country)) return false;
  if (country === 'AE') {
    const local = e164.replace(/^\+971/, '');
    if (local.length === 8 && !local.startsWith('5')) return false;
  }
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { landlord_id } = await req.json();
    if (!landlord_id) return Response.json({ error: 'landlord_id required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const llList = await svc.entities.Landlord.filter({ id: landlord_id });
    const landlord = llList && llList[0];
    if (!landlord) return Response.json({ error: 'Landlord not found' }, { status: 404 });

    // Collect every phone candidate with its source field (dedupe by normalized E.164).
    const candidates: { raw: string; source: string }[] = [];
    if (landlord.phone) candidates.push({ raw: landlord.phone, source: 'phone' });
    if (landlord.whatsapp && landlord.whatsapp !== landlord.phone) candidates.push({ raw: landlord.whatsapp, source: 'whatsapp' });
    if (Array.isArray(landlord.additional_phones)) {
      for (const p of landlord.additional_phones) {
        if (p && p !== landlord.phone) candidates.push({ raw: p, source: 'additional_phones' });
      }
    }
    // Normalize + dedupe (keep first source for each E.164)
    const byE164 = new Map<string, string>();
    const ordered: string[] = [];
    for (const c of candidates) {
      const e164 = normalize(c.raw);
      if (!e164) continue;
      if (!byE164.has(e164)) { byE164.set(e164, c.source); ordered.push(e164); }
    }
    if (ordered.length === 0) {
      const checkedAt = new Date().toISOString();
      const payload = {
        whatsapp_status: 'unknown' as string,
        whatsapp_handles: [],
        whatsapp_handle: '',
        whatsapp_checked_at: checkedAt,
        whatsapp_resolved_at: checkedAt,
      };
      await svc.entities.Landlord.update(landlord_id, payload);
      return Response.json(payload);
    }

    // Read cache for all numbers in one query.
    const now = new Date().toISOString();
    let cached: any[] = [];
    try {
      cached = await svc.entities.WhatsAppNumberCache.filter({ phone_e164: { $in: ordered } });
    } catch (_) { cached = []; }
    const cacheMap = new Map<string, any>(cached.map((c) => [c.phone_e164, c]));
    const toFetch: string[] = [];
    for (const e164 of ordered) {
      const entry = cacheMap.get(e164);
      if (entry && entry.expires_at && entry.expires_at > now) continue;
      toFetch.push(e164);
    }

    // Batch-fetch uncached against the WhatsApp Graph API.
    let waValidSet = new Set<string>();
    let waApiAvailable = false;
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    if (toFetch.length > 0 && phoneNumberId && accessToken) {
      waApiAvailable = true;
      try {
        const waCheck = await fetch(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/contacts`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ blocking: 'wait', contacts: toFetch, force_check: true }),
          }
        ).then((r) => r.json());
        if (Array.isArray(waCheck?.contacts)) {
          for (const c of waCheck.contacts) {
            if (c.status === 'valid') waValidSet.add(c.input);
          }
        }
      } catch (err) {
        console.error('Graph contacts check failed:', err);
        waApiAvailable = false;
      }
    }

    // Persist each uncached result + build the handles list.
    const handles: any[] = [];
    for (const e164 of ordered) {
      const source = byE164.get(e164)!;
      const entry = cacheMap.get(e164);
      let isValid: boolean;
      let checkedAt: string;
      if (entry && entry.expires_at && entry.expires_at > now) {
        isValid = !!entry.is_valid_whatsapp;
        checkedAt = entry.checked_at;
      } else {
        const country = inferCountry(e164);
        isValid = waApiAvailable ? waValidSet.has(e164) : heuristicHasWhatsApp(e164, country);
        checkedAt = new Date().toISOString();
        const cachePayload = {
          phone_e164: e164,
          is_valid_whatsapp: isValid,
          checked_at: checkedAt,
          expires_at: ttlExpiry(isValid),
          country_code: country,
          spam_score: 0,
          check_source: waApiAvailable ? 'graph_api' : 'heuristic',
        };
        try {
          if (entry) await svc.entities.WhatsAppNumberCache.update(entry.id, cachePayload);
          else await svc.entities.WhatsAppNumberCache.create(cachePayload);
        } catch (err) { console.error('Cache write failed for', e164, err); }
      }
      handles.push({ handle: e164, source_field: source, is_valid_whatsapp: isValid });
    }

    const validHandles = handles.filter((h) => h.is_valid_whatsapp);
    // Primary WhatsApp number: prefer the one sourced from the primary `phone` field when valid,
    // otherwise the first valid handle, otherwise ''.
    let primaryHandle = '';
    const phoneSourced = validHandles.find((h) => h.source_field === 'phone');
    if (phoneSourced) primaryHandle = phoneSourced.handle;
    else if (validHandles[0]) primaryHandle = validHandles[0].handle;

    let status: string;
    if (!waApiAvailable && toFetch.length > 0) status = 'error';
    else if (validHandles.length > 0) status = 'available';
    else status = 'not_available';

    const resolvedAt = new Date().toISOString();
    const payload = {
      whatsapp_status: status,
      whatsapp_handles: handles,
      whatsapp_handle: primaryHandle,
      whatsapp_checked_at: resolvedAt,
      whatsapp_resolved_at: resolvedAt,
    };
    await svc.entities.Landlord.update(landlord_id, payload);
    return Response.json(payload);
  } catch (error: any) {
    console.error('checkLandlordWhatsApp error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});