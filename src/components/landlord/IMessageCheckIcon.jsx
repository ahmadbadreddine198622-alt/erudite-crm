// Per-address iMessage availability icon button.
// Shows the resolved status from landlord.imessage_handles (if present),
// and lets the agent re-check this single handle on click via checkIMessageAvailability.
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { MessageSquare } from 'lucide-react';

// Match a raw phone/email to a normalized handle in the landlord's resolved list.
function normalizePhone(raw) {
  let d = String(raw || '').trim().replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+')) return d;
  if (d.startsWith('00')) return '+' + d.slice(2);
  if (d.startsWith('971')) return '+' + d;
  if (d.startsWith('0')) return '+971' + d.slice(1);
  return '+971' + d;
}
function normalizeEmail(raw) {
  const t = String(raw || '').trim().toLowerCase();
  return t.includes('@') ? t : '';
}
function findHandleStatus(address, handles) {
  if (!address || !Array.isArray(handles)) return 'unknown';
  const isEmail = String(address).includes('@');
  const norm = isEmail ? normalizeEmail(address) : normalizePhone(address);
  const hit = handles.find((h) => h && h.handle === norm);
  return hit?.imessage_status || 'unknown';
}

const COLOR = {
  available:     { color: '#34d399', bg: 'rgba(16,185,129,0.16)', border: 'rgba(16,185,129,0.4)', label: 'iMessage ✓' },
  not_available: { color: 'rgba(255,255,255,0.5)', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)', label: 'SMS only' },
  error:         { color: '#f87171', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.35)', label: 'Check failed' },
  unknown:       { color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', label: 'Check iMessage' },
};

export default function IMessageCheckIcon({ address, landlordId, handles, size = 26 }) {
  const [checking, setChecking] = useState(false);
  if (!address) return null;
  const status = findHandleStatus(address, handles);
  const meta = COLOR[status] || COLOR.unknown;

  const handleCheck = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (checking) return;
    setChecking(true);
    try {
      const res = await base44.functions.invoke('checkIMessageAvailability', {
        landlord_id: landlordId,
        phone: address,
      });
      const data = res?.data ?? res;
      const s = data?.imessage_status || 'error';
      if (s === 'available') toast.success(`${address}: iMessage available ✓`);
      else if (s === 'not_available') toast.info(`${address}: SMS only (no iMessage)`);
      else toast.error(`${address}: check failed`);
    } catch (err) {
      toast.error('iMessage check failed: ' + (err?.message || 'unknown'));
    } finally {
      setChecking(false);
    }
  };

  return (
    <a
      href="#"
      onClick={handleCheck}
      title={checking ? 'Checking…' : `${meta.label} · ${address}`}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: 999, flex: 'none',
        background: meta.bg, border: '1px solid ' + meta.border, color: meta.color,
        textDecoration: 'none', cursor: checking ? 'default' : 'pointer',
        opacity: checking ? 0.6 : 1,
      }}
    >
      <MessageSquare size={12} style={checking ? { animation: 'ld-spin 0.8s linear infinite' } : undefined} />
    </a>
  );
}