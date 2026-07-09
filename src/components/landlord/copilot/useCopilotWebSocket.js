// useCopilotWebSocket — manages the WebSocket connection to the copilot relay
// server. Parses incoming events and exposes them as React state.
//
// Events from the relay:
//   { type: "transcript", speaker: "landlord"|"agent", text: "...", is_final: bool }
//   { type: "suggestion", text: "...", tier: "strategic"|"tactical", label: "..." }
//   { type: "objection", objection_type: "...", rebuttal: "..." }
//   { type: "qualify", field_key: "motivation", value: "relocating", confidence: 0.9 }
//   { type: "signals", talk_ratio: { agent: 0.45, landlord: 0.55 }, detected: ["relocating","urgent"] }
//   { type: "call_complete" }
//   { type: "connected" }

import { useState, useEffect, useRef, useCallback } from 'react';

const COPILOT_WS_BASE = 'wss://copilot.peninsulabusinessbay.com/cockpit';

export function useCopilotWebSocket(callLogId, wsToken, enabled = true) {
  const [status, setStatus] = useState('disconnected'); // disconnected | connecting | connected | reconnecting | offline
  const [transcript, setTranscript] = useState([]);
  const [suggestion, setSuggestion] = useState(null);
  const [objection, setObjection] = useState(null);
  const [qualifyUpdates, setQualifyUpdates] = useState({});
  const [signals, setSignals] = useState({ talk_ratio: null, detected: [] });
  const [callComplete, setCallComplete] = useState(false);

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const closedByUsRef = useRef(false);

  const connect = useCallback(() => {
    if (!callLogId || !enabled) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const url = `${COPILOT_WS_BASE}?call_log_id=${encodeURIComponent(callLogId)}&token=${encodeURIComponent(wsToken || '')}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => { setStatus('connected'); };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'connected':
              setStatus('connected');
              break;
            case 'transcript':
              setTranscript(prev => {
                // Update last entry if interim, else append
                if (!msg.is_final && prev.length > 0 && prev[prev.length - 1].speaker === msg.speaker && !prev[prev.length - 1].is_final) {
                  return [...prev.slice(0, -1), { ...msg, id: prev[prev.length - 1].id }];
                }
                return [...prev, { ...msg, id: Date.now() + Math.random() }];
              });
              break;
            case 'suggestion':
              setSuggestion({ text: msg.text, tier: msg.tier || 'tactical', label: msg.label || '', ts: Date.now() });
              break;
            case 'objection':
              setObjection({ objection_type: msg.objection_type, rebuttal: msg.rebuttal, ts: Date.now() });
              break;
            case 'qualify':
              setQualifyUpdates(prev => ({ ...prev, [msg.field_key]: msg.value }));
              break;
            case 'signals':
              setSignals({ talk_ratio: msg.talk_ratio || null, detected: msg.detected || [] });
              break;
            case 'call_complete':
              setCallComplete(true);
              break;
          }
        } catch (_) {}
      };

      ws.onerror = () => { setStatus('reconnecting'); };

      ws.onclose = () => {
        wsRef.current = null;
        if (!closedByUsRef.current && !callComplete) {
          setStatus('reconnecting');
          reconnectTimerRef.current = setTimeout(() => connect(), 3000);
        } else if (!callComplete) {
          setStatus('offline');
        }
      };
    } catch (e) {
      setStatus('offline');
    }
  }, [callLogId, wsToken, enabled, callComplete]);

  useEffect(() => {
    if (!enabled || !callLogId) return;
    connect();
    return () => {
      closedByUsRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) { try { wsRef.current.close(); } catch (_) {} wsRef.current = null; }
    };
  }, [callLogId, wsToken, enabled]);

  const dismissObjection = useCallback(() => setObjection(null), []);
  const clearSuggestion = useCallback(() => setSuggestion(null), []);

  return {
    status, transcript, suggestion, objection, qualifyUpdates, signals,
    callComplete, dismissObjection, clearSuggestion,
  };
}