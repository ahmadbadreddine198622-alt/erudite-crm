// LiveCopilotPanel — real-time cockpit shown during a copilot-enabled call.
// Opens a WebSocket to the relay server, renders live transcript, suggestions,
// objection alerts, qualify auto-fill, and a signals bar.
//
// Props:
//   callLogId   (string) — CallLog ID for the cockpit WS connection
//   landlordId  (string) — for fetching context pack
//   agentEmail  (string) — stamped on the WS connection
//   onComplete  (fn)     — called with the relay's call_complete payload
//   onClose     (fn)     — called when the user dismisses the panel

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { QUESTION_BANK } from './qualifyQuestionBank';
import { Loader2, X, Radio, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';

const GOLD = '#d4af37';
const NAVY = '#0a0e1a';
const RED = '#ef4444';
const WS_BASE = 'wss://copilot.peninsulabusinessbay.com/cockpit';

function TranscriptLine({ line }) {
  const isAgent = line.speaker === 'agent';
  return (
    <div style={{ display: 'flex', justifyContent: isAgent ? 'flex-end' : 'flex-start', marginBottom: 4 }}>
      <div style={{
        maxWidth: '85%', padding: '6px 11px', borderRadius: isAgent ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
        background: isAgent ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${isAgent ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.1)'}`,
        opacity: line.is_final === false ? 0.5 : 1,
        transition: 'opacity 0.3s',
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase',
          color: isAgent ? GOLD : 'rgba(255,255,255,0.4)', marginRight: 6 }}>
          {isAgent ? 'You' : 'Owner'}
        </span>
        <span style={{ fontSize: 12.5, lineHeight: 1.45, color: isAgent ? 'rgba(212,175,55,0.92)' : 'rgba(255,255,255,0.85)' }}>
          {line.text}
        </span>
      </div>
    </div>
  );
}

function QualifyChip({ q, filled, glow }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 99,
      fontSize: 9.5, fontWeight: 600, whiteSpace: 'nowrap',
      background: filled ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${glow ? 'rgba(212,175,55,0.6)' : filled ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.08)'}`,
      color: filled ? GOLD : 'rgba(255,255,255,0.4)',
      boxShadow: glow ? '0 0 8px rgba(212,175,55,0.4)' : 'none',
      animation: glow ? 'copilot-glow 1.2s ease-in-out' : 'none',
    }}>
      {filled && <CheckCircle2 size={9} style={{ color: GOLD }} />}
      {q.area}
    </div>
  );
}

