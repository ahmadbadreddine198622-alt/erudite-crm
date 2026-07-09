// CopilotSignalsBar — talk-ratio meter + detected signal chips.
// Warns gold if agent talk ratio > 60%.

import React from 'react';

const GOLD = '#d4af37';
const SIGNAL_META = {
  relocating: { label: 'Relocating', color: '#60a5fa' },
  price_sensitive: { label: 'Price-sensitive', color: '#fbbf24' },
  urgent: { label: 'Urgent', color: '#f87171' },
  motivated: { label: 'Motivated', color: '#34d399' },
  hesitant: { label: 'Hesitant', color: '#a78bfa' },
  investor: { label: 'Investor', color: '#22d3ee' },
  distressed: { label: 'Distressed', color: '#fb923c' },
};

export default function CopilotSignalsBar({ signals }) {
  const talkRatio = signals?.talk_ratio;
  const detected = signals?.detected || [];
  const agentRatio = talkRatio ? Math.round((talkRatio.agent || 0) * 100) : null;
  const landlordRatio = talkRatio ? Math.round((talkRatio.landlord || 0) * 100) : null;
  const warn = agentRatio != null && agentRatio > 60;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {/* Talk ratio meter */}
      {agentRatio != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
          <span style={{ fontSize: 8.5, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: "'Space Grotesk',sans-serif" }}>
            Talk ratio
          </span>
          <div style={{ display: 'flex', width: 80, height: 5, borderRadius: 99, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
            <div style={{ width: `${landlordRatio}%`, background: 'rgba(255,255,255,0.4)', transition: 'width 0.5s' }} />
            <div style={{ width: `${agentRatio}%`, background: warn ? GOLD : '#34d399', transition: 'width 0.5s' }} />
          </div>
          {warn && <span style={{ fontSize: 9, fontWeight: 700, color: GOLD, fontFamily: "'Inter',sans-serif" }}>⚠ {agentRatio}%</span>}
        </div>
      )}

      {/* Signal chips */}
      {detected.map((sig, i) => {
        const meta = SIGNAL_META[sig] || { label: sig, color: 'rgba(255,255,255,0.6)' };
        return (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 99,
            fontSize: 9.5, fontWeight: 700, color: meta.color,
            background: meta.color + '18', border: `1px solid ${meta.color}33`,
            fontFamily: "'Inter',sans-serif", whiteSpace: 'nowrap',
          }}>
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}