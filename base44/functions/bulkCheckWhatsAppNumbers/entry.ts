import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Bulk-verify many phones against the WhatsApp Graph API in one round trip.
 * Used by list pages (Leads, Contacts, etc.) to prime the cache so per-row
 * WhatsAppPhone components render instantly with no flicker.
 *
 * Input:  { phones: string[] }            // up to 100 phones (raw, will be normalized)
 * Output: { results: { [e164]: { is_valid_whatsapp, checked_at, country_code, spam_score } } }
 */

const PREFIX_MAP: Record<string, string> = {
  "971": "AE", "966": "SA", "974": "QA", "973": "BH", "965": "KW",
  "968": "OM", "962": "JO", "961": "LB", "20": "EG", "44": "GB",
  "1": "US", "33": "FR", "49": "DE", "39": "IT", "34": "ES",
  "7": "RU", "86": "CN", "91": "IN", "92": "PK", "63": "PH",
  "90": "TR", "98": "IR"
};

// How long an answer stays fresh based on its outcome.
const TTL_DAYS = {
  yes: 30,
  no: 7,
  unknown: 1
};

function normalize(raw: string): string | null {
  if (!raw) return null;
  let cleaned = String(raw).replace(/[^\d+]/g, '');
  if (!cleaned) return null;
  // Already E.164
  if (cleaned.startsWith('+')) return cleaned;
  // UAE local 05x → +9715x
  if (cleaned.startsWith('05') && cleaned.length === 10) return '+971' + cleaned.slice(1);
  if (cleaned.startsWith('5') && cleaned.length === 9) return '+971' + cleaned;
  if (cleaned.startsWith('00')) return '+' + cleaned.slice(2);
  // Long enough to be a country code + number
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { phones } = await req.json();
    if (!Array.isArray(phones) || phones.length === 0) {
      return Response.json({ error: 'phones array required' }, { status: 400 });
    }
    if (phones.length > 100) {
      return Response.json({ error: 'max 100 phones per request' }, { status: 400 });
    }

    // 1. Normalize + dedupe
    const normalized = Array.from(new Set(phones.map(normalize).filter(Boolean) as string[]));

    // 2. Read cache for all normalized phones in one query
    const now = new Date().toISOString();
    let cached: any[] = [];
    try {
      cached = await base44.entities.WhatsAppNumberCache.filter({ phone_e164: { $in: normalized } });
    } catch (_) {
      cached = [];
    }

    const cacheMap = new Map<string, any>(cached.map(c => [c.phone_e164, c]));
    const results: Record<string, any> = {};
    const toFetch: string[] = [];

    for (const phone of normalized) {
      const entry = cacheMap.get(phone);
      if (entry && entry.expires_at && entry.expires_at > now) {
        results[phone] = {
          is_valid_whatsapp: entry.is_valid_whatsapp,
          country_code: entry.country_code,
          spam_score: entry.spam_score || 0,
          carrier: entry.carrier,
          wa_display_name: entry.wa_display_name,
          checked_at: entry.checked_at,
          cached: true
        };
      } else {
        toFetch.push(phone);
      }
    }

    // 3. Batch-fetch the uncached ones against the WhatsApp Graph API
    if (toFetch.length > 0) {
      const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
      const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

      let waValidSet = new Set<string>();
      let waApiAvailable = !!(phoneNumberId && accessToken);

      if (waApiAvailable) {
        try {
          const waCheck = await fetch(
            `https://graph.facebook.com/v18.0/${phoneNumberId}/contacts`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                blocking: 'wait',
                contacts: toFetch,
                force_check: true
              })
            }
          ).then(r => r.json());

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

      // 4. Persist each result to cache and add to response
      await Promise.all(toFetch.map(async (phone) => {
        const country = inferCountry(phone);
        const isValid = waApiAvailable
          ? waValidSet.has(phone)
          : heuristicHasWhatsApp(phone, country);
        const expires = ttlExpiry(isValid);
        const checked = new Date().toISOString();

        const payload = {
          phone_e164: phone,
          is_valid_whatsapp: isValid,
          checked_at: checked,
          expires_at: expires,
          country_code: country,
          spam_score: 0,
          check_source: waApiAvailable ? 'graph_api' : 'heuristic'
        };

        try {
          const existing = cacheMap.get(phone);
          if (existing) {
            await base44.entities.WhatsAppNumberCache.update(existing.id, payload);
          } else {
            await base44.entities.WhatsAppNumberCache.create(payload);
          }
        } catch (err) {
          console.error('Cache write failed for', phone, err);
        }

        results[phone] = {
          is_valid_whatsapp: isValid,
          country_code: country,
          spam_score: 0,
          checked_at: checked,
          cached: false
        };
      }));
    }

    return Response.json({ results });
  } catch (error: any) {
    console.error('bulkCheckWhatsAppNumbers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Fallback when Graph API is not configured. In GCC + most markets, mobile
 * numbers from these prefixes have ~95% WhatsApp adoption. Returns true if
 * the number looks like a mobile from a high-adoption country.
 */
function heuristicHasWhatsApp(e164: string, country: string | null): boolean {
  if (!country) return false;
  const HIGH_ADOPTION = new Set([
    'AE', 'SA', 'QA', 'BH', 'KW', 'OM', 'EG', 'JO', 'LB',
    'GB', 'IN', 'PK', 'PH', 'TR', 'BR', 'MX', 'IT', 'ES',
    'NL', 'DE', 'FR', 'RU', 'ID', 'MY', 'TH', 'ZA', 'NG'
  ]);
  if (!HIGH_ADOPTION.has(country)) return false;
  // Filter obvious landlines for UAE (02, 03, 04, 06, 07, 09)
  if (country === 'AE') {
    const local = e164.replace(/^\+971/, '');
    if (local.length === 8 && !local.startsWith('5')) return false;
  }
  return true;
}
