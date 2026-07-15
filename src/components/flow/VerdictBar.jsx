// VerdictBar — action bar under the composer: Done, Snooze, Escalate.
// Each action advances to the next landlord in the queue.
//   Done      → advance immediately
//   Snooze    → time picker → creates a Followup record → advance
//   Escalate  → reason prompt → sets needs_human_review=true → advance

import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Check, Clock, AlertTriangle, X, Loader2 } from 'lucide-react';
import WritingField from '@/components/shared/WritingField';

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

export default function VerdictBar({ landlord, onDone, onSnooze, onEscalate }) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState('');
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSnooze = async () => {
    if (!snoozeDate || !landlord) return;
    setBusy(true);
    try {
      await base44.entities.Followup.create({
        landlord_id: landlord.id,
        title: 'Flow session follow-up',
        notes: 'Snoozed from Flow command center',
        scheduled_at: new Date(snoozeDate).toISOString(),
        status: 'pending',
        priority: 'normal',
        kind: 'follow_up',
        agent_email: landlord.assigned_agent_email || undefined,
      });
      toast.success('Snoozed — follow-up created');
      setSnoozeOpen(false);
      setSnoozeDate('');
      if (onSnooze) onSnooze();
    } catch (e) {
      toast.error('Failed to snooze: ' + (e?.message || ''));
    } finally {
      setBusy(false);
    }
  };

  const handleEscalate = async () => {
    if (!landlord) return;
    setBusy(true);
    try {
      await base44.entities.Landlord.update(landlord.id, {
        needs_human_review: true,
        review_reason: escalateReason.trim() || 'Escalated from Flow command center',
      });
      toast.success('Escalated — flagged for human review');
      setEscalateOpen(false);
      setEscalateReason('');
      if (onEscalate) onEscalate();
    } catch (e) {
      toast.error('Failed to escalate: ' + (e?.message || ''));
    } finally {
      setBusy(false);
    }
  };

  const btnBase = "display:flex; align-items:center; justify-content:center; gap:5px; padding:7px 14px; border-radius:9px; font-size:11.5px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; border:1px solid transparent; transition:all 0.12s; flex:1;";

  return (
    <div style={css("padding:8px 14px; border-top:1px solid rgba(255,255,255,0.08); flex:none; position:relative;")}>
      <div style={css("display:flex; gap:6px;")}>
        <button type="button" onClick={onDone} disabled={busy}
          style={css(btnBase + "background:rgba(16,185,129,0.15); color:#34d399; border-color:rgba(16,185,129,0.3); opacity:" + (busy ? '0.5;' : '1;'))}>
            <Check size={14} /> Done
        </button>
        <button type="button" onClick={() => setSnoozeOpen(!snoozeOpen)} disabled={busy}
          style={css(btnBase + "background:rgba(96,165,250,0.15); color:#93c5fd; border-color:rgba(96,165,250,0.3); opacity:" + (busy ? '0.5;' : '1;'))}>
            <Clock size={14} /> Snooze
        </button>
        <button type="button" onClick={() => setEscalateOpen(!escalateOpen)} disabled={busy}
          style={css(btnBase + "background:rgba(239,68,68,0.15); color:#f87171; border-color:rgba(239,68,68,0.3); opacity:" + (busy ? '0.5;' : '1;'))}>
            <AlertTriangle size={14} /> Escalate
        </button>
      </div>

      {/* Snooze panel */}
      {snoozeOpen && (
        <div style={css("position:absolute; bottom:100%; left:14px; right:14px; margin-bottom:4px; padding:10px; border-radius:10px; background:#1a2235; border:1px solid rgba(255,255,255,0.15); box-shadow:0 -8px 24px rgba(0,0,0,0.4); z-index:30;")}>
          <div style={css("display:flex; align-items:center; justify-content:space-between; margin-bottom:7px;")}>
            <span style={css("font-size:11px; font-weight:700; color:rgba(255,255,255,0.8); font-family:'Inter',sans-serif;")}>Snooze until…</span>
            <button type="button" onClick={() => setSnoozeOpen(false)} style={css("background:none; border:none; cursor:pointer; color:rgba(255,255,255,0.4); padding:0; display:flex;")}><X size={13} /></button>
          </div>
          <input type="datetime-local" value={snoozeDate} onChange={(e) => setSnoozeDate(e.target.value)}
            style={css("width:100%; padding:6px 9px; border-radius:7px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.9); font-size:12px; font-family:'Inter',sans-serif; color-scheme:dark; outline:none; margin-bottom:7px;")} />
          <button type="button" onClick={handleSnooze} disabled={!snoozeDate || busy}
            style={css("width:100%; padding:6px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(96,165,250,0.2); color:#93c5fd; border:1px solid rgba(96,165,250,0.4); opacity:" + (!snoozeDate || busy ? '0.5;' : '1;'))}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : 'Create follow-up & advance'}
          </button>
        </div>
      )}

      {/* Escalate panel */}
      {escalateOpen && (
        <div style={css("position:absolute; bottom:100%; left:14px; right:14px; margin-bottom:4px; padding:10px; border-radius:10px; background:#1a2235; border:1px solid rgba(255,255,255,0.15); box-shadow:0 -8px 24px rgba(0,0,0,0.4); z-index:30;")}>
          <div style={css("display:flex; align-items:center; justify-content:space-between; margin-bottom:7px;")}>
            <span style={css("font-size:11px; font-weight:700; color:rgba(255,255,255,0.8); font-family:'Inter',sans-serif;")}>Escalation reason</span>
            <button type="button" onClick={() => setEscalateOpen(false)} style={css("background:none; border:none; cursor:pointer; color:rgba(255,255,255,0.4); padding:0; display:flex;")}><X size={13} /></button>
          </div>
          <WritingField value={escalateReason} onChange={(e) => setEscalateReason(e.target.value)} rows={2} placeholder="Why does this need human review?"
            style={css("resize:none; padding:6px 9px; border-radius:7px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.9); font-size:12px; font-family:'Inter',sans-serif; outline:none; margin-bottom:7px;")} />
          <button type="button" onClick={handleEscalate} disabled={busy}
            style={css("width:100%; padding:6px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(239,68,68,0.2); color:#f87171; border:1px solid rgba(239,68,68,0.4); opacity:" + (busy ? '0.5;' : '1;'))}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : 'Flag for review & advance'}
          </button>
        </div>
      )}
    </div>
  );
}