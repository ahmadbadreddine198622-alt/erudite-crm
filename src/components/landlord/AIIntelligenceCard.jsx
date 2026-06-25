import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

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

/* Pipeline design tokens — keep the whole AI Intelligence cluster on one palette. */
const GOLD = '#C9A24B';
const GOLD_SOFT = '#C9A961';
const FONT_TITLE = "'Cormorant Garamond', serif";
const FONT_BODY = "'Montserrat', sans-serif";

/* Score pill colour — VALUE-BASED per the pipeline design system:
   <40 → red, 40–69 → amber, ≥70 → green. Fill 12% opacity, border 30%, text full strength.
   mandate_win_probability is already converted to a 0–100 percentage upstream, so the same
   thresholds apply to all three pills. Type-guarded: null/NaN falls back to neutral grey. */
function scorePillMeta(value) {
  if (value == null || isNaN(value)) return { color: 'hsl(222 10% 60%)', bg: 'hsl(222 10% 60% / 0.12)', border: 'hsl(222 10% 60% / 0.3)' };
  if (value >= 70) return { color: 'hsl(142 71% 45%)', bg: 'hsl(142 71% 45% / 0.12)', border: 'hsl(142 71% 45% / 0.3)' };
  if (value >= 40) return { color: 'hsl(38 92% 50%)', bg: 'hsl(38 92% 50% / 0.12)', border: 'hsl(38 92% 50% / 0.3)' };
  return { color: 'hsl(0 72% 51%)', bg: 'hsl(0 72% 51% / 0.12)', border: 'hsl(0 72% 51% / 0.3)' };
}

// Momentum pill (free-text) — building → green, slowing → amber, stalled → red,
// anything else / null → grey. Never crashes on an unexpected string.
function momentumPillMeta(momentum) {
  const s = String(momentum || '').toLowerCase();
  if (/build|grow|acceler|surg|gain|strong|active|hot|warm|rising/.test(s)) return { color: 'hsl(142 71% 45%)', bg: 'hsl(142 71% 45% / 0.12)', border: 'hsl(142 71% 45% / 0.3)' };
  if (/slow|cool|soft|ebb|fad/.test(s)) return { color: 'hsl(38 92% 50%)', bg: 'hsl(38 92% 50% / 0.12)', border: 'hsl(38 92% 50% / 0.3)' };
  if (/stall|stuck|stagnant|cold|dead|dormant|lost|declin|drop|stale/.test(s)) return { color: 'hsl(0 72% 51%)', bg: 'hsl(0 72% 51% / 0.12)', border: 'hsl(0 72% 51% / 0.3)' };
  return { color: 'hsl(222 10% 60%)', bg: 'hsl(222 10% 60% / 0.12)', border: 'hsl(222 10% 60% / 0.3)' };
}

// Priority scale (design-system tokens): urgent = red, high = amber, medium = blue, low = grey.
const PRIORITY_META = {
  urgent: { color: 'hsl(0 72% 51%)', bg: 'hsl(0 72% 51% / 0.12)', border: 'hsl(0 72% 51% / 0.3)' },
  high: { color: 'hsl(38 92% 50%)', bg: 'hsl(38 92% 50% / 0.12)', border: 'hsl(38 92% 50% / 0.3)' },
  medium: { color: 'hsl(214 90% 60%)', bg: 'hsl(214 90% 60% / 0.12)', border: 'hsl(214 90% 60% / 0.3)' },
  low: { color: 'hsl(222 10% 60%)', bg: 'hsl(222 10% 60% / 0.12)', border: 'hsl(222 10% 60% / 0.3)' },
};

const chevronStyle = (collapsed) => ({
  transform: collapsed ? 'rotate(-90deg)' : 'none',
  transition: 'transform 0.15s ease',
  color: 'rgba(255,255,255,0.4)',
});

