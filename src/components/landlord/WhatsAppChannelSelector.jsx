// WhatsAppChannelSelector — compact inline toolbar element for the composer
// toolbar. Renders two small pill buttons (Personal / Business) that let
// authorized users choose the outgoing WhatsApp line.
//
// The Personal/Business line chooser is restricted to a small allowlist of
// emails. Everyone else sees a compact "Connect WhatsApp →" prompt linking to
// their Profile settings, where they configure their own WhatsApp number.
//
// Props:
//   mode      ('all'|'personal'|'business') — current streamFilter
//   onMode    (fn) — called with 'personal' | 'business' to switch
//   isAdmin    (bool)
//   userEmail (string) — current user's email (gates the P/B chooser)

import React from 'react';
import { useNavigate } from 'react-router-dom';

const ALLOWED_EMAILS = [
  'ahmad@erudite-estate.com',
  'ahmad.badreddine198622@gmail.com',
];

export default function WhatsAppChannelSelector({ mode, onMode, isAdmin = false, userEmail, userWhatsApp }) {
  const navigate = useNavigate();
  const canChoose = !!userEmail && ALLOWED_EMAILS.includes(userEmail.toLowerCase());
  const hasOwnLine = !!(userWhatsApp && String(userWhatsApp).replace(/\D/g, ''));

  // Non-authorized users who already configured their own WhatsApp line in
  // Profile (and paired it in Evolution) are fully connected — render nothing.
  // Only prompt users who haven't set up a number yet.
  if (!canChoose) {
    if (hasOwnLine) return null;
    return (
      <button
        type="button"
        onClick={() => navigate('/profile')}
        title="Connect your WhatsApp number in Profile settings"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 9px', borderRadius: 99, fontSize: 9, fontWeight: 700,
          cursor: 'pointer', fontFamily: "'Inter',sans-serif",
          background: 'rgba(37,211,102,0.10)',
          border: '1px solid rgba(37,211,102,0.35)',
          color: '#4ade80',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80' }} />
        Connect WhatsApp →
      </button>
    );
  }

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