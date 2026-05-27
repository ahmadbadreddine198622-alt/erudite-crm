import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Verify a single phone against the WhatsApp Graph API, with persistent caching
 * via the WhatsAppNumberCache entity.
 *
 * Cache TTLs:
 *   - valid WhatsApp number → 30 days
 *   - not on WhatsApp        → 7 days
 *   - unknown / API failure  → 1 day
 *
 * Input:  { phone_e164: string, force?: boolean }
 * Output: { is_valid_whatsapp, country_code, carrier, phone_type, spam_score, caller_name, cached }
 */

const PREFIX_MAP: Record<string, string> = {
  "971": "AE", "966": "SA", "974": "QA", "973": "BH", "965": "KW",
  "968": "OM", "962": "JO", "961": "LB", "20": "EG", "44": "GB",
  "1": "US", "33": "FR", "49": "DE", "39": "IT", "34": "ES",
  "7": "RU", "86": "CN", "91": "IN", "92": "PK", "63": "PH",
  "90": "TR", "98": "IR"
};

const TTL_DAYS = { yes: 30, no: 7, unknown: 1 };

function inferCountry(e164: string): string | null {
  const num = e164.replace(/^\+/, '');
  for (const len of [3, 2, 1]) {
    if (PREFIX_MAP[num.slice(0, len)]) return PREFIX_MAP[num.slice(0, len)];
  }
  return null;
}

function computeSpamScore(lookup: any): number {
  let s = 0;
  if (lookup?.line_type_intelligence?.type === 'voip') s += 40;
  if (lookup?.line_type_intelligence?.type === 'tollFree') s += 30;
  if (!lookup?.caller_name?.caller_name) s += 10;
  return Math.min(100, s);
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

    const { phone_e164, force = false } = await req.json();
    if (!phone_e164) return Response.json({ error: 'phone_e164 required' }, { status: 400 });

    // 1. Cache lookup
    if (!force) {
      try {
        const cached = await base44.entities.WhatsAppNumberCache.filter({ phone_e164 });
        const entry = cached?.[0];
        if (entry && entry.expires_at && entry.expires_at > new Date().toISOString()) {
          return Response.json({
            is_valid_whatsapp: entry.is_valid_whatsapp,
            country_code: entry.country_code,
            carrier: entry.carrier || null,
            phone_type: entry.phone_type || 'unknown',
            spam_score: entry.spam_score || 0,
            caller_name: entry.caller_name || null,
            wa_display_name: entry.wa_display_name || null,
            wa_profile_pic_url: entry.wa_profile_pic_url || null,
            cached: true
          });
        }
      } catch (_) {
        // cache read failed — proceed to live check
      }
    }

    const country = inferCountry(phone_e164);

    // 2. WhatsApp Graph API contacts check
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

    let isValid: boolean | null = null;
    if (phoneNumberId && accessToken) {
      try {
        const waCheck = await fetch(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/contacts`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ blocking: 'wait', contacts: [phone_e164], force_check: true })
          }
        ).then(r => r.json());
        isValid = waCheck?.contacts?.[0]?.status === 'valid';
      } catch (err) {
        console.error('Graph check failed:', err);
      }
    }

    // 3. Optional Twilio Lookup for carrier/spam metadata
    const twilioSid = Deno.env.get('TWILIO_SID');
    const twilioToken = Deno.env.get('TWILIO_TOKEN');
    let carrier: string | null = null;
    let phoneType = 'unknown';
    let spamScore = 0;
    let callerName: string | null = null;

    if (twilioSid && twilioToken) {
      try {
        const lookup = await fetch(
          `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone_e164)}?Fields=line_type_intelligence,caller_name`,
          { headers: { Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}` } }
        ).then(r => r.json());

        carrier = lookup?.line_type_intelligence?.carrier_name || null;
        phoneType = lookup?.line_type_intelligence?.type || 'unknown';
        spamScore = computeSpamScore(lookup);
        callerName = lookup?.caller_name?.caller_name || null;
      } catch (_) {
        // Twilio unavailable — continue with WA result only
      }
    }

    const result = {
      is_valid_whatsapp: isValid,
      country_code: country,
      carrier,
      phone_type: phoneType,
      spam_score: spamScore,
      caller_name: callerName
    };

    // 4. Persist to cache
    try {
      const existing = await base44.entities.WhatsAppNumberCache.filter({ phone_e164 });
      const payload = {
        phone_e164,
        is_valid_whatsapp: isValid,
        checked_at: new Date().toISOString(),
        expires_at: ttlExpiry(isValid),
        country_code: country,
        carrier,
        phone_type: phoneType,
        spam_score: spamScore,
        caller_name: callerName,
        check_source: phoneNumberId && accessToken ? 'graph_api' : 'heuristic'
      };
      if (existing?.[0]) {
        await base44.entities.WhatsAppNumberCache.update(existing[0].id, payload);
      } else {
        await base44.entities.WhatsAppNumberCache.create(payload);
      }
    } catch (err) {
      console.error('Cache write failed:', err);
    }

    return Response.json({ ...result, cached: false });
  } catch (error: any) {
    console.error('verifyWhatsAppNumber error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
