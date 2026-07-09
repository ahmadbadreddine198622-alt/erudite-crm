// CopilotQualifyFill — shows which Brain Qualify fields the copilot auto-detected.
// Each detected field glows gold with an "AI-detected — tap to confirm" label.

import React from 'react';
import { QUESTION_BANK } from '@/components/landlord/qualifyQuestionBank';

const GOLD = '#d4af37';

export default function CopilotQualifyFill({ qualifyUpdates }) {
  const detected = QUESTION_BANK.filter(q => qualifyUpdates[q.field_key] !== undefined);
  if (!detected.length) return null;

  return (
    <div style={{
      borderRadius: 11,
      border: `1px solid ${GOLD}33`,
      background: `${GOLD}08`,
      padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: GOLD, fontFamily: "'Space Grotesk',sans-serif" }}>
          🧠 Auto-detected
        </span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: "'Inter',sans-serif" }}>
          {detected.length} of {QUESTION_BANK.length} — tap to confirm
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {detected.map(q => {
          const val = qualifyUpdates[q.field_key];
          const label = q.options ? (q.options.find(o => o.value === val)?.label || val) : String(val);
          return (
            <span key={q.field_key} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px',
              borderRadius: 8, fontSize: 10, fontWeight: 600,
              background: `${GOLD}14`, border: `1px solid ${GOLD}44`, color: '#fff',
              fontFamily: "'Inter',sans-serif",
              animation: 'copilot-glow 1.5s ease-in-out',
            }}>
              <span style={{ fontSize: 8, color: GOLD, fontWeight: 800 }}>{q.area}</span>
              <span style={{ color: 'rgba(255,255,255,0.85)' }}>{label}</span>
            </span>
          );
        })}
      </div>
      <style>{`@keyframes copilot-glow { 0% { box-shadow: 0 0 8px ${GOLD}44; } 100% { box-shadow: 0 0 0 ${GOLD}00; } }`}</style>
    </div>
  );
}