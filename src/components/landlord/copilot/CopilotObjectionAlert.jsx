// CopilotObjectionAlert — red accent card shown when an objection is detected.
// Dismissible via the X button.

import React from 'react';

export default function CopilotObjectionAlert({ objection, onDismiss }) {
  if (!objection) return null;
  return (
    <div style={{
      borderRadius: 13,
      border: '1px solid rgba(239,68,68,0.4)',
      background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))',
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
    }}>
      <span style={{ fontSize: 16, flex: 'none', lineHeight: 1, marginTop: 1 }}>⚠️</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#fca5a5', marginBottom: 4, fontFamily: "'Space Grotesk',sans-serif" }}>
          Objection · {objection.objection_type || 'detected'}
        </div>
        <p style={{ fontSize: 12.5, lineHeight: 1.4, color: 'rgba(255,255,255,0.85)', fontFamily: "'Inter',sans-serif" }}>
          → {objection.rebuttal}
        </p>
      </div>
      <button onClick={onDismiss} style={{ flex: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 14, padding: '2px 4px' }}>
        ✕
      </button>
    </div>
  );
}