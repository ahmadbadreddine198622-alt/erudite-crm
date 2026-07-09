// CopilotTranscript — live transcript stream. Landlord lines left (white),
// agent lines right (gold). Interim words shown faded then solidifying.
// Auto-scrolls to bottom, pauses on hover.

import React, { useRef, useEffect, useState } from 'react';

const GOLD = '#d4af37';

export default function CopilotTranscript({ transcript }) {
  const scrollRef = useRef(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!hovered && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, hovered]);

  if (!transcript.length) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 12, fontFamily: "'Inter',sans-serif" }}>
        Listening…
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0' }}
    >
      {transcript.map((line) => {
        const isAgent = line.speaker === 'agent';
        return (
          <div key={line.id} style={{ display: 'flex', justifyContent: isAgent ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%',
              padding: '7px 11px',
              borderRadius: isAgent ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              background: isAgent ? `${GOLD}14` : 'rgba(255,255,255,0.05)',
              border: `1px solid ${isAgent ? GOLD + '30' : 'rgba(255,255,255,0.08)'}`,
              opacity: line.is_final ? 1 : 0.55,
              fontSize: 12.5,
              lineHeight: 1.4,
              color: isAgent ? GOLD : 'rgba(255,255,255,0.88)',
              fontFamily: "'Inter',sans-serif",
            }}>
              {!isAgent && <span style={{ fontSize: 8.5, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 2 }}>Owner</span>}
              {line.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}