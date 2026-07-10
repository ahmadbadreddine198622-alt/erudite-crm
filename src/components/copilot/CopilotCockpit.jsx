import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Radio, Sparkles, AlertTriangle, X, Mic, CheckCircle2, Loader2,
  BrainCircuit, Flag, TrendingUp,
} from 'lucide-react';

const GOLD = '#d4af37';
const NAVY = '#0a0e1a';

/**
 * CopilotCockpit — live in-call panel on the Calls tab.
 *
 * Listens for window events dispatched by TwilioCallDialog:
 *   'copilot:call'  { callLogId, landlordId, phase: 'started' | 'ended' }
 *
 * Connects to the relay cockpit WebSocket and renders:
 *   SAY THIS NEXT card · objection alerts · live diarized transcript ·
 *   talk-ratio meter · signal chips · connection status dot.
 * Re-dispatches qualify events as 'copilot:qualify' so Brain Qualify auto-fills.
 * When the call ends → post-call debrief with one-tap Confirm All + Brain Coach.
 */
export default function CopilotCockpit({ landlordId, landlord }) {
  const [callLogId, setCallLogId] = useState(null);
  const [conn, setConn] = useState('idle'); // idle | connecting | live | reconnecting | offline | waiting
  const [transcript, setTranscript] = useState([]); // finals
  const [interim, setInterim] = useState({}); // speaker -> text
  const [suggestion, setSuggestion] = useState(null);
  const [objection, setObjection] = useState(null);
  const [signals, setSignals] = useState([]);
  const [talkRatio, setTalkRatio] = useState(null);
  const [qualifyCount, setQualifyCount] = useState(0);
  const [debrief, setDebrief] = useState(null); // { summary, signals, talk_ratio }
  const [coach, setCoach] = useState(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const wsRef = useRef(null);
  const tokenRef = useRef(null);
  const retriesRef = useRef(0);
  const scrollRef = useRef(null);
  const hoverRef = useRef(false);
  const transcriptRef = useRef([]);
  const endedRef = useRef(false);

  const resetForCall = (id) => {
    setCallLogId(id);
    setTranscript([]); transcriptRef.current = [];
    setInterim({}); setSuggestion(null); setObjection(null);
    setSignals([]); setTalkRatio(null); setQualifyCount(0);
    setDebrief(null); setCoach(null); setConfirmed(false); setDismissed(false);
    endedRef.current = false;
    retriesRef.current = 0;
  };

  // ── Event ingestion ─────────────────────────────────────────────────────
  const handleEvent = useCallback((ev) => {
    switch (ev.type) {
      case 'replay': {
        const finals = [];
        for (const e of ev.events || []) applyEvent(e, finals);
        if (finals.length) {
          transcriptRef.current = finals;
          setTranscript([...finals]);
        }
        if (ev.talk_ratio) setTalkRatio(ev.talk_ratio);
        break;
      }
      default:
        applyEvent(ev);
    }

    function applyEvent(e, replayFinals = null) {
      switch (e.type) {
        case 'transcript':
          if (e.is_final) {
            const line = { speaker: e.speaker, text: e.text, ts: e.ts };
            if (replayFinals) { replayFinals.push(line); }
            else {
              transcriptRef.current = [...transcriptRef.current, line];
              setTranscript(transcriptRef.current);
              setInterim(p => ({ ...p, [e.speaker]: '' }));
            }
          } else if (!replayFinals) {
            setInterim(p => ({ ...p, [e.speaker]: e.text }));
          }
          break;
        case 'suggestion':
          setSuggestion({ tier: e.tier, say_next: e.say_next, play: e.play, risk: e.risk, ts: e.ts });
          if (e.objection?.detected) setObjection({ type: e.objection.type, rebuttal: e.objection.rebuttal });
          break;
        case 'signal':
          if (Array.isArray(e.signals)) setSignals(e.signals);
          if (e.talk_ratio) setTalkRatio(e.talk_ratio);
          break;
        case 'qualify':
          if (Array.isArray(e.updates) && e.updates.length) {
            setQualifyCount(c => c + e.updates.length);
            window.dispatchEvent(new CustomEvent('copilot:qualify', { detail: { updates: e.updates } }));
          }
          break;
        case 'status':
          if (e.state === 'waiting_for_call') setConn('waiting');
          if (e.state === 'context_ready') setConn('live');
          break;
        case 'call_ended':
          endedRef.current = true;
          setDebrief({
            summary: e.summary || null,
            signals: e.signals || [],
            talk_ratio: e.talk_ratio || null,
          });
          setConn('idle');
          break;
        default:
          break;
      }
    }
  }, []);

  // ── WebSocket lifecycle ─────────────────────────────────────────────────
  const connect = useCallback(async (id) => {
    if (!id) return;
    setConn('connecting');

    try {
      if (!tokenRef.current) {
        const res = await base44.functions.invoke('copilotCockpitToken', {});
        const data = res?.data ?? res;
        if (!data?.configured || !data?.token) { setConn('offline'); return; }
        tokenRef.current = { token: data.token, relay: data.relay_ws };
      }
      const { token, relay } = tokenRef.current;
      const ws = new WebSocket(`${relay}/cockpit?call_log_id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => { retriesRef.current = 0; setConn('live'); };
      ws.onmessage = (m) => {
        try { handleEvent(JSON.parse(m.data)); } catch (_) { /* ignore bad frame */ }
      };
      ws.onclose = () => {
        wsRef.current = null;
        if (endedRef.current) return; // clean end — debrief showing
        if (retriesRef.current < 6) {
          retriesRef.current += 1;
          setConn('reconnecting');
          setTimeout(() => connect(id), Math.min(800 * 2 ** retriesRef.current, 8000));
        } else {
          setConn('offline');
        }
      };
      ws.onerror = () => { /* onclose handles retry */ };
    } catch (_) {
      setConn('offline');
    }
  }, [handleEvent]);

  // ── Listen for calls started by the dialer ──────────────────────────────
  useEffect(() => {
    const onCall = (e) => {
      const d = e.detail || {};
      if (landlordId && d.landlordId && d.landlordId !== landlordId) return;
      if (d.phase === 'started' && d.callLogId) {
        resetForCall(d.callLogId);
        connect(d.callLogId);
      }
      // 'ended' from the dialer is a hint only — the relay's call_ended event
      // carries the debrief; if the relay is offline we just stop showing live UI.
      if (d.phase === 'ended' && !endedRef.current) {
        setTimeout(() => {
          if (!endedRef.current) { setConn('idle'); }
        }, 4000);
      }
    };
    window.addEventListener('copilot:call', onCall);
    return () => {
      window.removeEventListener('copilot:call', onCall);
      try { wsRef.current?.close(); } catch (_) { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landlordId, connect]);

  // Auto-scroll transcript (pause on hover)
  useEffect(() => {
    if (scrollRef.current && !hoverRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, interim]);

  // ── Confirm All (debrief) ───────────────────────────────────────────────
  const confirmAll = async () => {
    if (!landlordId || confirming) return;
    setConfirming(true);
    try {
      const pending = await base44.entities.CallQualification.filter(
        { landlord_id: landlordId, confirmation_status: 'pending_confirmation' }, '-call_date', 1
      );
      const q = pending?.[0];
      if (q) {
        await base44.entities.CallQualification.update(q.id, { confirmation_status: 'confirmed' });
        base44.functions.invoke('landlordOrchestrator', { landlord_id: landlordId, force: true }).catch(() => {});
        base44.functions.invoke('generateCallReport', {
          landlord_id: landlordId,
          qualification: q,
          agent_email: q.agent_email || '',
          agent_name: '',
        }).catch(() => {});
      }
      setConfirmed(true);
    } catch (_) { /* leave button re-tappable */ }
    setConfirming(false);
  };

  const runCoach = async () => {
    if (coachLoading || !landlordId) return;
    setCoachLoading(true);
    try {
      const text = transcriptRef.current.map(t => `[${t.speaker.toUpperCase()}] ${t.text}`).join('\n');
      const res = await base44.functions.invoke('landlordConversationCoach', {
        landlord_id: landlordId, conversation_text: text || (debrief?.summary || ''), conversation_type: 'call',
      });
      const data = res?.data ?? res;
      if (data?.coaching) setCoach(data.coaching);
    } catch (_) { /* non-fatal */ }
    setCoachLoading(false);
  };

  // ── Render helpers ──────────────────────────────────────────────────────
  const dot = {
    live: { c: '#34d399', label: 'Copilot live' },
    connecting: { c: '#fbbf24', label: 'Connecting…' },
    reconnecting: { c: '#fbbf24', label: 'Reconnecting…' },
    waiting: { c: '#fbbf24', label: 'Waiting for call…' },
    offline: { c: '#f87171', label: 'Copilot offline — call unaffected' },
    idle: { c: 'rgba(255,255,255,0.25)', label: '' },
  }[conn];

  const isLive = ['live', 'connecting', 'reconnecting', 'waiting'].includes(conn);
  const agentPct = talkRatio?.agent_pct ?? 0;
  const agentHot = agentPct > 60;

  if (dismissed || (!isLive && !debrief)) return null;

  const card = (extra = {}) => ({
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    ...extra,
  });

  return (
    <div className="space-y-2.5 mb-3.5" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @keyframes copilot-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(212,175,55,0.35); } 50% { box-shadow: 0 0 0 6px rgba(212,175,55,0); } }
        @keyframes copilot-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
      `}</style>

      {/* ── Header strip ── */}
      <div className="flex items-center gap-2 px-3 py-2" style={card({ background: `linear-gradient(135deg, ${NAVY}, rgba(212,175,55,0.06))`, border: `1px solid rgba(212,175,55,0.25)` })}>
        <Radio className="w-4 h-4" style={{ color: GOLD }} />
        <span className="text-xs font-bold" style={{ color: GOLD, fontFamily: 'var(--font-display)' }}>
          {debrief ? 'CALL COPILOT — DEBRIEF' : 'LIVE CALL COPILOT'}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {!debrief && (
            <span className="w-2 h-2 rounded-full" style={{ background: dot.c, animation: conn === 'live' ? 'copilot-blink 2s infinite' : 'none' }} />
          )}
          {!debrief && dot.label}
          {debrief && (
            <button onClick={() => setDismissed(true)} className="p-0.5 rounded hover:bg-white/10" title="Dismiss">
              <X className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.5)' }} />
            </button>
          )}
        </span>
      </div>

      {/* ══ LIVE MODE ══ */}
      {!debrief && isLive && (
        <>
          {/* SAY THIS NEXT */}
          <div className="px-3.5 py-3" style={card({
            border: suggestion?.tier === 'strategic' ? `1.5px solid ${GOLD}` : '1px solid rgba(96,165,250,0.3)',
            background: suggestion?.tier === 'strategic' ? 'rgba(212,175,55,0.08)' : 'rgba(96,165,250,0.06)',
            animation: suggestion?.tier === 'strategic' ? 'copilot-pulse 2s infinite' : 'none',
          })}>
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5" style={{ color: suggestion?.tier === 'strategic' ? GOLD : '#60a5fa' }} />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: suggestion?.tier === 'strategic' ? GOLD : '#60a5fa' }}>
                {suggestion?.tier === 'strategic' ? 'Strategic move' : 'Say this next'}
              </span>
            </div>
            <p className="text-[13.5px] font-semibold leading-snug" style={{ color: 'rgba(255,255,255,0.95)' }}>
              {suggestion?.say_next || 'Listening… suggestions appear after the landlord speaks.'}
            </p>
            {suggestion?.play && (
              <p className="text-[10.5px] mt-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>▸ {suggestion.play}</p>
            )}
            {suggestion?.risk && (
              <p className="text-[10px] mt-1 italic" style={{ color: 'rgba(248,113,113,0.7)' }}>Risk: {suggestion.risk}</p>
            )}
          </div>

          {/* Objection alert */}
          {objection && (
            <div className="flex items-start gap-2 px-3 py-2.5" style={card({ background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.4)' })}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-400">Objection · {(objection.type || '').replace(/_/g, ' ')}</p>
                <p className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.85)' }}>{objection.rebuttal}</p>
              </div>
              <button onClick={() => setObjection(null)} className="p-0.5 rounded hover:bg-white/10 shrink-0">
                <X className="w-3.5 h-3.5 text-red-400/70" />
              </button>
            </div>
          )}

          {/* Live transcript */}
          <div
            ref={scrollRef}
            onMouseEnter={() => { hoverRef.current = true; }}
            onMouseLeave={() => { hoverRef.current = false; }}
            className="px-3 py-2.5 space-y-1.5 overflow-y-auto"
            style={card({ maxHeight: 210, minHeight: 90 })}
          >
            {transcript.length === 0 && !interim.agent && !interim.landlord && (
              <p className="text-[11px] italic" style={{ color: 'rgba(255,255,255,0.3)' }}>Transcript will stream here…</p>
            )}
            {transcript.map((t, i) => (
              <div key={i} className={`flex ${t.speaker === 'agent' ? 'justify-end' : 'justify-start'}`}>
                <p className="text-[11.5px] leading-snug max-w-[85%] px-2 py-1 rounded-lg" style={{
                  color: t.speaker === 'agent' ? GOLD : 'rgba(255,255,255,0.88)',
                  background: t.speaker === 'agent' ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.04)',
                }}>{t.text}</p>
              </div>
            ))}
            {['landlord', 'agent'].map(sp => interim[sp] ? (
              <div key={sp} className={`flex ${sp === 'agent' ? 'justify-end' : 'justify-start'}`}>
                <p className="text-[11.5px] leading-snug max-w-[85%] px-2 py-1 rounded-lg" style={{
                  color: sp === 'agent' ? 'rgba(212,175,55,0.45)' : 'rgba(255,255,255,0.4)',
                }}>{interim[sp]}</p>
              </div>
            ) : null)}
          </div>

          {/* Signals bar: talk ratio + chips + qualify counter */}
          <div className="flex items-center gap-2 flex-wrap px-3 py-2" style={card()}>
            <div className="flex items-center gap-1.5" title="Agent talk share">
              <Mic className="w-3 h-3" style={{ color: agentHot ? GOLD : 'rgba(255,255,255,0.4)' }} />
              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${agentPct}%`, background: agentHot ? GOLD : '#60a5fa' }} />
              </div>
              <span className="text-[9.5px] font-semibold" style={{ color: agentHot ? GOLD : 'rgba(255,255,255,0.45)' }}>
                {agentPct}%{agentHot ? ' — let them talk' : ''}
              </span>
            </div>
            {qualifyCount > 0 && (
              <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' }}>
                🧠 {qualifyCount} auto-filled
              </span>
            )}
            {signals.map(s => (
              <span key={s} className="text-[9.5px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(212,175,55,0.12)', color: GOLD, border: '1px solid rgba(212,175,55,0.25)' }}>
                {s.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </>
      )}

      {/* ══ DEBRIEF MODE ══ */}
      {debrief && (
        <div className="space-y-2.5">
          {debrief.summary && (
            <div className="px-3.5 py-3" style={card({ border: `1px solid rgba(212,175,55,0.3)` })}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: GOLD }}>Call summary</p>
              <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>{debrief.summary}</p>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap px-3 py-2" style={card()}>
            {debrief.talk_ratio && (
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                <TrendingUp className="w-3 h-3 inline mr-1" />Talk ratio: agent {debrief.talk_ratio.agent_pct}% / landlord {debrief.talk_ratio.landlord_pct}%
              </span>
            )}
            {(debrief.signals || []).map(s => (
              <span key={s} className="text-[9.5px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(212,175,55,0.12)', color: GOLD, border: '1px solid rgba(212,175,55,0.25)' }}>
                <Flag className="w-2.5 h-2.5 inline mr-0.5" />{s.replace(/_/g, ' ')}
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={confirmAll}
              disabled={confirming || confirmed}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-60"
              style={{
                background: confirmed ? 'rgba(16,185,129,0.18)' : `linear-gradient(180deg, ${GOLD}, #b8942f)`,
                color: confirmed ? '#34d399' : NAVY,
                border: confirmed ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(212,175,55,0.5)',
              }}
            >
              {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : confirmed ? <><CheckCircle2 className="w-3.5 h-3.5" /> Qualification confirmed</>
                : <><CheckCircle2 className="w-3.5 h-3.5" /> Confirm All — save AI qualification</>}
            </button>
            <button
              onClick={runCoach}
              disabled={coachLoading}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold"
              style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' }}
            >
              {coachLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><BrainCircuit className="w-3.5 h-3.5" /> Brain Coach</>}
            </button>
          </div>

          {coach && (
            <div className="px-3.5 py-3 space-y-2" style={card({ border: '1px solid rgba(96,165,250,0.25)' })}>
              {coach.quality_score != null && (
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#60a5fa' }}>
                  Call quality: {coach.quality_score}/10
                </p>
              )}
              {(coach.things_done_well || []).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-emerald-400 mb-0.5">✓ What went well</p>
                  {coach.things_done_well.map((t, i) => <p key={i} className="text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>· {t}</p>)}
                </div>
              )}
              {(coach.missed_opportunities || []).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-amber-400 mb-0.5">△ Missed</p>
                  {coach.missed_opportunities.map((t, i) => <p key={i} className="text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>· {t}</p>)}
                </div>
              )}
              {coach.next_move_recommended && (
                <p className="text-[11px] font-semibold" style={{ color: GOLD }}>▸ Next move: {coach.next_move_recommended}</p>
              )}
              {coach.single_best_line_to_use && (
                <p className="text-[11px] italic" style={{ color: 'rgba(255,255,255,0.6)' }}>"{coach.single_best_line_to_use}"</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
