import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * Standalone WhatsApp presence check for a single phone number.
 *
 * Uses the Evolution API `/chat/whatsappNumbers/{instance}` endpoint (the live
 * messaging line) instead of the Meta Graph `contacts` endpoint, which returns
 * a 400 for the configured phone-number-ID and silently marks every number
 * invalid. Caches results in WhatsAppNumberCache with a `check_source` field
 * so stale `graph_api` entries get re-checked and corrected.
 *
 * Input:  { phone: string }
 * Output: { is_valid_whatsapp: boolean | null, checked_at: string, cached?: boolean }
 */

const CACHE_TTL_YES = 30 * 24 * 60 * 60 * 1000; // 30 days
const CACHE_TTL_NO = 7 * 24 * 60 * 60 * 1000;    // 7 days
const CACHE_TTL_UNKNOWN = 24 * 60 * 60 * 1000;  // 1 day

// Module-level cache of a working instance name so we don't re-discover on every call.
let workingInstance: string | null = null;

function ttlExpiry(isValid: boolean | null): string {
  const days = isValid === true ? 30 : isValid === false ? 7 : 1;
  return new Date(Date.now() + days * 86400000).toISOString();
}

async function discoverOpenInstance(apiUrl: string, apiKey: string): Promise<string | null> {
  try {
    const r = await fetch(`${apiUrl.replace(/\/$/, '')}/instance/fetchInstances`, {
      headers: { apikey: apiKey },
    });
    const list = await r.json();
    if (!Array.isArray(list)) return null;
    const open = list.find((i: any) => i && (i.connectionStatus === 'open' || i.status === 'open') && (i.ownerJid || i.owner));
    if (open) return String(open.name || '').trim() || null;
    return null;
  } catch { return null; }
}

async function evolutionCheck(numbers: string[], apiUrl: string, apiKey: string): Promise<Map<string, boolean> | null> {
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
      if (r.status === 404 || j?.status === 404) { tryInstances.push(''); continue; }
      if (!Array.isArray(j)) return null;
      const out = new Map<string, boolean>();
      for (const item of j) {
        if (item && typeof item.number === 'string') {
          out.set(String(item.number).replace(/\D/g, ''), !!item.exists);
        }
      }
      workingInstance = inst;
      return out;
    } catch { return null; }
  }
  return null;
}

function normalizeE164(raw: string): string | null {
  if (!raw) return null;
  let p = String(raw).replace(/[\s\-().]/g, '');
  if (p.startsWith('+')) { /* keep */ }
  else if (p.startsWith('00')) p = '+' + p.slice(2);
  else if (p.startsWith('971')) p = '+' + p;
  else if (p.startsWith('0')) p = '+971' + p.slice(1);
  else if (p.startsWith('5') && p.length === 9) p = '+971' + p;
  else p = '+' + p;
  return p.length >= 10 ? p : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { phone } = await req.json();
    if (!phone) return Response.json({ error: 'phone required' }, { status: 400 });

    const e164 = normalizeE164(phone);
    if (!e164) return Response.json({ is_valid_whatsapp: null, error: 'invalid phone' });

    const svc = base44.asServiceRole;

    // Check cache — treat stale `graph_api` entries as expired so they get re-checked.
    const cached = await svc.entities.WhatsAppNumberCache.filter({ phone_e164: e164 });
    const entry = cached && cached[0];
    const now = Date.now();
    if (entry) {
      const fresh = entry.expires_at && new Date(entry.expires_at).getTime() > now;
      const trustworthy = entry.check_source !== 'graph_api';
      if (fresh && trustworthy) {
        return Response.json({ is_valid_whatsapp: entry.is_valid_whatsapp, checked_at: entry.checked_at, cached: true });
      }
    }

    const apiUrl = Deno.env.get('EVOLUTION_API_URL');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY');
    let is_valid_whatsapp: boolean | null = null;
    let checkSource = 'evolution';

    if (apiUrl && apiKey) {
      const evoMap = await evolutionCheck([e164.replace(/^\+/, '')], apiUrl, apiKey);
      if (evoMap) {
        is_valid_whatsapp = !!evoMap.get(e164.replace(/^\+/, ''));
      } else {
        // Evolution unreachable — unknown.
        checkSource = 'unknown';
      }
    } else {
      checkSource = 'unknown';
    }

    const checked_at = new Date().toISOString();
    const cachePayload: any = {
      phone_e164: e164,
      is_valid_whatsapp,
      checked_at,
      expires_at: ttlExpiry(is_valid_whatsapp),
      check_source: checkSource,
    };

    try {
      if (entry) await svc.entities.WhatsAppNumberCache.update(entry.id, cachePayload);
      else await svc.entities.WhatsAppNumberCache.create(cachePayload);
    } catch { /* best-effort cache */ }

    return Response.json({ is_valid_whatsapp, checked_at });
  } catch (error) {
    return Response.json({ is_valid_whatsapp: null, error: error.message });
  }
});