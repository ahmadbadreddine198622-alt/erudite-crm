// WhatsAppChannelSelector — admin-only toggle to choose the outgoing WhatsApp
// line: "Personal" or "Business". Non-admins always send from their personal
// instance and see a read-only badge reflecting the active line.
//
// Props:
//   mode     ('all'|'personal'|'business') — current streamFilter
//   onMode   (fn) — called with 'personal' | 'business' to switch
//   isAdmin  (bool)

import React from 'react';

const GOLD = '#d4af37';

export default function WhatsAppChannelSelector({ mode, onMode, isAdmin = false }) {
  // Effective send channel: business filter → business, everything else → personal
  const effective = mode === 'business' ? 'business' : 'personal';

  const basePill = (active, color) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '4px 11px', borderRadius: 99, fontSize: 10, fontWeight: 700,
    cursor: isAdmin ? 'pointer' : 'default', fontFamily: "'Inter',sans-serif",
    background: active ? (color + '22') : 'transparent',
    border: '1px solid ' + (active ? (color + '55') : 'rgba(255,255,255,0.1)'),
    color: active ? color : 'rgba(255,255,255,0.4)',
    transition: 'all 0.12s ease',
    opacity: isAdmin ? 1 : 0.5,
  });

  const dotStyle = (active, color) => ({
    width: 6, height: 6, borderRadius: '50%',
    background: active ? color : 'rgba(255,255,255,0.2)',
  });

  const businessColor = '#4ade80';
  const personalColor = '#93c5fd';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      marginBottom: 6, marginLeft: 'auto',
    }}>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
        textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
        fontFamily: "'Inter',sans-serif", marginRight: 2,
      }}>
        {isAdmin ? 'Send from' : 'Line'}
      </span>

      <button
        type="button"
        onClick={() => isAdmin && onMode('personal')}
        style={basePill(effective === 'personal', personalColor)}
        title={isAdmin ? 'Send from personal WhatsApp' : 'Active send line'}
      >
        <span style={dotStyle(effective === 'personal', personalColor)} />
        Personal
      </button>

      <button
        type="button"
        onClick={() => isAdmin && onMode('business')}
        style={basePill(effective === 'business', businessColor)}
        title={isAdmin ? 'Send from business WhatsApp' : 'Active send line'}
      >
        <span style={dotStyle(effective === 'business', businessColor)} />
        Business
      </button>

      {!isAdmin && (
        <span style={{
          fontSize: 8.5, color: 'rgba(255,255,255,0.25)', fontFamily: "'Inter',sans-serif",
        }}>admin-only</span>
      )}
    </div>
  );
}