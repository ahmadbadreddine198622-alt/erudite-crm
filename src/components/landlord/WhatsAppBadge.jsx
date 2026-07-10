import React from 'react';

// Small inline-style badge + "Check WhatsApp" control for a landlord's WhatsApp capability.
// Pure presentational — parent owns the status, the checking flag, and the check handler.
// Mirrors IMessageBadge. Shows how many of the landlord's numbers are valid on WhatsApp.

function relativeStamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const STATUS_META = {
  available:     { label: 'WhatsApp ✓', color: '#4ade80', bg: 'rgba(37,211,102,0.16)', border: 'rgba(37,211,102,0.4)' },
  not_available: { label: 'No WhatsApp',  color: 'rgba(255,255,255,0.6)', bg: 'rgba(148,163,184,0.14)', border: 'rgba(148,163,184,0.3)' },
  error:         { label: 'Check failed', color: '#f87171', bg: 'rgba(239,68,68,0.14)',  border: 'rgba(239,68,68,0.35)' },
  unknown:       { label: 'Not checked',  color: 'rgba(255,255,255,0.5)', bg: 'transparent', border: 'rgba(255,255,255,0.18)' },
};

export default function WhatsAppBadge({ status = 'unknown', checkedAt, checking, onCheck, handle, handles }) {
  const meta = STATUS_META[status] || STATUS_META.unknown;
  const handleList = Array.isArray(handles) ? handles : [];
  const checkedCount = handleList.length;
  const availableCount = handleList.filter((h) => h && h.is_valid_whatsapp).length;
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: '99px', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.02em', color: meta.color, background: meta.bg, border: '1px solid ' + meta.border, whiteSpace: 'nowrap' }}>
          {checking ? 'Checking…' : meta.label}
        </span>
        {!checking && status === 'available' && handle && (
          <span title="Primary WhatsApp number" style={{ fontSize: '9.5px', fontWeight: 600, color: '#4ade80', fontFamily: "'SF Mono','Menlo',monospace" }}>{handle}</span>
        )}
        <button
          onClick={onCheck}
          disabled={checking}
          title="Check all numbers on WhatsApp"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', cursor: checking ? 'default' : 'pointer', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', color: '#4ade80', opacity: checking ? 0.6 : 1, flex: 'none' }}
        >
          <span style={{ display: 'inline-block', fontSize: 11, animation: checking ? 'ld-spin 0.8s linear infinite' : 'none' }}>↻</span>
        </button>
      </div>
      {!checking && checkedCount > 0 && (
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{availableCount} of {checkedCount} number{checkedCount === 1 ? '' : 's'} on WhatsApp{checkedAt ? ' · ' + relativeStamp(checkedAt) : ''}</span>
      )}
      {!checking && checkedCount === 0 && checkedAt && (
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)' }}>Last checked: {relativeStamp(checkedAt)}</span>
      )}
    </div>
  );
}