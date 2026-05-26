import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CACHE_TTL_YES = 30 * 24 * 60 * 60 * 1000;
const CACHE_TTL_NO = 7 * 24 * 60 * 60 * 1000;
const CACHE_TTL_UNKNOWN = 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { phones } = await req.json();
    if (!Array.isArray(phones)) return Response.json({ error: 'phones array required' }, { status: 400 });

    const normalized = [...new Set(phones.map(normalizeE164).filter(Boolean))].slice(0, 100);
    if (normalized.length === 0) return Response.json({ results: {} });

    // Fetch all cached in one query (filter by phone_e164 in list)
    const allCached = await base44.asServiceRole.entities.WhatsAppNumberCache.list('-checked_at', 500);
    const cacheMap = {};
    for (const entry of allCached) {
      cacheMap[entry.phone_e164] = entry;
    }

    const results = {};
    const toCheck = [];

    for (const e164 of normalized) {
      const entry = cacheMap[e164];
      if (entry) {
        const age = Date.now() - new Date(entry.checked_at).getTime();
        const ttl = entry.is_valid_whatsapp === true ? CACHE_TTL_YES
          : entry.is_valid_whatsapp === false ? CACHE_TTL_NO
          : CACHE_TTL_UNKNOWN;
        if (age < ttl) {
          results[e164] = entry.is_valid_whatsapp;
          continue;
        }
      }
      toCheck.push(e164);
    }

    // Batch API call for uncached
    if (toCheck.length > 0) {
      const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
      const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

      if (phoneNumberId && accessToken) {
        // Call in batches of 50
        for (let i = 0; i < toCheck.length; i += 50) {
          const batch = toCheck.slice(i, i + 50);
          try {
            const res = await fetch(
              `https://graph.facebook.com/v18.0/${phoneNumberId}/contacts`,
              {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ contacts: batch, blocking: 'wait' }),
              }
            );
            const data = await res.json();
            if (data.contacts) {
              for (const c of data.contacts) {
                const e164 = c.input;
                const isValid = c.status === 'valid';
                results[e164] = isValid;
                const checked_at = new Date().toISOString();
                if (cacheMap[e164]) {
                  await base44.asServiceRole.entities.WhatsAppNumberCache.update(cacheMap[e164].id, { is_valid_whatsapp: isValid, checked_at });
                } else {
                  await base44.asServiceRole.entities.WhatsAppNumberCache.create({ phone_e164: e164, is_valid_whatsapp: isValid, checked_at });
                }
              }
            }
          } catch (_) {
            for (const e164 of batch) results[e164] = null;
          }
        }
      } else {
        for (const e164 of toCheck) results[e164] = null;
      }
    }

    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function normalizeE164(raw) {
  if (!raw) return null;
  let p = raw.replace(/[\s\-().]/g, '');
  if (p.startsWith('+')) return p;
  if (p.startsWith('00')) p = '+' + p.slice(2);
  else if (p.startsWith('971')) p = '+' + p;
  else if (p.startsWith('0')) p = '+971' + p.slice(1);
  else if (p.startsWith('5') && p.length === 9) p = '+971' + p;
  else p = '+971' + p;
  return p.length >= 10 ? p : null;
}