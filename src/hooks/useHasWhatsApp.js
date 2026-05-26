import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

// Module-level caches — survive page re-renders
const resultCache = new Map(); // e164 -> { status, checkedAt }
const pendingSet = new Set();  // e164 -> Promise (dedupe)
const listeners = new Map();   // e164 -> Set<function>

function notify(e164, status) {
  resultCache.set(e164, { status, checkedAt: Date.now() });
  const subs = listeners.get(e164);
  if (subs) subs.forEach(fn => fn(status));
}

async function fetchStatus(e164) {
  if (pendingSet.has(e164)) return;
  pendingSet.add(e164);
  try {
    const res = await base44.functions.invoke('checkWhatsAppNumber', { phone: e164 });
    const data = res?.data;
    const status = data?.is_valid_whatsapp === true ? 'yes'
      : data?.is_valid_whatsapp === false ? 'no'
      : 'unknown';
    notify(e164, status);
  } catch (_) {
    notify(e164, 'unknown');
  } finally {
    pendingSet.delete(e164);
  }
}

export function normalizePhone(raw, defaultCountry = 'AE') {
  if (!raw) return null;
  let p = raw.replace(/[\s\-().]/g, '');
  if (p.startsWith('+')) return p;
  if (p.startsWith('00')) return '+' + p.slice(2);
  if (p.startsWith('971')) return '+' + p;
  if (p.startsWith('0')) return '+971' + p.slice(1);
  if (p.startsWith('5') && p.length === 9) return '+971' + p;
  return '+971' + p;
}

export default function useHasWhatsApp(rawPhone) {
  const e164 = rawPhone ? normalizePhone(rawPhone) : null;
  const cached = e164 ? resultCache.get(e164) : null;
  const [status, setStatus] = useState(cached?.status || (e164 ? 'loading' : 'unknown'));
  const ref = useRef(e164);

  useEffect(() => {
    if (!e164) { setStatus('unknown'); return; }
    ref.current = e164;

    // Subscribe to updates for this phone
    if (!listeners.has(e164)) listeners.set(e164, new Set());
    const handler = (s) => { if (ref.current === e164) setStatus(s); };
    listeners.get(e164).add(handler);

    // Check cache
    const cached = resultCache.get(e164);
    const CACHE_TTL = 30 * 60 * 1000; // 30 min in-memory TTL
    if (cached && (Date.now() - cached.checkedAt) < CACHE_TTL) {
      setStatus(cached.status);
    } else {
      setStatus('loading');
      fetchStatus(e164);
    }

    return () => {
      listeners.get(e164)?.delete(handler);
    };
  }, [e164]);

  return { status, e164 };
}