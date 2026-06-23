import React, { useState } from 'react';

/* Convert a CSS declaration string into a React style object. */
function css(str) {
  const o = {};
  String(str).split(";").forEach((decl) => {
    const i = decl.indexOf(":");
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) return;
    const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    o[camel] = v;
  });
  return o;
}

function relativeTime(iso) {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/* Score pill colour: ≥67 green, 34-66 amber, ≤33 red. */
function scorePillMeta(val) {
  if (val >= 67) return { color: '#34d399', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)' };
  if (val >= 34) return { color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.15)', border: 'hsl(38 92% 50% / 0.3)' };
  return { color: '#f87171', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)' };
}

const PRIORITY_META = {
  urgent: { color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)' },
  high: { color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.1)', border: 'hsl(38 92% 50% / 0.3)' },
  medium: { color: '#93c5fd', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)' },
  low: { color: 'rgba(255,255,255,0.6)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.12)' },
};

function ScorePill({ label, value, suffix, rationale }) {
  const [showTip, setShowTip] = useState(false);
  if (value == null) return null;
  const c = scorePillMeta(value);
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => rationale && setShowTip(s => !s)}
        onMouseEnter={() => rationale && setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        style={css("display:inline-flex; align-items:baseline; gap:3px; padding:3px 9px; borderRadius:99px; fontSize:11px; fontWeight:700; background:"+c.bg+"; border:1px solid "+c.border+"; color:"+c.color+"; cursor:"+(rationale ? 'pointer' : 'default')+"; fontFamily:'Inter',sans-serif; whiteSpace:nowrap;")}
      >
        <span style={css("fontSize:9px; textTransform:uppercase; letterSpacing:0.04em; opacity:0.7;")}>{label}</span>
        <span style={css("fontSize:13px;")}>{value}{suffix}</span>
      </button>
      {showTip && rationale && (
        <div style={css("position:absolute; top:100%; right:0; marginTop:4px; maxWidth:220px; padding:7px 10px; borderRadius:8px; background:rgba(15,20,35,0.97); border:1px solid rgba(255,255,255,0.12); fontSize:11px; lineHeight:1.4; color:rgba(255,255,255,0.75); zIndex:10; boxShadow:0 8px 24px rgba(0,0,0,0.5);")}>
          {rationale}
        </div>
      )}
    </div>
  );
}

