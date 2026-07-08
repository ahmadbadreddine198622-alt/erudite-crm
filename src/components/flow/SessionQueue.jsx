// SessionQueue — left panel of the Flow command center.
// Shows a "Start Session" button that builds a ranked work queue, then lists
// landlords with position/progress and unread indicators.

import React from 'react';
import { Loader2, Play, Zap, AlertCircle, ChevronRight } from 'lucide-react';

const STAGE_COLORS = {
  initial_contact: '#60a5fa', attempted_to_contact: '#60a5fa',
  price_discovery: '#fbbf24', listing_commitment: '#fbbf24',
  form_a_initiation: '#a78bfa', form_a_signing: '#a78bfa',
  owner_documents: '#f59e0b', photos_videos: '#f59e0b',
  listing_creation: '#34d399', listing_publication: '#34d399',
  deal_closed: '#10b981',
};

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

export default function SessionQueue({ queue, currentIndex, loading, onStart, onSelect, sessionActive }) {
  if (loading) {
    return (
      <div style={css("display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:12px; padding:24px;")}>
        <Loader2 className="animate-spin" style={{ color: 'hsl(38 92% 50%)' }} size={28} />
        <span style={css("font-size:12px; color:rgba(255,255,255,0.5); font-family:'Inter',sans-serif;")}>Building your work queue…</span>
      </div>
    );
  }

  if (!sessionActive || queue.length === 0) {
    return (
      <div style={css("display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:16px; padding:24px;")}>
        <div style={css("width:52px; height:52px; border-radius:14px; background:linear-gradient(135deg, hsl(38 92% 50%), hsl(38 92% 42%)); display:flex; align-items:center; justify-content:center; box-shadow:0 8px 24px rgba(245,158,11,0.3);")}>
          <Play size={24} style={{ color: '#1a1205' }} />
        </div>
        <div style={css("text-align:center;")}>
          <div style={css("font-size:14px; font-weight:700; color:rgba(255,255,255,0.9); font-family:'Inter',sans-serif; margin-bottom:4px;")}>Landlord Comms Session</div>
          <div style={css("font-size:11px; color:rgba(255,255,255,0.4); line-height:1.5; max-width:220px;")}>Build a ranked queue of landlords needing attention — AI strike-now leads first, then unanswered inbound, then by urgency.</div>
        </div>
        <button onClick={onStart}
          style={css("display:inline-flex; align-items:center; gap:8px; padding:9px 20px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%)); color:#1a1205; border:1px solid hsl(38 92% 50% / 0.5); box-shadow:0 4px 16px rgba(245,158,11,0.25);")}>
          <Zap size={15} /> Start Session
        </button>
      </div>
    );
  }

  return (
    <div style={css("display:flex; flex-direction:column; height:100%;")}>
      {/* Progress header */}
      <div style={css("padding:12px 14px; border-bottom:1px solid rgba(255,255,255,0.08); flex:none;")}>
        <div style={css("display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;")}>
          <span style={css("font-size:11px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.5); font-family:'Inter',sans-serif;")}>Session Queue</span>
          <span style={css("font-size:12px; font-weight:700; color:hsl(38 92% 60%); font-family:'Inter',sans-serif;")}>{currentIndex + 1} of {queue.length}</span>
        </div>
        <div style={css("height:3px; border-radius:99px; background:rgba(255,255,255,0.08); overflow:hidden;")}>
          <div style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, hsl(38 92% 50%), hsl(38 92% 60%))', width: `${((currentIndex + 1) / queue.length) * 100}%`, transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {/* Queue list */}
      <div style={css("flex:1; overflow-y:auto; padding:4px;")}>
        {queue.map((ll, idx) => {
          const isActive = idx === currentIndex;
          const isPast = idx < currentIndex;
          const color = STAGE_COLORS[ll.stage] || '#8a93ab';
          const name = ll.full_name_en || ll.full_name || ll.first_name || 'Unknown';
          const stageLabel = (ll.stage || '').replace(/_/g, ' ');
          return (
            <button key={ll.id} type="button" onClick={() => onSelect(idx)}
              style={css("display:flex; align-items:center; gap:9px; width:100%; padding:9px 11px; border-radius:10px; cursor:pointer; font-family:'Inter',sans-serif; text-align:left; margin-bottom:2px; transition:background 0.12s;")}
              {...(isActive ? {} : {})}>
              <div style={css("display:flex; flex-direction:column; align-items:center; gap:1px; flex:none; width:28px;")}>
                <span style={{ fontSize: isActive ? 13 : 12, fontWeight: 700, color: isActive ? 'hsl(38 92% 60%)' : isPast ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.5)' }}>{idx + 1}</span>
                {isPast && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>✓</span>}
                {ll._unread && !isPast && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa', flex: 'none' }} />}
              </div>
              <div style={css("flex:1; min-width:0;")}>
                <div style={css("display:flex; align-items:center; gap:5px;")}>
                  {ll.ai_strike_now && <Zap size={10} style={{ color: '#fbbf24', flex: 'none' }} />}
                  <span style={{ fontSize: 12, fontWeight: 600, color: isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                </div>
                <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.35)', textTransform: 'capitalize' }}>{stageLabel}</span>
              </div>
              {isActive && <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.4)', flex: 'none' }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}