import React from 'react';

// Small inline-style badge + "Check iMessage" control for a landlord's iMessage capability.
// Pure presentational — parent owns the status, the checking flag, and the check handler.

function relativeStamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const STATUS_META = {
  available:     { label: 'iMessage ✓',  color: '#60a5fa', bg: 'rgba(10,132,255,0.16)',  border: 'rgba(10,132,255,0.4)' },
  not_available: { label: 'SMS only',    color: 'rgba(255,255,255,0.6)', bg: 'rgba(148,163,184,0.14)', border: 'rgba(148,163,184,0.3)' },
  error:         { label: 'Check failed', color: '#f87171', bg: 'rgba(239,68,68,0.14)',  border: 'rgba(239,68,68,0.35)' },
  unknown:       { label: 'Not checked', color: 'rgba(255,255,255,0.5)', bg: 'transparent', border: 'rgba(255,255,255,0.18)' },
};

export default function IMessageBadge({ status = 'unknown', checkedAt, checking, onCheck, handle, handles }) {
  const meta = STATUS_META[status] || STATUS_META.unknown;
  const handleList = Array.isArray(handles) ? handles : [];
  const checkedCount = handleList.length;
  const availableCount = handleList.filter(h => h && h.imessage_status === 'available').length;
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: '99px', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.02em', color: meta.color, background: meta.bg, border: '1px solid ' + meta.border, whiteSpace: 'nowrap' }}>
          {checking ? 'Resolving…' : meta.label}
        </span>
        {!checking && status === 'available' && handle && (
          <span title="Primary iMessage handle" style={{ fontSize: '9.5px', fontWeight: 600, color: '#60a5fa', fontFamily: "'SF Mono','Menlo',monospace" }}>{handle}</span>
        )}
        <button
          onClick={onCheck}
          disabled={checking}
          title="Resolve all iMessage handles from contact data"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '99px', fontSize: '9.5px', fontWeight: 600, cursor: checking ? 'default' : 'pointer', fontFamily: "'Inter',sans-serif", background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.25)', color: '#60a5fa', opacity: checking ? 0.6 : 1 }}
        >
          <span style={{ display: 'inline-block', animation: checking ? 'ld-spin 0.8s linear infinite' : 'none' }}>↻</span>
          Resolve iMessage
        </button>
      </div>
      {!checking && checkedCount > 0 && (
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{availableCount} of {checkedCount} handle{checkedCount === 1 ? '' : 's'} on iMessage{checkedAt ? ' · ' + relativeStamp(checkedAt) : ''}</span>
      )}
      {!checking && checkedCount === 0 && checkedAt && (
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)' }}>Last checked: {relativeStamp(checkedAt)}</span>
      )}
    </div>
  );
}