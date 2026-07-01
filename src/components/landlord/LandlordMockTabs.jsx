// Mockup only — 3-tab underline nav (Info / Activity / Pipeline) shown below the identity header.
// Content per tab is placeholder for now; the user will specify what goes in each tab next.
import React, { useState } from 'react';

const GOLD = '#C9A24B';
const TABS = ['Info', 'Activity', 'Pipeline'];

export default function LandlordMockTabs() {
  const [active, setActive] = useState('Info');

  return (
    <div style={{ marginTop: 14 }}>
      {/* Underline tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {TABS.map((t) => {
          const on = active === t;
          return (
            <button
              key={t}
              onClick={() => setActive(t)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '10px 2px 12px',
                fontFamily: "'Inter',sans-serif",
                fontSize: 13.5,
                fontWeight: 700,
                color: on ? '#ffffff' : 'rgba(255,255,255,0.4)',
                borderBottom: on ? `2px solid ${GOLD}` : '2px solid transparent',
                transition: 'color 0.15s ease, border-color 0.15s ease',
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Placeholder content area */}
      <div
        style={{
          marginTop: 14,
          borderRadius: 14,
          border: '1px solid rgba(201,162,75,0.18)',
          background: 'rgba(255,255,255,0.03)',
          padding: '24px 18px',
          minHeight: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 12.5, color: 'rgba(255,255,255,0.4)' }}>
          {active} content — coming soon
        </span>
      </div>
    </div>
  );
}