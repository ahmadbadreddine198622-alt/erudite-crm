import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { normalizePhone } from '@/lib/phone';

/**
 * useHasWhatsApp(phoneRaw)
 *
 * Returns { status: "loading" | "yes" | "no" | "unknown", e164, refresh }.
 *
 * Behavior:
 *   - Normalizes the phone to E.164 on the client.
 *   - Module-level cache so the same number resolved on one page stays resolved
 *     forever during this session.
 *   - In-flight Promise dedupe — 50 list rows mounting with the same phone fire
 *     ONE request, not 50.
 *   - Falls back to "unknown" on errors so the UI can still render the number.
 *
 * To pre-populate the cache for a whole list (e.g. on Leads page mount):
 *   import { primeWhatsAppCache } from "@/hooks/useHasWhatsApp";
 *   primeWhatsAppCache(allPhones);
 */

const cache = new Map(); // phoneE164 -> "yes" | "no" | "unknown"
const inflight = new Map(); // phoneE164 -> Promise<status>
const subscribers = new Map(); // phoneE164 -> Set<setter>

function statusFromResult(r) {
  if (r?.is_valid_whatsapp === true) return 'yes';
  if (r?.is_valid_whatsapp === false) return 'no';
  return 'unknown';
}

function notify(e164, status) {
  cache.set(e164, status);
  const subs = subscribers.get(e164);
  if (subs) for (const s of subs) s(status);
}

async function checkOne(e164) {
  if (cache.has(e164)) return cache.get(e164);
  if (inflight.has(e164)) return inflight.get(e164);

  const p = (async () => {
    try {
      const res = await base44.functions.verifyWhatsAppNumber({ phone_e164: e164 });
      const status = statusFromResult(res?.data ?? res);
      notify(e164, status);
      return status;
    } catch (err) {
      console.warn('verifyWhatsAppNumber failed', e164, err);
      notify(e164, 'unknown');
      return 'unknown';
    } finally {
      inflight.delete(e164);
    }
  })();

  inflight.set(e164, p);
  return p;
}

/**
 * Bulk-prime the cache. Call from list-page mount with all visible phones —
 * one round-trip primes everything so per-row hooks render instantly.
 */
export async function primeWhatsAppCache(rawPhones) {
  if (!Array.isArray(rawPhones) || rawPhones.length === 0) return;
  const e164s = Array.from(
    new Set(rawPhones.map(p => normalizePhone(p)).filter(p => p && !cache.has(p)))
  );
  if (e164s.length === 0) return;

  // Chunk to 100/request (the function caps at 100).
  const chunks = [];
  for (let i = 0; i < e164s.length; i += 100) chunks.push(e164s.slice(i, i + 100));

  await Promise.all(chunks.map(async (chunk) => {
    try {
      const res = await base44.functions.bulkCheckWhatsAppNumbers({ phones: chunk });
      const results = res?.data?.results ?? res?.results ?? {};
      for (const phone of chunk) {
        const status = statusFromResult(results[phone]);
        notify(phone, status);
      }
    } catch (err) {
      console.warn('bulkCheckWhatsAppNumbers failed', err);
      for (const phone of chunk) notify(phone, 'unknown');
    }
  }));
}

export default function useHasWhatsApp(phoneRaw) {
  const e164 = normalizePhone(phoneRaw);
  const cached = e164 ? cache.get(e164) : null;
  const [status, setStatus] = useState(cached || (e164 ? 'loading' : 'unknown'));

  useEffect(() => {
    if (!e164) {
      setStatus('unknown');
      return;
    }
    // Already cached
    if (cache.has(e164)) {
      setStatus(cache.get(e164));
      return;
    }

    // Subscribe to future updates for this phone
    let subs = subscribers.get(e164);
    if (!subs) {
      subs = new Set();
      subscribers.set(e164, subs);
    }
    subs.add(setStatus);

    // Kick off a verify (deduped via inflight map)
    checkOne(e164);

    return () => {
      const s = subscribers.get(e164);
      if (s) {
        s.delete(setStatus);
        if (s.size === 0) subscribers.delete(e164);
      }
    };
  }, [e164]);

  const refresh = async () => {
    if (!e164) return;
    cache.delete(e164);
    inflight.delete(e164);
    setStatus('loading');
    await checkOne(e164);
  };

  return { status, e164, refresh };
}

/** Imperative read of the in-memory cache (no fetch). */
export function getCachedWhatsAppStatus(phoneRaw) {
  const e164 = normalizePhone(phoneRaw);
  return e164 ? (cache.get(e164) || null) : null;
}
