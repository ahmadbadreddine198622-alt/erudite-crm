// WhatsAppChannelSelector — compact inline toolbar element for the composer
// toolbar. Renders two small pill buttons (Personal / Business) that let admins
// choose the outgoing WhatsApp line. Non-admins see a read-only active badge.
//
// Props:
//   mode     ('all'|'personal'|'business') — current streamFilter
//   onMode   (fn) — called with 'personal' | 'business' to switch
//   isAdmin  (bool)

import React from 'react';

export default function WhatsAppChannelSelector({ mode, onMode, isAdmin = false }) {
  const effective = mode === 'business' ? 'business' : 'personal';

  const basePill = (active, color) => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 8px', borderRadius: 99, fontSize: 9, fontWeight: 700,
    cursor: isAdmin ? 'pointer' : 'default', fontFamily: "'Inter',sans-serif",
    background: active ? (color + '22') : 'transparent',
    border: '1px solid ' + (active ? (color + '55') : 'rgba(255,255,255,0.1)'),
    color: active ? color : 'rgba(255,255,255,0.4)',
    transition: 'all 0.12s ease',
    opacity: isAdmin ? 1 : 0.5,
    whiteSpace: 'nowrap',
  });

  const dotStyle = (active, color) => ({
    width: 5, height: 5, borderRadius: '50%',
    background: active ? color : 'rgba(255,255,255,0.2)',
  });

  const businessColor = '#4ade80';
  const personalColor = '#93c5fd';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 'none' }}>
      <button
        type="button"
        onClick={() => isAdmin && onMode('personal')}
        style={basePill(effective === 'personal', personalColor)}
        title={isAdmin ? 'Send from personal WhatsApp' : 'Active send line'}
      >
        <span style={dotStyle(effective === 'personal', personalColor)} />
        P
      </button>
      <button
        type="button"
        onClick={() => isAdmin && onMode('business')}
        style={basePill(effective === 'business', businessColor)}
        title={isAdmin ? 'Send from business WhatsApp' : 'Active send line'}
      >
        <span style={dotStyle(effective === 'business', businessColor)} />
        B
      </button>
    </div>
  );
}