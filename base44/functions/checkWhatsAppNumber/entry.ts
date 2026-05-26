import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CACHE_TTL_YES = 30 * 24 * 60 * 60 * 1000; // 30 days
const CACHE_TTL_NO = 7 * 24 * 60 * 60 * 1000;   // 7 days
const CACHE_TTL_UNKNOWN = 24 * 60 * 60 * 1000;   // 1 day

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { phone } = await req.json();
    if (!phone) return Response.json({ error: 'phone required' }, { status: 400 });

    // Normalize to E.164
    const e164 = normalizeE164(phone);
    if (!e164) return Response.json({ is_valid_whatsapp: null, error: 'invalid phone' });

    // Check cache
    const cached = await base44.asServiceRole.entities.WhatsAppNumberCache.filter({ phone_e164: e164 });
    if (cached.length > 0) {
      const entry = cached[0];
      const age = Date.now() - new Date(entry.checked_at).getTime();
      const ttl = entry.is_valid_whatsapp === true ? CACHE_TTL_YES
        : entry.is_valid_whatsapp === false ? CACHE_TTL_NO
        : CACHE_TTL_UNKNOWN;
      if (age < ttl) {
        return Response.json({ is_valid_whatsapp: entry.is_valid_whatsapp, checked_at: entry.checked_at, cached: true });
      }
    }

    // Call WhatsApp Business API
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    let is_valid_whatsapp = null;

    if (phoneNumberId && accessToken) {
      try {
        const res = await fetch(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/contacts`,
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacts: [e164], blocking: 'wait' }),
          }
        );
        const data = await res.json();
        if (data.contacts?.length > 0) {
          is_valid_whatsapp = data.contacts[0].status === 'valid';
        }
      } catch (_) {
        // API error — return unknown
      }
    }

    const checked_at = new Date().toISOString();

    // Upsert cache
    if (cached.length > 0) {
      await base44.asServiceRole.entities.WhatsAppNumberCache.update(cached[0].id, { is_valid_whatsapp, checked_at });
    } else {
      await base44.asServiceRole.entities.WhatsAppNumberCache.create({ phone_e164: e164, is_valid_whatsapp, checked_at });
    }

    return Response.json({ is_valid_whatsapp, checked_at });
  } catch (error) {
    return Response.json({ is_valid_whatsapp: null, error: error.message });
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