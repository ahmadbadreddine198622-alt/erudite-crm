import React from 'react';

/* Convert a CSS declaration string into a React style object (preserves the design 1:1). */
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

const titleize = (s) => String(s||'').replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase());

export default function RiskSignals({ signals, flagChips, buyChips, hasFlags }) {
  const showStrike = signals && signals.showStrike;
  const showFlags = hasFlags && (flagChips.length > 0 || buyChips.length > 0);

  if (!showStrike && !showFlags) return null;

  return (
    <React.Fragment>
      {/* strike now banner */}
      {showStrike && (
        <div style={signals.strikeStyle}>
          <span style={signals.strikeDot}></span>
          <div style={css("min-width:0;")}>
            <span style={{...css("font-size:10px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase;"), color:signals.strikeAccent}}>{signals.strikeKicker}</span>
            <div style={css("font-size:13px; line-height:1.45; color:rgba(255,255,255,0.88); margin-top:3px;")}>{signals.strikeText}</div>
          </div>
        </div>
      )}

      {/* red flags + buying signals */}
      {showFlags && (
        <div style={css("display:flex; flex-wrap:wrap; gap:7px; margin-top:12px;")}>
          {flagChips.map((fc,i)=>(<span key={'f'+i} style={fc.style}>{fc.icon} {fc.label}</span>))}
          {buyChips.map((bc,i)=>(<span key={'b'+i} style={bc.style}>{bc.icon} {bc.label}</span>))}
        </div>
      )}
    </React.Fragment>
  );
}