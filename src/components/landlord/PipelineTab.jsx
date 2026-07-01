import React from 'react';
import { SendFlash } from '@/components/landlord/sendFeedback';

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

// Pipeline progress bar + stage selector — moved here from the right-panel sidebar so it lives
// under the Pipeline tab itself.
export default function PipelineTab({ stage, currentStageKey, pendingStage, onPendingStageChange, stageSaving, stageSaved, onSaveStage, stages, stageKeys }) {
  return (
    <div style={{ ...css("border-radius:13px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04); padding:13px 15px;"), position: 'relative', overflow: 'hidden' }}>
      {stageSaved && <SendFlash color="#34d399" label="Saved!" glyph="↕" />}
      <div style={css("display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;")}>
        <span style={css("font-size:11px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.5);")}>Pipeline</span>
        <span style={css("font-size:11px; color:hsl(38 92% 60%); font-weight:600;")}>Stage {stage.index} of {stage.total}</span>
      </div>
      <div style={css("height:6px; border-radius:99px; background:rgba(255,255,255,0.07); overflow:hidden;")}><div style={stage.barStyle}></div></div>
      <div style={css("display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:10px;")}>
        <span style={css("font-size:11px; color:rgba(255,255,255,0.45);")}>{stage.nextLabel}</span>
        <div style={css("display:flex; align-items:center; gap:8px;")}>
          <select
            value={pendingStage || currentStageKey || 'initial_contact'}
            onChange={(e) => onPendingStageChange(e.target.value)}
            style={css("padding:6px 10px; border-radius:8px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.85); font-size:11px; font-weight:600; font-family:'Inter',sans-serif; cursor:pointer;")}
          >
            {stages.map((s, i) => (
              <option key={s} value={stageKeys[i] || s} style={{ background: '#13182a' }}>{s}</option>
            ))}
          </select>
          {pendingStage && pendingStage !== currentStageKey && (
            <button
              onClick={() => onSaveStage(pendingStage)}
              disabled={stageSaving}
              style={css("padding:6px 12px; border-radius:8px; border:1px solid rgba(52,211,153,0.45); background:rgba(52,211,153,0.16); color:#34d399; font-size:11px; font-weight:700; font-family:'Inter',sans-serif; cursor:pointer; opacity:" + (stageSaving ? 0.6 : 1) + ";")}
            >
              {stageSaving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}