function ScorePill({ label, value, suffix, rationale, displayOnly }) {
  const [showTip, setShowTip] = useState(false);
  const c = scorePillMeta(value);
  // Type-guard: render a dash instead of crashing when the value is null/undefined.
  const display = (value == null) ? '—' : (value + (suffix || ''));
  if (displayOnly) {
    return (
      <span style={css("display:inline-flex; align-items:baseline; gap:3px; padding:3px 9px; borderRadius:99px; fontSize:11px; fontWeight:700; background:"+c.bg+"; border:1px solid "+c.border+"; color:"+c.color+"; whiteSpace:nowrap;")}>
        <span style={css("fontSize:9px; textTransform:uppercase; letterSpacing:0.04em; opacity:0.7;")}>{label}</span>
        <span style={css("fontSize:13px;")}>{value}{suffix}</span>
      </span>
    );
  }
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => rationale && setShowTip(s => !s)}
        onMouseEnter={() => rationale && setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        style={css("display:inline-flex; align-items:baseline; gap:3px; padding:3px 9px; borderRadius:99px; fontSize:11px; fontWeight:700; background:"+c.bg+"; border:1px solid "+c.border+"; color:"+c.color+"; cursor:"+(rationale ? 'pointer' : 'default')+"; fontFamily:'Montserrat',sans-serif; whiteSpace:nowrap;")}
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

/* Tiny inline sparkline (auto-scaled to its own min/max so small movements stay visible). */
function Sparkline({ series, color }) {
  if (!Array.isArray(series) || series.length < 2) return null;
  const w = 46, h = 15, pad = 2;
  const lo = Math.min(...series), hi = Math.max(...series), span = (hi - lo) || 1;
  const pts = series.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (series.length - 1);
    const y = pad + (h - pad * 2) * (1 - (v - lo) / span);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color || '#c4b5fd'} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Direction + colour for a run-over-run delta. invert=true (urgency): rising = attention, not "good". */
function deltaMeta(delta, invert) {
  if (delta == null || delta === 0) return { arrow: '→', color: 'rgba(255,255,255,0.38)' };
  const up = delta > 0;
  if (invert) return { arrow: up ? '▲' : '▼', color: up ? 'hsl(38 92% 62%)' : 'rgba(255,255,255,0.5)' };
  return { arrow: up ? '▲' : '▼', color: up ? '#34d399' : '#f87171' };
}

/* One metric in the trajectory strip: label, sparkline, latest value, run-over-run delta. */
function TrendCell({ label, metric, suffix, sparkColor, invert }) {
  if (!metric) return null;
  const d = deltaMeta(metric.delta, invert);
  const deltaTxt = metric.delta == null ? '' : `${metric.delta > 0 ? '+' : ''}${Math.round(metric.delta)}`;
  return (
    <div style={css("flex:1; min-width:0; display:flex; flex-direction:column; gap:3px;")}>
      <span style={css("font-size:8px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>{label}</span>
      <Sparkline series={metric.series} color={sparkColor} />
      <span style={css("display:inline-flex; align-items:baseline; gap:4px;")}>
        <span style={css("font-size:12px; font-weight:800; color:rgba(255,255,255,0.85);")}>{Math.round(metric.latest)}{suffix || ''}</span>
        {deltaTxt && <span style={{...css("font-size:9.5px; font-weight:700;"), color:d.color}}>{d.arrow}{deltaTxt}</span>}
      </span>
    </div>
  );
}

export default function AIIntelligenceCard({ ai, analyzing, onReanalyse, collapsed, onToggle }) {
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
  const hasThesis = typeof ai.dealThesis === 'string' && ai.dealThesis.trim().length > 0;
  const openQuestions = Array.isArray(ai.openQuestions) ? ai.openQuestions.filter(q => q && q.question) : [];
  const hasQuestions = openQuestions.length > 0;
  const trend = ai.scoreTrend && (ai.scoreTrend.trust || ai.scoreTrend.win || ai.scoreTrend.urgency) ? ai.scoreTrend : null;
  const priority = nba && typeof nba.priority === 'string' ? nba.priority.toLowerCase() : '';
  const pMeta = PRIORITY_META[priority] || PRIORITY_META.medium;
  const isCollapsed = collapsed === true;

  return (
    <div style={css("flex:none; margin:0 16px 6px; border-radius:16px; border:1px solid rgba(201,162,75,0.28); background:#0B1F3A; box-shadow:0 8px 28px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04); overflow:hidden; font-family:"+FONT_BODY+"; animation: ld-rise 0.4s cubic-bezier(0.22,1,0.36,1) both;")}>

      {/* Collapsed — thin toggle bar: label + pills + momentum + chevron */}
      {isCollapsed ? (
        <button onClick={onToggle} style={css("width:100%; display:flex; align-items:center; justify-content:flex-end; gap:10px; padding:6px 12px; background:none; border:none; cursor:pointer; font-family:"+FONT_BODY+";")}>
          <span style={css("font-size:9px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:"+GOLD_SOFT+";")}>AI Intelligence</span>
          <span style={css("display:flex; align-items:center; gap:4px; flex-wrap:wrap;")}>
            {hasScores && (
              <span style={css("display:flex; align-items:center; gap:3px;")}>
                {hasTrust && <ScorePill label="Trust" value={ai.trust} displayOnly />}
                {hasUrgency && <ScorePill label="Urgency" value={ai.urgency} displayOnly />}
                {hasWin && <ScorePill label="Win" value={ai.win} suffix="%" displayOnly />}
              </span>
            )}
            {hasMomentum && (
              <span style={css("display:inline-flex; align-items:center; padding:2px 7px; borderRadius:99px; fontSize:9.5px; fontWeight:600; background:rgba(139,92,246,0.12); border:1px solid rgba(139,92,246,0.25); color:#c4b5fd; whiteSpace:nowrap;")}>
                {ai.momentum}
              </span>
            )}
            <ChevronDown size={12} style={chevronStyle(true)} />
          </span>
        </button>
      ) : (
        <React.Fragment>
          {analyzing && (
            <div style={css("display:flex; align-items:center; gap:5px; padding:5px 12px; background:rgba(201,162,75,0.08); border-bottom:1px solid rgba(201,162,75,0.18); font-size:10px; color:"+GOLD_SOFT+"; font-family:"+FONT_BODY+";")}>
              <div style={css("display:inline-block; width:10px; height:10px; border:2px solid rgba(201,162,75,0.25); border-top-color:"+GOLD+"; border-radius:50%; animation: ld-spin 0.8s linear infinite;")}></div>
              Re-analysing…
            </div>
          )}

          <div style={css("padding:9px 12px;")}>
            {/* Header row — label is the toggle, with chevron */}
            <div style={css("display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:7px; flex-wrap:wrap;")}>
              <button onClick={onToggle} style={css("display:inline-flex; align-items:center; gap:5px; background:none; border:none; cursor:pointer; font-family:"+FONT_BODY+"; padding:0;")}>
                <span style={css("font-size:11px; font-weight:600; letter-spacing:0.05em; text-transform:uppercase; color:"+GOLD_SOFT+"; font-family:"+FONT_TITLE+";")}>AI Intelligence</span>
                <ChevronDown size={12} style={chevronStyle(false)} />
              </button>
              <div style={css("display:flex; align-items:center; gap:6px; flex-wrap:wrap;")}>
                {hasScores && (
                  <div style={css("display:flex; align-items:center; gap:5px;")}>
                    {hasTrust && <ScorePill label="Trust" value={ai.trust} rationale={ai.trustRationale} />}
                    {hasUrgency && <ScorePill label="Urgency" value={ai.urgency} rationale={ai.urgencyRationale} />}
                    {hasWin && <ScorePill label="Win" value={ai.win} suffix="%" rationale={ai.winRationale} />}
                  </div>
                )}
                {hasMomentum && (
                  <span style={css("display:inline-flex; align-items:center; padding:2px 7px; borderRadius:99px; fontSize:9.5px; fontWeight:600; background:rgba(139,92,246,0.12); border:1px solid rgba(139,92,246,0.25); color:#c4b5fd; whiteSpace:nowrap;")}>
                    {ai.momentum}
                  </span>
                )}
                {ai.strikeNow && (
                  <span title={ai.strikeText || undefined} style={css("display:inline-flex; align-items:center; gap:3px; padding:4px 12px; borderRadius:99px; fontSize:9.5px; fontWeight:700; letter-spacing:0.04em; textTransform:uppercase; background:hsl(0 72% 51% / 0.12); border:1px solid hsl(0 72% 51% / 0.3); color:hsl(0 72% 51%); whiteSpace:nowrap;")}>
                    ⚡ STRIKE
                  </span>
                )}
              </div>
            </div>

            {/* Summary */}
            {hasSummary && (
              <p style={css("margin:0 0 8px; font-size:12px; line-height:1.5; color:rgba(255,255,255,0.82); font-family:"+FONT_BODY+";")}>{ai.summary}</p>
            )}

            {/* Deal thesis — the persistent strategy the brain carries across runs (V3 P2 REMEMBER) */}
            {hasThesis && (
              <div style={css("margin:0 0 8px; padding:7px 10px; border-radius:9px; background:rgba(139,92,246,0.07); border:1px solid rgba(139,92,246,0.22); border-left:2px solid rgba(139,92,246,0.7);")}>
                <span style={css("display:block; font-size:8.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#c4b5fd; margin-bottom:3px;")}>Strategy</span>
                <p style={css("margin:0; font-size:11.5px; line-height:1.5; color:rgba(255,255,255,0.78);")}>{ai.dealThesis}</p>
              </div>
            )}

            {/* Next Best Action */}
            {hasNba && (
              <div style={css("margin-bottom:8px; padding:7px 10px; border-radius:9px; background:rgba(201,162,75,0.05); border:1px solid rgba(201,162,75,0.18); border-left:2px solid "+GOLD+";")}>
                <div style={css("display:flex; align-items:center; gap:6px; flex-wrap:wrap;")}>
                  <span style={css("font-size:12px; font-weight:700; color:rgba(255,255,255,0.92); font-family:"+FONT_BODY+";")}>{nba.action || nba.reasoning}</span>
                  {priority && (
                    <span style={css("display:inline-flex; align-items:center; padding:1px 6px; borderRadius:99px; fontSize:8.5px; fontWeight:700; text-transform:uppercase; letter-spacing:0.04em; background:"+pMeta.bg+"; border:1px solid "+pMeta.border+"; color:"+pMeta.color+"; fontFamily:"+FONT_BODY+";")}>{priority}</span>
                  )}
                </div>
                {nba.reasoning && nba.action && (
                  <p style={css("margin:4px 0 0; font-size:11px; line-height:1.4; color:rgba(255,255,255,0.55); font-family:"+FONT_BODY+";")}>{nba.reasoning}</p>
                )}
              </div>
            )}

            {/* Ask-the-agent — questions the brain needs a human to resolve (V3 P2 REMEMBER) */}
            {hasQuestions && (
              <div style={css("margin-bottom:8px; padding:7px 10px; border-radius:9px; background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.28);")}>
                <span style={css("display:block; font-size:8.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#93c5fd; margin-bottom:5px;")}>Needs your input</span>
                <div style={css("display:flex; flex-direction:column; gap:6px;")}>
                  {openQuestions.map((q, i) => (
                    <div key={i}>
                      <p style={css("margin:0; font-size:11.5px; line-height:1.4; color:rgba(255,255,255,0.85); font-weight:600;")}>? {q.question}</p>
                      {q.why && <p style={css("margin:1px 0 0; font-size:10px; line-height:1.4; color:rgba(255,255,255,0.5);")}>{q.why}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trajectory — score movement run-over-run from the snapshot history (V3 P2 REMEMBER) */}
            {trend && (
              <div style={css("margin-bottom:8px; padding:8px 10px; border-radius:9px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07);")}>
                <div style={css("display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:6px;")}>
                  <span style={css("font-size:8.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>Trajectory</span>
                  <span style={css("font-size:9px; color:rgba(255,255,255,0.35);")}>{trend.count} runs{trend.since ? ` · since ${relativeTime(trend.since)}` : ''}</span>
                </div>
                <div style={css("display:flex; align-items:flex-start; gap:12px;")}>
                  <TrendCell label="Trust" metric={trend.trust} sparkColor="#34d399" />
                  <TrendCell label="Win" metric={trend.win} suffix="%" sparkColor="#93c5fd" />
                  <TrendCell label="Urgency" metric={trend.urgency} sparkColor="hsl(38 92% 62%)" invert />
                </div>
              </div>
            )}

            {/* Coaching — gold left-border accent (pipeline) */}
            {hasCoaching && (
              <div style={css("margin-bottom:8px; padding:7px 10px; border-radius:9px; background:rgba(201,162,75,0.05); border:1px solid rgba(201,162,75,0.18); border-left:2px solid "+GOLD+";")}>
                <span style={css("display:block; font-size:8.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:"+GOLD_SOFT+"; margin-bottom:3px; font-family:"+FONT_BODY+";")}>Coaching</span>
                <p style={css("margin:0; font-size:11.5px; line-height:1.45; color:rgba(255,255,255,0.78); font-family:"+FONT_BODY+";")}>{ai.coaching}</p>
              </div>
            )}

            {/* Objections */}
            {hasObjections && (
              <div style={css("margin-bottom:7px;")}>
                <span style={css("display:block; font-size:8.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#fca5a5; margin-bottom:4px;")}>Objections</span>
                <div style={css("display:flex; flex-wrap:wrap; gap:4px;")}>
                  {ai.objections.map((ob, i) => (
                    <span key={i} style={css("display:inline-flex; align-items:center; gap:3px; padding:3px 9px; borderRadius:99px; background:hsl(0 72% 51% / 0.12); border:1px solid hsl(0 72% 51% / 0.3); font-size:9.5px; color:hsl(0 72% 51%); fontFamily:"+FONT_BODY+";")}>⚑ {ob}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={css("display:flex; align-items:center; justify-content:space-between; gap:8px; padding-top:7px; border-top:1px solid rgba(255,255,255,0.05);")}>
              <span style={css("font-size:9px; color:rgba(255,255,255,0.38);")}>
                {ai.analysedAt ? relativeTime(ai.analysedAt) : ''}
              </span>
              <button onClick={onReanalyse} disabled={analyzing} style={css("display:inline-flex; align-items:center; gap:4px; padding:4px 9px; borderRadius:99px; border:1px solid rgba(201,162,75,0.45); background:rgba(201,162,75,0.12); color:"+GOLD_SOFT+"; font-size:9.5px; font-weight:600; cursor:pointer; font-family:"+FONT_BODY+"; opacity:"+(analyzing ? 0.6 : 1)+";")}>
                <span style={css("display:inline-block; "+(analyzing ? "animation: ld-spin 0.8s linear infinite;" : "")+"")}>↻</span> {analyzing ? 'Re-analysing…' : 'Re-analyse'}
              </button>
            </div>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}