export default function AIIntelligenceCard({ ai, analyzing, onReanalyse }) {
  const hasSummary = !!ai.summary;
  const nba = ai.nextBestAction;
  const hasNba = nba && typeof nba === 'object' && (nba.action || nba.reasoning);
  const hasCoaching = !!ai.coaching;
  const hasObjections = Array.isArray(ai.objections) && ai.objections.length > 0;
  const hasTrust = ai.trust != null;
  const hasUrgency = ai.urgency != null;
  const hasWin = ai.win != null;
  const hasScores = hasTrust || hasUrgency || hasWin;
  const hasMomentum = !!ai.momentum;
  const priority = nba && typeof nba.priority === 'string' ? nba.priority.toLowerCase() : '';
  const pMeta = PRIORITY_META[priority] || PRIORITY_META.medium;

  return (
    <div style={css("flex:none; margin:0 16px 10px; border-radius:16px; border:1px solid hsl(38 92% 50% / 0.28); background:linear-gradient(180deg, hsl(38 92% 50% / 0.07), rgba(255,255,255,0.02)); overflow:hidden; animation: ld-rise 0.4s cubic-bezier(0.22,1,0.36,1) both;")}>
      {analyzing && (
        <div style={css("display:flex; align-items:center; gap:6px; padding:7px 15px; background:hsl(38 92% 50% / 0.08); border-bottom:1px solid hsl(38 92% 50% / 0.15); font-size:11px; color:hsl(38 92% 62%);")}>
          <div style={css("display:inline-block; width:12px; height:12px; border:2px solid hsl(38 92% 50% / 0.25); border-top-color:hsl(38 92% 55%); border-radius:50%; animation: ld-spin 0.8s linear infinite;")}></div>
          Re-analysing… showing last result
        </div>
      )}

      <div style={css("padding:14px 15px;")}>
        {/* Header row */}
        <div style={css("display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; flex-wrap:wrap;")}>
          <span style={css("font-size:10.5px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:rgba(255,255,255,0.5);")}>AI Intelligence</span>
          <div style={css("display:flex; align-items:center; gap:6px; flex-wrap:wrap;")}>
            {hasScores && (
              <div style={css("display:flex; align-items:center; gap:5px;")}>
                {hasTrust && <ScorePill label="Trust" value={ai.trust} rationale={ai.trustRationale} />}
                {hasUrgency && <ScorePill label="Urgency" value={ai.urgency} rationale={ai.urgencyRationale} />}
                {hasWin && <ScorePill label="Win" value={ai.win} suffix="%" rationale={ai.winRationale} />}
              </div>
            )}
            {hasMomentum && (
              <span style={css("display:inline-flex; align-items:center; padding:3px 9px; borderRadius:99px; fontSize:10.5px; fontWeight:600; background:rgba(139,92,246,0.12); border:1px solid rgba(139,92,246,0.25); color:#c4b5fd; whiteSpace:nowrap;")}>
                Momentum: {ai.momentum}
              </span>
            )}
            {ai.strikeNow && (
              <span title={ai.strikeText || undefined} style={css("display:inline-flex; align-items:center; gap:4px; padding:3px 11px; borderRadius:99px; fontSize:10.5px; font-weight:800; letter-spacing:0.04em; background:linear-gradient(135deg, hsl(38 92% 55%), hsl(38 92% 48%)); border:1px solid hsl(38 92% 60%); color:#1a1205; box-shadow:0 0 12px hsl(38 92% 50% / 0.4); whiteSpace:nowrap;")}>
                ⚡ STRIKE NOW
              </span>
            )}
          </div>
        </div>

        {/* Summary */}
        {hasSummary && (
          <p style={css("margin:0 0 12px; font-size:13px; line-height:1.55; color:rgba(255,255,255,0.82);")}>{ai.summary}</p>
        )}

        {/* Next Best Action */}
        {hasNba && (
          <div style={css("margin-bottom:12px; padding:10px 13px; border-radius:11px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-left:3px solid "+pMeta.color+";")}>
            <div style={css("display:flex; align-items:center; gap:8px; flex-wrap:wrap;")}>
              <span style={css("font-size:13.5px; font-weight:700; color:rgba(255,255,255,0.92);")}>{nba.action || nba.reasoning}</span>
              {priority && (
                <span style={css("display:inline-flex; align-items:center; padding:2px 8px; borderRadius:99px; fontSize:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; background:"+pMeta.bg+"; border:1px solid "+pMeta.border+"; color:"+pMeta.color+";")}>{priority}</span>
              )}
            </div>
            {nba.reasoning && nba.action && (
              <p style={css("margin:5px 0 0; font-size:12px; line-height:1.45; color:rgba(255,255,255,0.55);")}>{nba.reasoning}</p>
            )}
          </div>
        )}

        {/* Coaching */}
        {hasCoaching && (
          <div style={css("margin-bottom:12px;")}>
            <span style={css("display:block; font-size:9.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,255,255,0.38); margin-bottom:4px;")}>Coaching</span>
            <p style={css("margin:0; font-size:12.5px; line-height:1.5; color:rgba(255,255,255,0.72);")}>{ai.coaching}</p>
          </div>
        )}

        {/* Objections */}
        {hasObjections && (
          <div style={css("margin-bottom:10px;")}>
            <span style={css("display:block; font-size:9.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#fca5a5; margin-bottom:6px;")}>Objections</span>
            <div style={css("display:flex; flex-wrap:wrap; gap:6px;")}>
              {ai.objections.map((ob, i) => (
                <span key={i} style={css("display:inline-flex; align-items:center; gap:4px; padding:4px 9px; borderRadius:99px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); font-size:10.5px; color:#fca5a5;")}>⚑ {ob}</span>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={css("display:flex; align-items:center; justify-content:space-between; gap:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.06);")}>
          <span style={css("font-size:10px; color:rgba(255,255,255,0.38);")}>
            {ai.analysedAt ? 'Analysed ' + relativeTime(ai.analysedAt) : ''}
          </span>
          <button onClick={onReanalyse} disabled={analyzing} style={css("display:inline-flex; align-items:center; gap:5px; padding:5px 12px; borderRadius:99px; border:1px solid hsl(38 92% 50% / 0.45); background:hsl(38 92% 50% / 0.12); color:hsl(38 92% 62%); font-size:10.5px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; opacity:"+(analyzing ? 0.6 : 1)+";")}>
            <span style={css("display:inline-block; "+(analyzing ? "animation: ld-spin 0.8s linear infinite;" : "")+"")}>↻</span> {analyzing ? 'Re-analysing…' : 'Re-analyse'}
          </button>
        </div>
      </div>
    </div>
  );
}