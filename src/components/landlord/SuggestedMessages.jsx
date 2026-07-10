import React from 'react';

/* Convert a CSS declaration string into a React style object (matches the LandlordDetail design). */
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

/**
 * SuggestedMessages — renders landlord.ai_suggested_messages as tap-to-load chips above the
 * Chat composer. Tapping a draft calls onPick(text) which pre-fills the message box (agent
 * reviews then sends). Cold-open drafts (mode="cold_open") are tagged distinctly from replies.
 */
export default function SuggestedMessages({ messages, onPick, activeText }) {
  const items = (Array.isArray(messages) ? messages : [])
    .filter(m => m && typeof m === 'object' && typeof m.text === 'string' && m.text.trim());
  if (!items.length) return null;

  return (
    <div style={css("margin-bottom:9px; border-radius:12px; border:1px solid rgba(37,211,102,0.22); background:rgba(37,211,102,0.04); padding:9px 11px;")}>
      <div style={css("display:flex; align-items:center; gap:6px; margin-bottom:7px;")}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>
        <span style={css("font-size:10px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:#86efac;")}>AI Suggested Messages</span>
        <span style={css("font-size:9px; font-weight:600; color:rgba(255,255,255,0.4);")}>{items.length}</span>
      </div>
      <div style={css("display:flex; flex-direction:column; gap:5px; max-height:200px; overflow-y:auto;")}>
        {items.map((m, i) => {
          const isActive = activeText === m.text.trim();
          const isCold = m.mode === 'cold_open';
          return (
            <button
              key={i}
              onClick={() => onPick(m.text.trim())}
              title="Load into message box"
              style={css(
                "display:flex; flex-direction:column; align-items:flex-start; gap:3px; text-align:left; width:100%; padding:7px 10px; border-radius:9px; cursor:pointer; font-family:'Inter',sans-serif; "+
                "background:"+(isActive ? "rgba(37,211,102,0.18)" : "rgba(37,211,102,0.06)")+"; "+
                "border:1px solid "+(isActive ? "rgba(37,211,102,0.5)" : "rgba(37,211,102,0.2)")+";"
              )}
            >
              <span style={css("display:flex; align-items:center; gap:6px; width:100%;")}>
                <span style={css(
                  "flex:none; padding:1px 6px; border-radius:99px; font-size:8px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; "+
                  (isCold ? "background:rgba(59,130,246,0.16); color:#93c5fd;" : "background:rgba(37,211,102,0.16); color:#4ade80;")
                )}>{isCold ? 'Cold open' : 'Reply'}</span>
                {m.tone && <span style={css("flex:none; font-size:9px; font-weight:600; color:rgba(255,255,255,0.4);")}>{m.tone}</span>}
                {m.language && m.language !== 'en' && <span style={css("flex:none; margin-left:auto; font-size:9px; font-weight:600; color:rgba(255,255,255,0.35); text-transform:uppercase;")}>{m.language}</span>}
              </span>
              <span style={css("font-size:12px; line-height:1.45; color:"+(isActive ? "#dcfce7" : "rgba(255,255,255,0.85)")+";")}>{m.text.trim()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}