import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * Checks every phone number on a Landlord (primary phone, whatsapp, additional_phones)
 * against the Evolution API (the live WhatsApp messaging line) and persists the
 * result on the Landlord record.
 *
 * The Meta Graph `contacts` endpoint that this previously used returns a 400 for the
 * configured phone-number-ID, which silently marked EVERY number invalid — so every
 * landlord card showed "0 of N on WhatsApp" even for confirmed-WhatsApp numbers.
 * Evolution's `/chat/whatsappNumbers/{instance}` endpoint is the authoritative presence
 * check (same line used to send messages) and is used here instead.
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

// ── Evolution presence check ──────────────────────────────────────────────────
// Module-level cache of a working instance name so we don't re-discover on every call.
let workingInstance: string | null = null;

async function discoverOpenInstance(apiUrl: string, apiKey: string): Promise<string | null> {
  try {
    const r = await fetch(`${apiUrl.replace(/\/$/, '')}/instance/fetchInstances`, {
      headers: { apikey: apiKey },
    });
    const list = await r.json();
    if (!Array.isArray(list)) return null;
    // Prefer a connected (open) instance with a real WhatsApp owner — that's a live line.
    // Evolution's raw instance shape uses `connectionStatus` + `ownerJid`.
    const open = list.find((i: any) => i && (i.connectionStatus === 'open' || i.status === 'open') && (i.ownerJid || i.owner));
    if (open) return String(open.name || '').trim() || null;
    return null;
  } catch (e) { console.error('[wa-discover] err', e); return null; }
}

async function evolutionCheck(numbers: string[], apiUrl: string, apiKey: string): Promise<Map<string, boolean> | null> {
  // numbers: plain digits (no '+'). Returns Map<digits, exists> or null if the check was unreachable.
  if (!numbers.length) return new Map();
  const instance = (workingInstance || Deno.env.get('EVOLUTION_INSTANCE') || '').trim();
  const tryInstances: string[] = [];
  if (instance) tryInstances.push(instance);

  for (let attempt = 0; attempt < 2; attempt++) {
    let inst = tryInstances[attempt];
    if (attempt === 1) {
      const discovered = await discoverOpenInstance(apiUrl, apiKey);
      if (!discovered) return null;
      inst = discovered;
    }
    if (!inst) continue;
    try {
      const r = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/whatsappNumbers/${encodeURIComponent(inst)}`, {
        method: 'POST',
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ numbers }),
      });
      const j: any = await r.json();
      // 404 = instance gone → fall through to discovery on the next attempt.
      if (r.status === 404 || j?.status === 404) { tryInstances.push(''); continue; }
      if (!Array.isArray(j)) {
        // Whole-call failure — caller falls back to heuristic.
        return null;
      }
      const out = new Map<string, boolean>();
      for (const item of j) {
        if (item && typeof item.number === 'string') {
          out.set(String(item.number).replace(/\D/g, ''), !!item.exists);
        }
      }
      workingInstance = inst;
      return out;
    } catch {
      return null;
    }
  }
  return null;
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

    const now = new Date().toISOString();
    let cached: any[] = [];
    try {
      cached = await svc.entities.WhatsAppNumberCache.filter({ phone_e164: { $in: ordered } });
    } catch (_) { cached = []; }
    const cacheMap = new Map<string, any>(cached.map((c) => [c.phone_e164, c]));

    // A cached entry is reusable only if it's fresh AND was produced by the Evolution
    // check. Entries written by the old broken Graph-API path (check_source === 'graph_api')
    // are treated as expired so they get re-checked and corrected.
    const toFetch: string[] = [];
    for (const e164 of ordered) {
      const entry = cacheMap.get(e164);
      const fresh = entry && entry.expires_at && entry.expires_at > now;
      const trustworthy = entry && entry.check_source !== 'graph_api';
      if (fresh && trustworthy) continue;
      toFetch.push(e164);
    }

    const apiUrl = Deno.env.get('EVOLUTION_API_URL');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY');
    let evoMap: Map<string, boolean> | null = null;
    let evolutionReached = false;
    if (toFetch.length > 0 && apiUrl && apiKey) {
      evoMap = await evolutionCheck(toFetch.map((e) => e.replace(/^\+/, '')), apiUrl, apiKey);
      evolutionReached = !!evoMap;
    }

    const handles: any[] = [];
    for (const e164 of ordered) {
      const source = byE164.get(e164)!;
      const entry = cacheMap.get(e164);
      const fresh = entry && entry.expires_at && entry.expires_at > now;
      const trustworthy = entry && entry.check_source !== 'graph_api';
      let isValid: boolean;
      let checkedAt: string;
      let checkSource: string;
      if (fresh && trustworthy) {
        isValid = !!entry.is_valid_whatsapp;
        checkedAt = entry.checked_at;
        checkSource = entry.check_source;
      } else {
        if (evolutionReached && evoMap) {
          isValid = !!evoMap.get(e164.replace(/^\+/, ''));
          checkSource = 'evolution';
        } else {
          // Evolution unreachable — fall back to the country heuristic so we don't
          // false-negative a valid number. Mark the row so the caller can surface 'error'.
          isValid = heuristicHasWhatsApp(e164, inferCountry(e164));
          checkSource = 'heuristic';
        }
        checkedAt = new Date().toISOString();
        const cachePayload = {
          phone_e164: e164,
          is_valid_whatsapp: isValid,
          checked_at: checkedAt,
          expires_at: ttlExpiry(isValid),
          country_code: inferCountry(e164),
          spam_score: 0,
          check_source: checkSource,
        };
        try {
          if (entry) await svc.entities.WhatsAppNumberCache.update(entry.id, cachePayload);
          else await svc.entities.WhatsAppNumberCache.create(cachePayload);
        } catch (err) { console.error('Cache write failed for', e164, err); }
      }
      handles.push({ handle: e164, source_field: source, is_valid_whatsapp: isValid });
    }

    const validHandles = handles.filter((h) => h.is_valid_whatsapp);
    let primaryHandle = '';
    const phoneSourced = validHandles.find((h) => h.source_field === 'phone');
    if (phoneSourced) primaryHandle = phoneSourced.handle;
    else if (validHandles[0]) primaryHandle = validHandles[0].handle;

    let status: string;
    if (toFetch.length > 0 && !evolutionReached) status = 'error';
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