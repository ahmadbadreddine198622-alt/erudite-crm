// LiveCopilotCockpit — the full live cockpit panel shown during a copilot call.
// Connects to the relay server WebSocket and renders:
//   - "SAY THIS NEXT" suggestion card (top)
//   - Objection alert (conditional)
//   - Live transcript stream (middle, auto-scroll)
//   - Brain Qualify auto-fill chips
//   - Signals bar (talk-ratio + signal chips)
//   - Connection status dot + End Call button

import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCopilotWebSocket } from './useCopilotWebSocket';
import CopilotSuggestionCard from './CopilotSuggestionCard';
import CopilotObjectionAlert from './CopilotObjectionAlert';
import CopilotTranscript from './CopilotTranscript';
import CopilotSignalsBar from './CopilotSignalsBar';
import CopilotQualifyFill from './CopilotQualifyFill';
import { PhoneOff, Loader2 } from 'lucide-react';

const GOLD = '#d4af37';

const STATUS_META = {
  connected: { color: '#34d399', label: 'Copilot live' },
  connecting: { color: GOLD, label: 'Connecting…' },
  reconnecting: { color: '#fbbf24', label: 'Reconnecting…' },
  offline: { color: 'rgba(255,255,255,0.3)', label: 'Copilot offline' },
  disconnected: { color: 'rgba(255,255,255,0.3)', label: 'Copilot offline' },
};

export default function LiveCopilotCockpit({ callLogId, landlordId, wsToken, onCallEnd }) {
  const [ending, setEnding] = useState(false);
  const {
    status, transcript, suggestion, objection, qualifyUpdates, signals,
    callComplete, dismissObjection,
  } = useCopilotWebSocket(callLogId, wsToken, !!callLogId);

  const meta = STATUS_META[status] || STATUS_META.offline;

  const handleEndCall = async () => {
    setEnding(true);
    try {
      await base44.functions.invoke('twilioHangupCall', { call_log_id: callLogId });
    } catch (_) {}
    // Small delay for relay to send final events
    setTimeout(() => {
      if (onCallEnd) onCallEnd({ qualifyUpdates, transcript, signals });
    }, 1500);
  };

  // If relay signals call_complete, auto-trigger debrief
  useEffect(() => {
    if (callComplete && onCallEnd) {
      onCallEnd({ qualifyUpdates, transcript, signals, autoComplete: true });
    }
  }, [callComplete]);

  // If offline and no data has arrived, hide the cockpit
  if (status === 'offline') {
    return (
      <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: "'Inter',sans-serif" }}>
        Copilot relay is offline — the call continues normally without live coaching.
      </div>
    );
  }

  return (
    <div style={{
      borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.1)',
      background: 'linear-gradient(180deg, rgba(10,14,26,0.95), rgba(10,14,26,0.85))',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      padding: '14px 16px',
      maxHeight: '70vh',
      minHeight: 320,
    }}>
      {/* Header: status dot + End Call */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color, boxShadow: `0 0 6px ${meta.color}88`, animation: status === 'connected' ? 'copilot-pulse-dot 1.5s ease-in-out infinite' : 'none' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, letterSpacing: '0.04em', fontFamily: "'Space Grotesk',sans-serif" }}>{meta.label}</span>
          <style>{`@keyframes copilot-pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
        </div>
        <button
          onClick={handleEndCall}
          disabled={ending}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', borderRadius: 99, fontSize: 11, fontWeight: 700,
            cursor: 'pointer', fontFamily: "'Inter',sans-serif",
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: '#fff', border: 'none', opacity: ending ? 0.6 : 1,
          }}
        >
          {ending ? <Loader2 size={12} className="animate-spin" /> : <PhoneOff size={12} />}
          {ending ? 'Ending…' : 'End Call'}
        </button>
      </div>

      {/* Suggestion card */}
      <CopilotSuggestionCard suggestion={suggestion} />

      {/* Objection alert */}
      <CopilotObjectionAlert objection={objection} onDismiss={dismissObjection} />

      {/* Transcript stream */}
      <div style={{ flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 10, background: 'rgba(255,255,255,0.02)', padding: '6px 8px' }}>
        <CopilotTranscript transcript={transcript} />
      </div>

      {/* Qualify auto-fill */}
      <CopilotQualifyFill qualifyUpdates={qualifyUpdates} />

      {/* Signals bar */}
      <CopilotSignalsBar signals={signals} />
    </div>
  );
}