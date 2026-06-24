// ComposerConfirmChip — the parse→confirm→commit confirmation card for the landlord composer.
// Rendered above the composer after composerBrain parses Note/Task/Follow-up text. Shows the
// draft fields as editable inputs prefilled from the AI draft, the confirm_label, and
// Confirm + Cancel. Pure presentational: all state lives on the parent, edits flow back via
// onChange(patch), commit via onConfirm, dismiss via onCancel.

import React from 'react';

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

const fieldStyle = css("padding:7px 10px; border-radius:8px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.9); font-size:12px; font-family:'Inter',sans-serif; width:100%;");
const labelStyle = css("font-size:9px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:3px;");

const PRIORITIES = ['low', 'medium', 'high'];

export default function ComposerConfirmChip({ type, draft, confirmLabel, committing, onChange, onConfirm, onCancel }) {
  if (!draft) return null;

  return (
    <div style={{ ...css("margin-bottom:9px; border-radius:12px; border:1px solid rgba(139,92,246,0.3); background:rgba(139,92,246,0.06); padding:11px 12px;"), position: 'relative' }}>
      <style>{`@keyframes ccc-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={css("display:flex; align-items:center; gap:6px; margin-bottom:8px;")}>
        <span style={css("font-size:10.5px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:#c4b5fd;")}>✦ Confirm {type}</span>
      </div>

      {confirmLabel && (
        <div style={css("font-size:12.5px; font-weight:600; color:#ede9fe; margin-bottom:9px; line-height:1.4;")}>{confirmLabel}</div>
      )}

      <div style={css("display:flex; flex-direction:column; gap:8px;")}>
        {type === 'note' && (
          <div>
            <div style={labelStyle}>Note</div>
            <textarea value={draft.body || ''} onChange={(e) => onChange({ body: e.target.value })} rows={4}
              style={{ ...fieldStyle, resize: 'vertical', minHeight: 80, lineHeight: 1.5 }} />
            {Array.isArray(draft.action_items) && draft.action_items.length > 0 && (
              <div style={css("margin-top:7px; padding:7px 10px; border-radius:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08);")}>
                <div style={{ ...labelStyle, marginBottom: 5 }}>Action items — also create as tasks?</div>
                <div style={css("display:flex; flex-direction:column; gap:4px;")}>
                  {draft.action_items.map((ai, i) => {
                    const on = (draft._selectedActionItems || []).includes(i);
                    return (
                      <button key={i} onClick={() => {
                        const sel = new Set(draft._selectedActionItems || []);
                        if (sel.has(i)) sel.delete(i); else sel.add(i);
                        onChange({ _selectedActionItems: Array.from(sel) });
                      }}
                        style={css(
                          "display:flex; align-items:center; gap:7px; text-align:left; padding:5px 8px; border-radius:7px; cursor:pointer; font-family:'Inter',sans-serif; " +
                          "background:" + (on ? "rgba(16,185,129,0.14)" : "rgba(255,255,255,0.03)") + "; " +
                          "border:1px solid " + (on ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.1)") + ";"
                        )}>
                        <span style={css("flex:none; font-size:11px; color:" + (on ? "#34d399" : "rgba(255,255,255,0.4)") + ";")}>{on ? '☑' : '☐'}</span>
                        <span style={css("font-size:11px; color:rgba(255,255,255,0.8); line-height:1.4;")}>{ai}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {type === 'task' && (
          <React.Fragment>
            <div>
              <div style={labelStyle}>Title</div>
              <input value={draft.title || ''} onChange={(e) => onChange({ title: e.target.value })} style={fieldStyle} />
            </div>
            <div style={css("display:flex; gap:8px; flex-wrap:wrap;")}>
              <div style={css("flex:1; min-width:120px;")}>
                <div style={labelStyle}>Due date</div>
                <input type="date" value={draft.due_date || ''} onChange={(e) => onChange({ due_date: e.target.value })} style={fieldStyle} />
              </div>
              <div style={css("flex:1; min-width:120px;")}>
                <div style={labelStyle}>Priority</div>
                <select value={draft.priority || 'medium'} onChange={(e) => onChange({ priority: e.target.value })} style={{ ...fieldStyle, cursor: 'pointer' }}>
                  {PRIORITIES.map((p) => <option key={p} value={p} style={{ background: '#1a2235' }}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div style={labelStyle}>Assignee</div>
              <input type="email" value={draft.assignee_email || ''} onChange={(e) => onChange({ assignee_email: e.target.value })} placeholder="assignee@email" style={fieldStyle} />
            </div>
          </React.Fragment>
        )}

        {type === 'followup' && (
          <React.Fragment>
            <div>
              <div style={labelStyle}>Title</div>
              <input value={draft.title || ''} onChange={(e) => onChange({ title: e.target.value })} style={fieldStyle} />
            </div>
            <div>
              <div style={labelStyle}>Notes</div>
              <textarea value={draft.notes || ''} onChange={(e) => onChange({ notes: e.target.value })} rows={2}
                style={{ ...fieldStyle, resize: 'vertical', minHeight: 50, lineHeight: 1.5 }} />
            </div>
            <div style={css("display:flex; gap:8px; flex-wrap:wrap;")}>
              <div style={css("flex:1; min-width:160px;")}>
                <div style={labelStyle}>When (Dubai)</div>
                <input type="datetime-local" value={(draft.scheduled_at || '').slice(0, 16)} onChange={(e) => onChange({ scheduled_at: e.target.value ? e.target.value + ':00' : null })} style={fieldStyle} />
              </div>
              <div style={css("flex:1; min-width:100px;")}>
                <div style={labelStyle}>Priority</div>
                <select value={draft.priority || 'medium'} onChange={(e) => onChange({ priority: e.target.value })} style={{ ...fieldStyle, cursor: 'pointer' }}>
                  {PRIORITIES.map((p) => <option key={p} value={p} style={{ background: '#1a2235' }}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div style={labelStyle}>Kind</div>
              <input value={draft.kind || ''} onChange={(e) => onChange({ kind: e.target.value })} placeholder="call / whatsapp / email" style={fieldStyle} />
            </div>
          </React.Fragment>
        )}

        <div style={css("display:flex; gap:7px; margin-top:2px;")}>
          <button onClick={onCancel} disabled={committing}
            style={css("flex:none; padding:9px 14px; border-radius:9px; font-size:12px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.6);")}>Cancel</button>
          <button onClick={onConfirm} disabled={committing}
            style={css(
              "flex:1; padding:9px; border-radius:9px; font-size:12px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; display:flex; align-items:center; justify-content:center; gap:7px; " +
              "background:linear-gradient(180deg, #8b5cf6, #7c3aed); color:#fff; border:1px solid rgba(139,92,246,0.6); opacity:" + (committing ? 0.85 : 1) + ";"
            )}>
            {committing ? (<><span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'ccc-spin 0.7s linear infinite' }} />Saving…</>) : '✓ Confirm & save'}
          </button>
        </div>
      </div>
    </div>
  );
}