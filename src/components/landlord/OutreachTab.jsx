import React from 'react';

/* Convert a CSS declaration string into a React style object. */
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

// The V-card "Daily outreach sequence" tab. Steps are clickable — tapping one toggles it
// (manual override), in addition to the auto-tick that fires when the agent sends/calls.
// Props: tab (the outreach VM block), onToggleStep(stepKey), toggling (stepKey in flight | null).
export default function OutreachTab({ tab, onToggleStep, toggling }) {
  return (
    <React.Fragment>
      <div style={css("display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px;")}>
        <div>
          <div style={css("font-size:13px; font-weight:600; color:rgba(255,255,255,0.9);")}>Daily outreach sequence · {tab.outreachDate}</div>
          <div style={css("font-size:11.5px; color:rgba(255,255,255,0.45); margin-top:2px;")}>{tab.stepsCompleted} of 6 steps complete</div>
        </div>
        <div style={css("text-align:right;")}>
          <div style={css("font-size:20px; font-weight:800; color:hsl(38 92% 60%);")}>{tab.dailyScore}</div>
          <div style={css("font-size:10px; color:rgba(255,255,255,0.4);")}>daily score</div>
        </div>
      </div>
      <div style={css("height:6px; border-radius:99px; background:rgba(255,255,255,0.07); overflow:hidden; margin-bottom:14px;")}><div style={tab.progressStyle}></div></div>
      <div style={css("display:flex; flex-direction:column; gap:7px;")}>
        {tab.steps.map((os)=>{
          const busy = toggling === os.key;
          return (
            <button
              key={os.key}
              onClick={()=> onToggleStep && onToggleStep(os.key)}
              disabled={busy}
              title={os.done ? 'Tap to mark not done' : 'Tap to mark done'}
              style={css("display:flex; align-items:center; gap:11px; width:100%; text-align:left; padding:10px 12px; border-radius:11px; cursor:pointer; font-family:'Montserrat','Inter',sans-serif; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); opacity:" + (busy ? 0.6 : 1) + ";")}
            >
              <span style={os.iconStyle}>{os.icon}</span>
              <span style={os.labelStyle}>{os.label}</span>
              <span style={css("margin-left:auto; font-size:11px; color:rgba(255,255,255,0.4);")}>{os.at}</span>
            </button>
          );
        })}
      </div>
    </React.Fragment>
  );
}