export default function LiveCopilotPanel({ callLogId, landlordId, agentEmail, onComplete, onClose }) {
  const [wsStatus, setWsStatus] = useState('connecting'); // connecting | live | reconnecting | offline
  const [transcript, setTranscript] = useState([]);
  const [suggestion, setSuggestion] = useState(null);
  const [objection, setObjection] = useState(null);
  const [qualifyFills, setQualifyFills] = useState({});
  const [glowField, setGlowField] = useState(null);
  const [signals, setSignals] = useState({ talk_ratio: null, detected_flags: [] });
  const [paused, setPaused] = useState(false);

  const wsRef = useRef(null);
  const scrollRef = useRef(null);
  const contextSentRef = useRef(false);

  // Fetch context pack and send to relay on mount
  useEffect(() => {
    if (!landlordId) return;
    base44.functions.invoke('copilotContextPack', { landlord_id: landlordId })
      .then(res => {
        const data = res?.data ?? res;
        if (data?.ok && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'context_pack', data }));
        } else {
          // Store for when WS opens
          contextSentRef.current = data;
        }
      })
      .catch(() => {});
  }, [landlordId]);

  // WebSocket connection
  useEffect(() => {
    if (!callLogId) return;
    let reconnectTimer = null;

    const connect = () => {
      const url = `${WS_BASE}?call_log_id=${encodeURIComponent(callLogId)}&agent_email=${encodeURIComponent(agentEmail || '')}`;
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          setWsStatus('live');
          if (contextSentRef.current) {
            ws.send(JSON.stringify({ type: 'context_pack', data: contextSentRef.current }));
            contextSentRef.current = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            handleEvent(msg);
          } catch (_) {}
        };

        ws.onclose = () => {
          if (wsStatus !== 'offline') {
            setWsStatus('reconnecting');
            reconnectTimer = setTimeout(connect, 3000);
          }
        };

        ws.onerror = () => {
          setWsStatus('reconnecting');
        };
      } catch (e) {
        setWsStatus('offline');
      }
    };

    connect();
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) { try { wsRef.current.close(); } catch (_) {} }
    };
  }, [callLogId]);

  // Auto-scroll transcript (pause on hover)
  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, paused]);

  const handleEvent = useCallback((msg) => {
    if (!msg || !msg.type) return;
    switch (msg.type) {
      case 'transcript':
        setTranscript(prev => {
          // Update last interim line if same speaker and not final
          const last = prev[prev.length - 1];
          if (last && last.speaker === msg.speaker && last.is_final === false && msg.is_final === false) {
            return [...prev.slice(0, -1), { ...msg }];
          }
          // Finalize previous interim, add new
          if (last && last.is_final === false) {
            return [...prev.slice(0, -1), { ...last, is_final: true }, { ...msg }];
          }
          return [...prev, { ...msg }];
        });
        break;
      case 'suggestion':
        setSuggestion({ text: msg.text, tier: msg.tier || 'standard', rationale: msg.rationale || '' });
        break;
      case 'objection':
        setObjection({ type: msg.objection_type || 'Objection', rebuttal: msg.rebuttal || '', quote: msg.quote || '' });
        break;
      case 'qualify':
        if (msg.field_key) {
          setQualifyFills(prev => ({ ...prev, [msg.field_key]: { value: msg.value, quote: msg.source_quote || '' } }));
          setGlowField(msg.field_key);
          setTimeout(() => setGlowField(null), 2000);
        }
        break;
      case 'signal':
        setSignals(prev => ({
          talk_ratio: msg.talk_ratio ?? prev.talk_ratio,
          detected_flags: msg.detected_flags || prev.detected_flags,
        }));
        break;
      case 'call_complete':
        if (onComplete) onComplete(msg);
        break;
    }
  }, [onComplete]);

  const answeredCount = Object.keys(qualifyFills).length;
  const talkRatio = signals.talk_ratio;
  const ratioWarn = talkRatio != null && talkRatio > 0.6;

  const statusMeta = {
    connecting: { label: 'Connecting…', color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.08)' },
    live: { label: 'Copilot live', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
    reconnecting: { label: 'Reconnecting…', color: GOLD, bg: 'rgba(212,175,55,0.12)' },
    offline: { label: 'Offline', color: 'rgba(255,255,255,0.35)', bg: 'rgba(255,255,255,0.04)' },
  }[wsStatus];

  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden',
      border: `1px solid rgba(212,175,55,0.25)`,
      background: `linear-gradient(180deg, ${NAVY}, #0d1220)`,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <style>{`@keyframes copilot-glow{0%,100%{box-shadow:0 0 4px rgba(212,175,55,0.3)}50%{box-shadow:0 0 12px rgba(212,175,55,0.6)}}@keyframes copilot-pulse{0%,100%{opacity:1}50%{opacity:0.7}}`}</style>

      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(212,175,55,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Radio size={13} style={{ color: GOLD }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', color: GOLD, fontFamily: 'var(--font-display)' }}>
            LIVE CALL COPILOT
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 99,
            fontSize: 9, fontWeight: 700, color: statusMeta.color, background: statusMeta.bg,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusMeta.color,
              animation: wsStatus === 'live' ? 'copilot-pulse 1.6s ease-in-out infinite' : 'none' }} />
            {statusMeta.label}
          </span>
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
              <X size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
            </button>
          )}
        </div>
      </div>

      {wsStatus === 'offline' ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
          Copilot relay is offline — your call continues normally.
        </div>
      ) : (
        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* SAY THIS NEXT card */}
          {suggestion && (
            <div style={{
              borderRadius: 10, padding: '10px 12px',
              background: suggestion.tier === 'strategic' ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${suggestion.tier === 'strategic' ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.1)'}`,
              animation: suggestion.tier === 'strategic' ? 'copilot-pulse 2s ease-in-out infinite' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <Sparkles size={11} style={{ color: GOLD }} />
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: GOLD }}>
                  Say This Next {suggestion.tier === 'strategic' ? '· Strategic' : ''}
                </span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.4, color: 'rgba(255,255,255,0.92)', fontWeight: 500 }}>
                {suggestion.text}
              </p>
              {suggestion.rationale && (
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontStyle: 'italic' }}>
                  {suggestion.rationale}
                </p>
              )}
            </div>
          )}

          {/* Objection alert */}
          {objection && (
            <div style={{
              borderRadius: 10, padding: '10px 12px',
              background: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.4)`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <AlertTriangle size={11} style={{ color: '#fca5a5' }} />
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#fca5a5' }}>
                    Objection · {objection.type}
                  </span>
                </div>
                <button onClick={() => setObjection(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <X size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
                </button>
              </div>
              {objection.quote && (
                <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)', marginBottom: 4, fontStyle: 'italic' }}>
                  "{objection.quote}"
                </p>
              )}
              <p style={{ fontSize: 12, lineHeight: 1.4, color: '#fca5a5' }}>
                {objection.rebuttal}
              </p>
            </div>
          )}

          {/* Transcript stream */}
          <div
            ref={scrollRef}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            style={{
              maxHeight: 220, overflowY: 'auto', padding: '4px 2px',
              display: 'flex', flexDirection: 'column', gap: 2,
              borderRadius: 8, background: 'rgba(0,0,0,0.2)',
            }}
          >
            {transcript.length === 0 && (
              <div style={{ padding: 12, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                {wsStatus === 'connecting' ? <Loader2 size={12} className="animate-spin" style={{ display: 'inline-block' }} /> : null}
                {' '}Waiting for conversation…
              </div>
            )}
            {transcript.map((line, i) => <TranscriptLine key={i} line={line} />)}
          </div>

          {/* Qualify auto-fill chips */}
          <div style={{
            borderRadius: 8, padding: '7px 10px', background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
                Brain Qualify Auto-Fill
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: answeredCount > 0 ? GOLD : 'rgba(255,255,255,0.35)' }}>
                {answeredCount} of {QUESTION_BANK.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {QUESTION_BANK.map(q => (
                <QualifyChip key={q.field_key} q={q} filled={!!qualifyFills[q.field_key]} glow={glowField === q.field_key} />
              ))}
            </div>
          </div>

          {/* Signals bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            {/* Talk ratio meter */}
            {talkRatio != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>Talk ratio</span>
                <div style={{ width: 50, height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round(talkRatio * 100)}%`, height: '100%',
                    background: ratioWarn ? GOLD : '#34d399', borderRadius: 99 }} />
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: ratioWarn ? GOLD : 'rgba(255,255,255,0.6)' }}>
                  {Math.round(talkRatio * 100)}%
                </span>
                {ratioWarn && <span style={{ fontSize: 8, color: GOLD }}>⚠</span>}
              </div>
            )}
            {/* Detected signal chips */}
            {signals.detected_flags?.map((flag, i) => (
              <span key={i} style={{
                display: 'inline-flex', padding: '2px 7px', borderRadius: 99, fontSize: 8.5, fontWeight: 600,
                background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)', color: GOLD,
              }}>
                {flag.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}