// Flow — Landlord Comms Command Center.
// Three-zone desktop layout (queue | conversation | AI dock), swipeable on mobile.
// Start Session builds a ranked work queue; Next/Prev + arrow keys navigate
// without page reloads. All sending reuses existing send functions.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchAllRecords } from '@/api/fetchAll';
import { toast } from 'sonner';
import SessionQueue from '@/components/flow/SessionQueue';
import UnifiedThread from '@/components/flow/UnifiedThread';
import FlowComposer from '@/components/flow/FlowComposer';
import AiCopilotDock from '@/components/flow/AiCopilotDock';
import VerdictBar from '@/components/flow/VerdictBar';
import UnmatchedInbox from '@/components/flow/UnmatchedInbox';
import { ChevronLeft, ChevronRight, Inbox, Layout, CheckCircle2, Clock, AlertTriangle, X } from 'lucide-react';

function css(str) {
  const o = {};
  String(str).split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) return;
    o[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  });
  return o;
}

function normalizeDirection(raw) {
  if (raw === 'incoming' || raw === 'inbound') return 'inbound';
  if (raw === 'outgoing' || raw === 'outbound') return 'outbound';
  return 'outbound';
}

export default function Flow() {
  const [tab, setTab] = useState('session');
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [totals, setTotals] = useState({ handled: 0, snoozed: 0, escalated: 0 });
  const [thread, setThread] = useState([]);
  const [aiDraft, setAiDraft] = useState({ text: '', messageAiSource: null, messageAiDraft: null, onClear: () => setAiDraft({ text: '', messageAiSource: null, messageAiDraft: null, onClear: () => {} }) });
  const [mobilePanel, setMobilePanel] = useState('center'); // 'left' | 'center' | 'right'

  const currentLandlord = queue[currentIndex] || null;

  // ── Build the work queue ──
  const startSession = async () => {
    setLoading(true);
    setSessionActive(false);
    setSessionEnded(false);
    setTotals({ handled: 0, snoozed: 0, escalated: 0 });
    try {
      // Fetch landlords
      const landlords = await fetchAllRecords(base44.entities.Landlord, '-created_date').catch(() => []);

      // Fetch recent messages across all channels to determine unanswered status
      const [messages, imessages, tgrams, emails] = await Promise.all([
        base44.entities.Message.list('-timestamp', 500).catch(() => []),
        base44.entities.IMessage.list('-sent_at', 500).catch(() => []),
        base44.entities.TelegramMessage.list('-sent_at', 500).catch(() => []),
        base44.entities.Email.list('-received_at', 500).catch(() => []),
      ]);

      // Build landlord_id → { latestTs, latestDir, unread } map
      const latestByLandlord = new Map();
      const allMsgs = [
        ...messages.map(m => ({ lid: m.landlord_id, ts: m.timestamp, dir: normalizeDirection(m.direction), deleted: m.is_deleted })),
        ...imessages.map(m => ({ lid: m.landlord_id, ts: m.sent_at, dir: normalizeDirection(m.direction), deleted: false })),
        ...tgrams.map(m => ({ lid: m.landlord_id, ts: m.sent_at, dir: normalizeDirection(m.direction), deleted: false })),
        ...emails.map(m => ({ lid: m.landlord_id, ts: m.received_at, dir: normalizeDirection(m.direction), deleted: false })),
      ].filter(m => m.lid && !m.deleted);

      for (const m of allMsgs) {
        const existing = latestByLandlord.get(m.lid);
        if (!existing || new Date(m.ts || 0) > new Date(existing.ts || 0)) {
          latestByLandlord.set(m.lid, { ts: m.ts, dir: m.dir });
        }
      }

      // Rank: ai_strike_now first, then unanswered inbound, then urgency_score desc
      const ranked = landlords
        .map(l => {
          const latest = latestByLandlord.get(l.id);
          const unanswered = latest && latest.dir === 'inbound';
          return { ...l, _latest: latest, _unread: unanswered };
        })
        .sort((a, b) => {
          if (a.ai_strike_now && !b.ai_strike_now) return -1;
          if (!a.ai_strike_now && b.ai_strike_now) return 1;
          const aUn = a._unread ? 1 : 0;
          const bUn = b._unread ? 1 : 0;
          if (aUn !== bUn) return bUn - aUn;
          if (a._latest && b._latest) return new Date(b._latest.ts || 0) - new Date(a._latest.ts || 0);
          if (a._latest && !b._latest) return -1;
          if (!a._latest && b._latest) return 1;
          return (b.urgency_score || 0) - (a.urgency_score || 0);
        });

      setQueue(ranked);
      setCurrentIndex(0);
      setSessionActive(true);
      setSessionEnded(false);
      toast.success(`Session started — ${ranked.length} landlords queued`);
    } catch (e) {
      toast.error('Failed to build queue: ' + (e?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  // ── Navigation ──
  const goTo = useCallback((idx) => {
    if (idx < 0 || idx >= queue.length) return;
    setCurrentIndex(idx);
    setThread([]);
    setAiDraft({ text: '', messageAiSource: null, messageAiDraft: null, onClear: () => setAiDraft({ text: '', messageAiSource: null, messageAiDraft: null, onClear: () => {} }) });
    setMobilePanel('center');
  }, [queue.length]);

  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);
  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);

  // ── Keyboard navigation (arrow keys) ──
  useEffect(() => {
    const handler = (e) => {
      if (tab !== 'session' || !sessionActive || sessionEnded) return;
      // Don't trigger when typing in an input/textarea
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tab, sessionActive, sessionEnded, goNext, goPrev]);

  // ── Verdict actions ──
  const handleDone = () => {
    setTotals(t => ({ ...t, handled: t.handled + 1 }));
    if (currentIndex + 1 >= queue.length) {
      setSessionEnded(true);
    } else {
      goNext();
    }
  };

  const handleSnooze = () => {
    setTotals(t => ({ ...t, snoozed: t.snoozed + 1 }));
    if (currentIndex + 1 >= queue.length) {
      setSessionEnded(true);
    } else {
      goNext();
    }
  };

  const handleEscalate = () => {
    setTotals(t => ({ ...t, escalated: t.escalated + 1 }));
    if (currentIndex + 1 >= queue.length) {
      setSessionEnded(true);
    } else {
      goNext();
    }
  };

  const endSession = () => {
    setSessionEnded(true);
  };

  // ── AI suggestion pickup ──
  const pickSuggestion = (text, meta) => {
    setAiDraft({
      text,
      messageAiSource: 'landlordOrchestrator.ai_suggested_messages',
      messageAiDraft: text,
      onClear: () => setAiDraft({ text: '', messageAiSource: null, messageAiDraft: null, onClear: () => {} }),
    });
    setMobilePanel('center');
  };

  // ── Thread loaded callback ──
  const onThreadLoaded = (items) => {
    setThread(items);
  };

  // ── Session end screen ──
  if (sessionEnded) {
    return (
      <div className="page-root page-enter" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={css("text-center; max-width:400px;")}>
          <div style={css("width:60px; height:60px; border-radius:18px; background:linear-gradient(135deg, hsl(38 92% 50%), hsl(38 92% 42%)); display:flex; align-items:center; justify-content:center; margin:0 auto 18px; box-shadow:0 12px 32px rgba(245,158,11,0.3);")}>
            <CheckCircle2 size={30} style={{ color: '#1a1205' }} />
          </div>
          <h1 style={css("font-size:22px; font-weight:700; color:rgba(255,255,255,0.95); font-family:'Inter',sans-serif; margin-bottom:6px;")}>Session Complete</h1>
          <p style={css("font-size:13px; color:rgba(255,255,255,0.4); margin-bottom:24px; font-family:'Inter',sans-serif;")}>You worked through {currentIndex} of {queue.length} landlords.</p>
          <div style={css("display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:24px;")}>
            <div style={css("border-radius:12px; padding:14px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.2);")}>
              <CheckCircle2 size={18} style={{ color: '#34d399', margin: '0 auto 6px' }} />
              <div style={css("font-size:22px; font-weight:700; color:#34d399; font-family:'Inter',sans-serif;")}>{totals.handled}</div>
              <div style={css("font-size:9px; font-weight:600; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.04em;")}>Handled</div>
            </div>
            <div style={css("border-radius:12px; padding:14px; background:rgba(96,165,250,0.1); border:1px solid rgba(96,165,250,0.2);")}>
              <Clock size={18} style={{ color: '#93c5fd', margin: '0 auto 6px' }} />
              <div style={css("font-size:22px; font-weight:700; color:#93c5fd; font-family:'Inter',sans-serif;")}>{totals.snoozed}</div>
              <div style={css("font-size:9px; font-weight:600; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.04em;")}>Snoozed</div>
            </div>
            <div style={css("border-radius:12px; padding:14px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2);")}>
              <AlertTriangle size={18} style={{ color: '#f87171', margin: '0 auto 6px' }} />
              <div style={css("font-size:22px; font-weight:700; color:#f87171; font-family:'Inter',sans-serif;")}>{totals.escalated}</div>
              <div style={css("font-size:9px; font-weight:600; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.04em;")}>Escalated</div>
            </div>
          </div>
          <div style={css("display:flex; gap:8px; justify-content:center;")}>
            <button onClick={() => { setSessionActive(false); setSessionEnded(false); setQueue([]); }}
              style={css("display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.7); border:1px solid rgba(255,255,255,0.12);")}>
              <Layout size={15} /> New Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-root page-enter" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={css("flex:none; display:flex; align-items:center; justify-content:space-between; padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.08); background:rgba(15,23,42,0.6); backdrop-filter:blur(12px);")}>
        <div style={css("display:flex; align-items:center; gap:10px;")}>
          <div style={css("width:32px; height:32px; border-radius:9px; background:linear-gradient(135deg, hsl(38 92% 50%), hsl(38 92% 42%)); display:flex; align-items:center; justify-content:center;")}>
            <Layout size={16} style={{ color: '#1a1205' }} />
          </div>
          <span style={css("font-size:15px; font-weight:700; color:rgba(255,255,255,0.95); font-family:'Inter',sans-serif;")}>Flow</span>
          <span style={css("font-size:11px; color:rgba(255,255,255,0.35); font-family:'Inter',sans-serif;")}>Command Center</span>
        </div>
        {/* Tabs */}
        <div style={css("display:flex; align-items:center; gap:4px; padding:3px; border-radius:10px; background:rgba(255,255,255,0.04);")}>
          <button onClick={() => setTab('session')} style={css("display:inline-flex; align-items:center; gap:5px; padding:4px 11px; border-radius:7px; font-size:11px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; border:none; transition:background 0.12s;" + (tab === 'session' ? 'background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.9);' : 'background:transparent; color:rgba(255,255,255,0.5);'))}>
            <Layout size={12} /> Session
          </button>
          <button onClick={() => setTab('unmatched')} style={css("display:inline-flex; align-items:center; gap:5px; padding:4px 11px; border-radius:7px; font-size:11px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; border:none; transition:background 0.12s;" + (tab === 'unmatched' ? 'background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.9);' : 'background:transparent; color:rgba(255,255,255,0.5);'))}>
            <Inbox size={12} /> Unmatched
          </button>
        </div>
        {sessionActive && tab === 'session' && (
          <button onClick={endSession} style={css("display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:7px; font-size:10.5px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(239,68,68,0.1); color:#f87171; border:1px solid rgba(239,68,68,0.2);")}>
            <X size={11} /> End Session
          </button>
        )}
      </div>

      {/* Content */}
      {tab === 'unmatched' ? (
        <UnmatchedInbox />
      ) : (
        <>
          {/* Mobile panel switcher */}
          <div style={css("flex:none; display:flex; align-items:center; gap:2px; padding:4px; border-bottom:1px solid rgba(255,255,255,0.06); md:hidden;")}>
            {['left', 'center', 'right'].map(p => (
              <button key={p} onClick={() => setMobilePanel(p)} style={css("flex:1; padding:5px; border-radius:6px; font-size:10px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; border:none; text-transform:capitalize;" + (mobilePanel === p ? 'background:rgba(255,255,255,0.08); color:hsl(38 92% 60%);' : 'background:transparent; color:rgba(255,255,255,0.35);'))}>
                {p === 'left' ? 'Queue' : p === 'center' ? 'Chat' : 'AI'}
              </button>
            ))}
          </div>

          {/* Three-zone layout */}
          <div style={css("flex:1; display:flex; overflow:hidden;")}>
            {/* Left — Session Queue */}
            <div style={css("width:280px; flex:none; border-right:1px solid rgba(255,255,255,0.08); overflow:hidden;" + (mobilePanel === 'left' ? 'display:flex;' : 'display:none;') + 'md:flex;')}>
              <SessionQueue queue={queue} currentIndex={currentIndex} loading={loading} onStart={startSession} onSelect={goTo} sessionActive={sessionActive} />
            </div>

            {/* Center — Conversation */}
            <div style={css("flex:1; display:flex; flex-direction:column; min-width:0; overflow:hidden;" + (mobilePanel === 'center' ? 'display:flex;' : 'display:none;') + 'md:flex;')}>
              {/* Landlord header + nav */}
              {currentLandlord && (
                <div style={css("flex:none; display:flex; align-items:center; gap:8px; padding:8px 14px; border-bottom:1px solid rgba(255,255,255,0.06);")}>
                  <button onClick={goPrev} disabled={currentIndex === 0} style={css("display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:7px; cursor:pointer; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); opacity:" + (currentIndex === 0 ? '0.3;' : '1;'))}>
                    <ChevronLeft size={15} style={{ color: 'rgba(255,255,255,0.6)' }} />
                  </button>
                  <div style={css("flex:1; min-width:0;")}>
                    <div style={css("font-size:13px; font-weight:700; color:rgba(255,255,255,0.9); font-family:'Inter',sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;")}>{currentLandlord.full_name_en || currentLandlord.full_name || 'Unknown'}</div>
                    <div style={css("font-size:10px; color:rgba(255,255,255,0.35); font-family:'Inter',sans-serif; text-transform:capitalize;")}>{(currentLandlord.stage || '').replace(/_/g, ' ') || 'no stage'}</div>
                  </div>
                  <button onClick={goNext} disabled={currentIndex + 1 >= queue.length} style={css("display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:7px; cursor:pointer; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); opacity:" + (currentIndex + 1 >= queue.length ? '0.3;' : '1;'))}>
                    <ChevronRight size={15} style={{ color: 'rgba(255,255,255,0.6)' }} />
                  </button>
                </div>
              )}
              {/* Thread */}
              {currentLandlord && (
                <UnifiedThread landlordId={currentLandlord.id} onThreadLoaded={onThreadLoaded} />
              )}
              {/* Composer */}
              {currentLandlord && (
                <FlowComposer landlord={currentLandlord} thread={thread} onSent={() => {}} aiDraftFields={{ ...aiDraft, onClear: () => setAiDraft({ text: '', messageAiSource: null, messageAiDraft: null, onClear: () => {} }) }} />
              )}
              {/* Verdict bar */}
              {currentLandlord && (
                <VerdictBar landlord={currentLandlord} onDone={handleDone} onSnooze={handleSnooze} onEscalate={handleEscalate} />
              )}
            </div>

            {/* Right — AI Co-Pilot Dock */}
            <div style={css("width:300px; flex:none; border-left:1px solid rgba(255,255,255,0.08); overflow:hidden;" + (mobilePanel === 'right' ? 'display:flex;' : 'display:none;') + 'md:flex;')}>
              {currentLandlord ? (
                <AiCopilotDock landlord={currentLandlord} onPickSuggestion={pickSuggestion} />
              ) : (
                <div style={css("display:flex; align-items:center; justify-content:center; height:100%;")}>
                  <span style={css("font-size:11px; color:rgba(255,255,255,0.25); font-family:'Inter',sans-serif;")}>Select a landlord</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}