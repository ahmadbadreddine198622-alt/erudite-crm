import React from 'react';

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

function whenLabel(p) {
  const iso = p.scheduled_at || p.due_date;
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
    (p.scheduled_at ? ` · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '');
}

/*
 * BRAIN V4 P6 (ACT) — the Aurora-proposes strip.
 * Renders the brain's materialized proposals (origin='aurora', proposal_status='proposed') for
 * this landlord: follow-ups and tasks awaiting a human verdict. Approve keeps the row and logs
 * proposal_approved; dismiss neutralizes the row and logs proposal_dismissed — both verdicts
 * feed the Outcome Ledger, so the brain LEARNS which proposals earn trust. Nothing here (or
 * anywhere else in Aurora) sends a message: sending is always a human pressing Send.
 */
export default function AuroraProposalsStrip({ proposals, onApprove, onDismiss, busyId }) {
  if (!Array.isArray(proposals) || proposals.length === 0) return null;
  return (
    <div style={css("flex:none; margin:0 16px 6px; border-radius:12px; border:1px solid rgba(139,92,246,0.35); background:linear-gradient(180deg, rgba(139,92,246,0.09), rgba(255,255,255,0.02)); padding:9px 12px; animation: ld-rise 0.4s cubic-bezier(0.22,1,0.36,1) both;")}>
      <div style={css("display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:7px;")}>
        <span style={css("font-size:9px; font-weight:800; letter-spacing:0.07em; text-transform:uppercase; color:#c4b5fd;")}>⚡ Aurora proposes · {proposals.length}</span>
        <span style={css("font-size:9px; color:rgba(255,255,255,0.35);")}>approve to keep · dismiss to teach</span>
      </div>
      <div style={css("display:flex; flex-direction:column; gap:6px;")}>
        {proposals.map((p) => {
          const busy = busyId === p.id;
          const note = String(p.notes || p.description || '').split('\n')[0].slice(0, 160);
          return (
            <div key={p.id} style={css("display:flex; align-items:flex-start; gap:8px; padding:6px 8px; border-radius:9px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07);")}>
              <span style={css("flex:none; margin-top:1px; padding:1px 6px; borderRadius:99px; font-size:8.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; background:rgba(139,92,246,0.12); border:1px solid rgba(139,92,246,0.3); color:#c4b5fd;")}>
                {p.type === 'task' ? 'Task' : 'Follow-up'}
              </span>
              <div style={css("flex:1; min-width:0;")}>
                <div style={css("display:flex; align-items:baseline; gap:6px; flex-wrap:wrap;")}>
                  <span style={css("font-size:11.5px; font-weight:700; color:rgba(255,255,255,0.88);")}>{p.title}</span>
                  {whenLabel(p) && <span style={css("font-size:9.5px; color:rgba(255,255,255,0.4);")}>{whenLabel(p)}</span>}
                </div>
                {note && <p style={css("margin:2px 0 0; font-size:10.5px; line-height:1.4; color:rgba(255,255,255,0.55);")}>{note}</p>}
              </div>
              <div style={css("flex:none; display:flex; gap:5px;")}>
                <button onClick={() => !busy && onApprove(p)} disabled={busy}
                  style={css("display:inline-flex; align-items:center; gap:3px; padding:4px 9px; borderRadius:99px; border:1px solid rgba(16,185,129,0.4); background:rgba(16,185,129,0.12); color:#34d399; font-size:10px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; opacity:" + (busy ? 0.5 : 1) + ";")}>
                  ✓ Approve
                </button>
                <button onClick={() => !busy && onDismiss(p)} disabled={busy}
                  style={css("display:inline-flex; align-items:center; gap:3px; padding:4px 9px; borderRadius:99px; border:1px solid rgba(239,68,68,0.35); background:rgba(239,68,68,0.1); color:#f87171; font-size:10px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; opacity:" + (busy ? 0.5 : 1) + ";")}>
                  ✕ Dismiss
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
