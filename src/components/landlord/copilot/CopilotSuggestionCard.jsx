// CopilotSuggestionCard — the "SAY THIS NEXT" card at the top of the cockpit.
// Strategic-tier suggestions get a gold border + subtle pulse animation.

import React from 'react';

const GOLD = '#d4af37';

export default function CopilotSuggestionCard({ suggestion }) {
  if (!suggestion || !suggestion.text) return null;
  const isStrategic = suggestion.tier === 'strategic';

  return (
    <div style={{
      borderRadius: 13,
      border: `1px solid ${isStrategic ? GOLD + '66' : 'rgba(255,255,255,0.12)'}`,
      background: isStrategic
        ? `linear-gradient(135deg, ${GOLD}18, ${GOLD}06)`
        : 'rgba(255,255,255,0.04)',
      padding: '14px 16px',
      animation: isStrategic ? 'copilot-pulse 2s ease-in-out infinite' : 'none',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{`@keyframes copilot-pulse { 0%,100% { box-shadow: 0 0 0 0 ${GOLD}22; } 50% { box-shadow: 0 0 16px 2px ${GOLD}33; } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: isStrategic ? GOLD : 'rgba(255,255,255,0.5)', fontFamily: "'Space Grotesk',sans-serif" }}>
          {suggestion.label || (isStrategic ? '🎯 Strategic' : '💬 Say this next')}
        </span>
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: isStrategic ? '#fff' : 'rgba(255,255,255,0.88)', fontFamily: "'Inter',sans-serif" }}>
        "{suggestion.text}"
      </p>
    </div>
  );
}