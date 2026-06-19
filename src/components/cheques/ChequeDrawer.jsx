import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, isValid } from 'date-fns';
import { X, Edit2, Save, Trash2, Loader2, ImageIcon, ExternalLink, Download, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_OPTS = ['received', 'deposited', 'cleared', 'bounced', 'returned', 'cancelled', 'replaced'];
const ALL_PURPOSE_OPTS = ['commission', 'rent', 'deposit', 'service_charge', 'booking', 'dld_fee', 'managers', 'other'];
const TYPE_OPTS = ['current', 'post_dated'];

const STATUS_STYLE = {
  received:  { bg: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: 'rgba(99,102,241,0.3)' },
  deposited: { bg: 'rgba(6,182,212,0.15)',  color: '#67e8f9', border: 'rgba(6,182,212,0.3)' },
  cleared:   { bg: 'rgba(34,197,94,0.15)',  color: '#4ade80', border: 'rgba(34,197,94,0.3)' },
  bounced:   { bg: 'rgba(239,68,68,0.15)',  color: '#fca5a5', border: 'rgba(239,68,68,0.3)' },
  returned:  { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
  cancelled: { bg: 'rgba(148,163,184,0.1)', color: 'rgba(148,163,184,0.8)', border: 'rgba(148,163,184,0.25)' },
  replaced:  { bg: 'rgba(168,85,247,0.15)', color: '#d8b4fe', border: 'rgba(168,85,247,0.3)' },
};

const STATUS_ACTIONS = {
  received:  ['deposited', 'bounced', 'returned', 'cancelled'],
  deposited: ['cleared', 'bounced', 'returned'],
  bounced:   ['replaced'],
  returned:  ['replaced'],
  cancelled: [], cleared: [], replaced: [],
};

const LABEL = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const fmtAed = (n) => n != null && n !== '' ? `AED ${Number(n).toLocaleString('en-AE', { minimumFractionDigits: 0 })}` : '—';
const fmtDate = (d) => {
  try { if (!d) return '—'; const dt = new Date(d); return isValid(dt) ? format(dt, 'd MMM yyyy') : d; }
  catch { return d || '—'; }
};

const TYPE_LABEL_MAP = {
  commission: 'Commission', rent: 'Rent', deposit: 'Security',
  service_charge: 'Service Charge', booking: 'Booking / MOU',
  dld_fee: 'DLD Fee', managers: "Manager's", other: 'Other',
};
const deriveTypeLabel = (c) => {
  if (!c) return '—';
  if (c.purpose === 'rent' && c.cheque_type === 'post_dated') return 'Rent / PDC';
  return TYPE_LABEL_MAP[c.purpose] || LABEL(c.purpose || 'other');
};

function Pill({ value }) {
  const s = STATUS_STYLE[value] || { bg: 'rgba(148,163,184,0.1)', color: 'rgba(255,255,255,0.6)', border: 'rgba(148,163,184,0.2)' };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      {LABEL(value)}
    </span>
  );
}

const INIT_EDIT = (c) => ({
  cheque_number: c.cheque_number || '',
  bank_name: c.bank_name || '',
  payer_name: c.payer_name || '',
  payee_name: c.payee_name || '',
  amount_aed: c.amount_aed != null ? String(c.amount_aed) : '',
  cheque_date: c.cheque_date || '',
  issue_date: c.issue_date || '',
  received_date: c.received_date || '',
  deposit_date: c.deposit_date || '',
  cleared_date: c.cleared_date || '',
  received_by_email: c.received_by_email || '',
  assigned_agent_email: c.assigned_agent_email || '',
  held_by: c.held_by || '',
  cheque_type: c.cheque_type || 'current',
  status: c.status || 'received',
  purpose: c.purpose || 'other',
  notes: c.notes || '',
});

export default function ChequeDrawer({ cheque, onClose, onUpdated, onDeleted }) {
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState(INIT_EDIT(cheque));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null);

  useEffect(() => {
    setEditForm(INIT_EDIT(cheque));
    setEditMode(false);
    setConfirmDelete(false);
  }, [cheque.id]);

  const ef = (k) => (e) => setEditForm(f => ({ ...f, [k]: e.target.value }));

  // VAT breakdown — live when editing, from record in view mode
  const vatAmt = parseFloat(editMode ? editForm.amount_aed : cheque.amount_aed) || 0;
  const vatPurpose = editMode ? editForm.purpose : cheque.purpose;
  const vatBreakdown = vatPurpose === 'commission' && vatAmt > 0
    ? { gross: vatAmt, vat: vatAmt * 5 / 105, net: vatAmt / 1.05 }
    : null;

  const handleSaveEdit = async () => {
    if (!editForm.cheque_number.trim()) return toast.error('Cheque number required');
    if (!editForm.payer_name.trim()) return toast.error('Payer name required');
    setSaving(true);
    try {
      const patch = { ...editForm };
      if (patch.amount_aed !== '') patch.amount_aed = parseFloat(patch.amount_aed) || 0;
      else delete patch.amount_aed;
      ['deposit_date', 'cheque_date', 'issue_date', 'cleared_date', 'bank_name', 'payee_name', 'held_by', 'assigned_agent_email', 'notes'].forEach(k => {
        if (patch[k] === '') patch[k] = null;
      });
      await base44.entities.Cheque.update(cheque.id, patch);
      toast.success('Cheque updated');
      setEditMode(false);
      onUpdated({ ...cheque, ...patch });
    } catch (err) {
      toast.error('Update failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await base44.entities.Cheque.delete(cheque.id);
      toast.success('Cheque record deleted (Drive archive preserved)');
      onDeleted(cheque.id);
    } catch (err) {
      toast.error('Delete failed: ' + err.message);
      setDeleting(false);
    }
  };

  const handleStatusAction = async (newStatus) => {
    setUpdatingStatus(newStatus);
    try {
      const patch = { status: newStatus };
      if (['cleared', 'bounced', 'returned'].includes(newStatus)) patch.cleared_date = format(new Date(), 'yyyy-MM-dd');
      await base44.entities.Cheque.update(cheque.id, patch);
      toast.success(`Marked as ${LABEL(newStatus)}`);
      onUpdated({ ...cheque, ...patch });
    } catch (err) {
      toast.error('Update failed: ' + err.message);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const displayStatus = editMode ? editForm.status : cheque.status;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-black/50" onClick={() => !editMode && onClose()} />
      <div className="w-full max-w-md h-full flex flex-col"
        style={{ background: 'hsl(222 47% 9%)', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>

        {/* Header — sticky */}
        <div className="px-6 py-4 border-b flex items-start justify-between gap-4 shrink-0"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-0.5">
              {editMode ? 'Editing Cheque' : 'Cheque Detail'}
            </p>
            <h2 className="font-mono text-xl font-bold text-white">
              {editMode ? (editForm.cheque_number || '—') : (cheque.cheque_number || 'Unnumbered')}
            </h2>
            {!editMode && cheque.bank_name && <p className="text-xs text-white/40">{cheque.bank_name}</p>}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Pill value={displayStatus || 'received'} />
            {!editMode && (
              <button onClick={() => setEditMode(true)}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition" title="Edit">
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => editMode ? (setEditMode(false), setEditForm(INIT_EDIT(cheque))) : onClose()}
              className="text-white/40 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Amount hero */}
          <div className="text-center py-4 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}>
            {editMode ? (
              <input type="number" value={editForm.amount_aed} onChange={ef('amount_aed')}
                className="cr-inp text-center text-2xl font-bold tabular-nums w-48 mx-auto block"
                style={{ color: 'hsl(38 92% 55%)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }} />
            ) : (
              <p className="text-3xl font-bold tabular-nums" style={{ color: 'hsl(38 92% 55%)' }}>{fmtAed(cheque.amount_aed)}</p>
            )}
            <p className="text-xs text-white/40 mt-1.5">
              {LABEL(editMode ? editForm.purpose : (cheque.purpose || 'other'))} · {deriveTypeLabel(editMode ? { ...cheque, ...editForm } : cheque)}
            </p>
          </div>

          {/* EDIT FORM */}
          {editMode && (
            <section className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Edit Fields</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="cr-lbl">Cheque #</label><input value={editForm.cheque_number} onChange={ef('cheque_number')} className="cr-inp" /></div>
                <div><label className="cr-lbl">Bank Name</label><input value={editForm.bank_name} onChange={ef('bank_name')} className="cr-inp" /></div>
                <div><label className="cr-lbl">Payer</label><input value={editForm.payer_name} onChange={ef('payer_name')} className="cr-inp" /></div>
                <div><label className="cr-lbl">Payee</label><input value={editForm.payee_name} onChange={ef('payee_name')} className="cr-inp" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="cr-lbl">Purpose</label>
                  <select value={editForm.purpose} onChange={ef('purpose')} className="cr-inp">
                    {ALL_PURPOSE_OPTS.map(p => <option key={p} value={p}>{LABEL(p)}</option>)}
                  </select>
                </div>
                <div><label className="cr-lbl">Cheque Type</label>
                  <select value={editForm.cheque_type} onChange={ef('cheque_type')} className="cr-inp">
                    {TYPE_OPTS.map(t => <option key={t} value={t}>{LABEL(t)}</option>)}
                  </select>
                </div>
                <div><label className="cr-lbl">Status</label>
                  <select value={editForm.status} onChange={ef('status')} className="cr-inp">
                    {STATUS_OPTS.map(s => <option key={s} value={s}>{LABEL(s)}</option>)}
                  </select>
                </div>
                <div><label className="cr-lbl">Held By</label><input value={editForm.held_by} onChange={ef('held_by')} className="cr-inp" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="cr-lbl">Cheque Date</label><input type="date" value={editForm.cheque_date} onChange={ef('cheque_date')} className="cr-inp" /></div>
                <div><label className="cr-lbl">Issue Date</label><input type="date" value={editForm.issue_date} onChange={ef('issue_date')} className="cr-inp" /></div>
                <div><label className="cr-lbl">Received Date</label><input type="date" value={editForm.received_date} onChange={ef('received_date')} className="cr-inp" /></div>
                <div><label className="cr-lbl">Deposit Date</label><input type="date" value={editForm.deposit_date} onChange={ef('deposit_date')} className="cr-inp" /></div>
                <div><label className="cr-lbl">Cleared Date</label><input type="date" value={editForm.cleared_date} onChange={ef('cleared_date')} className="cr-inp" /></div>
                <div><label className="cr-lbl">Agent Email</label><input value={editForm.assigned_agent_email} onChange={ef('assigned_agent_email')} className="cr-inp" placeholder="agent@…" /></div>
                <div className="col-span-2"><label className="cr-lbl">Received By Email</label><input value={editForm.received_by_email} onChange={ef('received_by_email')} className="cr-inp" placeholder="admin@…" /></div>
              </div>
              <div><label className="cr-lbl">Notes</label><textarea value={editForm.notes} onChange={ef('notes')} rows={3} className="cr-inp resize-none" /></div>
            </section>
          )}

          {/* VIEW MODE — Key facts */}
          {!editMode && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-3">Key Details</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Payer', cheque.payer_name],
                  ['Payee', cheque.payee_name],
                  ['Cheque Date', fmtDate(cheque.cheque_date)],
                  ['Issue Date', fmtDate(cheque.issue_date)],
                  ['Received', fmtDate(cheque.received_date)],
                  ['Deposit Due', fmtDate(cheque.deposit_date)],
                  ['Cleared / Bounced', fmtDate(cheque.cleared_date)],
                  ['Held By', cheque.held_by],
                  ['Agent', cheque.assigned_agent_email ? cheque.assigned_agent_email.split('@')[0] : null],
                  ['Received By', cheque.received_by_email ? cheque.received_by_email.split('@')[0] : null],
                  ['Type', deriveTypeLabel(cheque)],
                  ['6-Mo Stale At', fmtDate(cheque.stale_at)],
                ].filter(([, v]) => v && v !== '—').map(([label, value]) => (
                  <div key={label} className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-0.5">{label}</p>
                    <p className="text-xs font-medium text-white/80 truncate">{value}</p>
                  </div>
                ))}
              </div>
              {cheque.notes && (
                <div className="mt-2 rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-0.5">Notes</p>
                  <p className="text-xs text-white/60 whitespace-pre-wrap">{cheque.notes}</p>
                </div>
              )}
            </section>
          )}

          {/* VAT breakdown — live in edit mode */}
          {vatBreakdown && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-3">
                Commission VAT Breakdown {editMode && <span className="text-white/25 normal-case font-normal">(live)</span>}
              </p>
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                {[
                  ['Total (VAT Incl.)', fmtAed(vatBreakdown.gross), 'hsl(38 92% 55%)'],
                  ['VAT @ 5%', fmtAed(vatBreakdown.vat), '#fca5a5'],
                  ['Net Commission', fmtAed(vatBreakdown.net), '#4ade80'],
                ].map(([label, value, color], i) => (
                  <div key={label} className="flex justify-between items-center px-4 py-3"
                    style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent' }}>
                    <span className="text-xs text-white/50">{label}</span>
                    <span className="text-sm font-semibold tabular-nums" style={{ color }}>{value}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-white/25 mt-1">Display only · net = amount ÷ 1.05</p>
            </section>
          )}

          {/* Drive / image archive */}
          {(cheque.cheque_image_url || cheque.cheque_drive_url) && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-2.5">Scan Archive</p>
              <div className="space-y-2">
                {cheque.cheque_image_url && (
                  <a href={cheque.cheque_image_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium hover:opacity-80 transition"
                    style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', color: 'hsl(38 92% 55%)' }}>
                    <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                    View Scan
                    <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                  </a>
                )}
                {cheque.cheque_drive_url && (
                  <a href={cheque.cheque_drive_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium hover:opacity-80 transition"
                    style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', color: '#93c5fd' }}>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    View in Google Drive
                    <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                  </a>
                )}
                {cheque.cheque_image_url && (
                  <a href={cheque.cheque_image_url} download
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium hover:opacity-80 transition"
                    style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', color: '#4ade80' }}>
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    Download
                  </a>
                )}
              </div>
            </section>
          )}

          {/* Lifecycle — view mode only */}
          {!editMode && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-3">Lifecycle</p>
              {[
                { label: 'Received', date: cheque.received_date, done: true, color: '#a5b4fc' },
                { label: 'Deposited', date: cheque.deposit_date, done: ['deposited', 'cleared', 'bounced', 'returned'].includes(cheque.status), color: '#67e8f9' },
                {
                  label: ['bounced', 'returned'].includes(cheque.status) ? LABEL(cheque.status) : 'Cleared',
                  date: cheque.cleared_date,
                  done: ['cleared', 'bounced', 'returned'].includes(cheque.status),
                  color: cheque.status === 'bounced' ? '#fca5a5' : cheque.status === 'returned' ? '#fbbf24' : '#4ade80',
                },
              ].map((step, i) => (
                <div key={step.label} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center border-2 mt-0.5"
                      style={step.done ? { background: step.color + '22', borderColor: step.color } : { background: 'transparent', borderColor: 'rgba(255,255,255,0.12)' }}>
                      {step.done && <div className="w-2 h-2 rounded-full" style={{ background: step.color }} />}
                    </div>
                    {i < 2 && <div className="w-0.5 h-6 mt-1" style={{ background: 'rgba(255,255,255,0.07)' }} />}
                  </div>
                  <div className="pb-4">
                    <p className="text-xs font-semibold" style={{ color: step.done ? step.color : 'rgba(255,255,255,0.25)' }}>{step.label}</p>
                    <p className="text-[10px] text-white/30">{fmtDate(step.date)}</p>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Status quick actions — view mode */}
          {!editMode && (STATUS_ACTIONS[cheque.status] || []).length > 0 && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-2.5">Quick Actions</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_ACTIONS[cheque.status].map(action => {
                  const s = STATUS_STYLE[action] || {};
                  return (
                    <button key={action} onClick={() => handleStatusAction(action)} disabled={!!updatingStatus}
                      className="px-4 py-2 rounded-lg text-xs font-semibold border transition-all active:scale-95 disabled:opacity-40"
                      style={{ background: s.bg, color: s.color, borderColor: s.border }}>
                      {updatingStatus === action && <Loader2 className="w-3 h-3 inline animate-spin mr-1" />}
                      Mark {LABEL(action)}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Delete — view mode */}
          {!editMode && (
            <section className="border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              {confirmDelete ? (
                <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p className="text-sm font-semibold text-red-400 mb-1">Delete this cheque record?</p>
                  <p className="text-xs text-white/40 mb-3">The Google Drive archive copy is preserved. This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDelete(false)}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>Cancel</button>
                    <button onClick={handleDelete} disabled={deleting}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 flex items-center justify-center gap-1.5"
                      style={{ background: 'rgba(239,68,68,0.8)', color: 'white' }}>
                      {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Delete Record
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: '#fca5a5' }}>
                  <Trash2 className="w-3.5 h-3.5 inline mr-1.5" />
                  Delete Cheque Record
                </button>
              )}
            </section>
          )}
        </div>

        {/* Edit mode footer — sticky */}
        {editMode && (
          <div className="px-6 py-4 border-t flex gap-3 shrink-0"
            style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'hsl(222 47% 9%)' }}>
            <button onClick={() => { setEditMode(false); setEditForm(INIT_EDIT(cheque)); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
              Cancel
            </button>
            <button onClick={handleSaveEdit} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: 'hsl(38 92% 50%)', color: '#1a1a2e' }}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><Save className="w-4 h-4" />Save Changes</>}
            </button>
          </div>
        )}
      </div>

      <style>{`
        .cr-lbl { display:block; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:rgba(255,255,255,0.4); margin-bottom:4px; }
        .cr-inp { width:100%; padding:8px 12px; border-radius:10px; font-size:13px; outline:none; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.9); font-family:inherit; }
        .cr-inp:focus { border-color:hsl(38 92% 50% / 0.5); box-shadow:0 0 0 2px hsl(38 92% 50% / 0.1); }
        select.cr-inp option { background:#1a1a2e; color:white; }
      `}</style>
    </div>
  );
}