import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Plus, Search, X, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_OPTS = ['received', 'deposited', 'cleared', 'bounced', 'returned', 'cancelled'];
const TYPE_OPTS   = ['current', 'post_dated'];
const PURPOSE_OPTS = ['commission', 'rent', 'deposit', 'service_charge', 'other'];

const STATUS_STYLE = {
  received:   { bg: 'rgba(99,102,241,0.15)',  color: '#a5b4fc', border: 'rgba(99,102,241,0.3)' },
  deposited:  { bg: 'rgba(6,182,212,0.15)',   color: '#67e8f9', border: 'rgba(6,182,212,0.3)' },
  cleared:    { bg: 'rgba(34,197,94,0.15)',   color: '#4ade80', border: 'rgba(34,197,94,0.3)' },
  bounced:    { bg: 'rgba(239,68,68,0.15)',   color: '#fca5a5', border: 'rgba(239,68,68,0.3)' },
  returned:   { bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
  cancelled:  { bg: 'rgba(148,163,184,0.12)', color: 'rgba(148,163,184,0.8)', border: 'rgba(148,163,184,0.25)' },
};

const TYPE_STYLE = {
  current:     { bg: 'rgba(34,197,94,0.1)',  color: '#4ade80', border: 'rgba(34,197,94,0.25)' },
  post_dated:  { bg: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
};

const LABEL = (str) => str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const fmtAed = (n) => n != null ? `AED ${Number(n).toLocaleString('en-AE', { minimumFractionDigits: 0 })}` : '—';
const fmtDate = (d) => { try { return d ? format(new Date(d), 'd MMM yyyy') : '—'; } catch { return d || '—'; } };

function Pill({ value, styleMap }) {
  const s = styleMap[value] || { bg: 'rgba(148,163,184,0.1)', color: 'rgba(255,255,255,0.6)', border: 'rgba(148,163,184,0.2)' };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      {LABEL(value)}
    </span>
  );
}

const EMPTY_FORM = {
  cheque_number: '',
  bank_name: '',
  payer_name: '',
  amount_aed: '',
  cheque_date: '',
  received_date: format(new Date(), 'yyyy-MM-dd'),
  received_by_email: '',
  cheque_type: 'current',
  status: 'received',
  purpose: 'other',
  linked_invoice_id: '',
  linked_landlord_id: '',
  notes: '',
};

export default function Cheques() {
  const qc = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');

  // Pre-fill received_by_email from current user
  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.email) setForm(f => ({ ...f, received_by_email: u.email }));
    }).catch(() => {});
  }, []);

  const { data: cheques = [], isLoading } = useQuery({
    queryKey: ['cheques'],
    queryFn: () => base44.entities.Cheque.list('-received_date', 500),
  });

  // ─── KPIs ─────────────────────────────────────────────────────────────────
  const kpi = {
    received:  cheques.filter(c => c.status === 'received').length,
    deposited: cheques.filter(c => c.status === 'deposited').length,
    cleared:   cheques.filter(c => c.status === 'cleared').length,
    bounced:   cheques.filter(c => c.status === 'bounced').length,
    pending_total: cheques
      .filter(c => ['received', 'deposited'].includes(c.status))
      .reduce((s, c) => s + (c.amount_aed || 0), 0),
  };

  // ─── Filtering ────────────────────────────────────────────────────────────
  const filtered = cheques.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (filterType !== 'all' && c.cheque_type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return (c.cheque_number || '').toLowerCase().includes(q)
        || (c.payer_name || '').toLowerCase().includes(q)
        || (c.bank_name || '').toLowerCase().includes(q);
    }
    return true;
  });

  // ─── Save ─────────────────────────────────────────────────────────────────
  const openNew = async () => {
    const u = await base44.auth.me().catch(() => null);
    setForm({
      ...EMPTY_FORM,
      received_date: format(new Date(), 'yyyy-MM-dd'),
      received_by_email: u?.email || '',
    });
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.cheque_number.trim()) return toast.error('Cheque number is required');
    if (!form.payer_name.trim()) return toast.error('Payer name is required');
    if (!form.amount_aed || isNaN(parseFloat(form.amount_aed))) return toast.error('Amount is required');
    if (!form.received_date) return toast.error('Received date is required');

    setSaving(true);
    try {
      const payload = {
        ...form,
        amount_aed: parseFloat(form.amount_aed),
        acknowledgement_generated: false,
      };
      // Remove empty optional fields
      ['cheque_date', 'bank_name', 'linked_invoice_id', 'linked_landlord_id', 'notes', 'receipt_pdf_url'].forEach(k => {
        if (!payload[k]) delete payload[k];
      });
      await base44.entities.Cheque.create(payload);
      toast.success('Cheque logged successfully');
      qc.invalidateQueries({ queryKey: ['cheques'] });
      setSheetOpen(false);
    } catch (err) {
      toast.error('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const sf = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="page-root">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title text-2xl font-semibold mb-1">Cheques</h1>
          <p className="page-subtitle">{cheques.length} cheque{cheques.length !== 1 ? 's' : ''} logged</p>
        </div>
        <button onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: 'hsl(38 92% 50%)', color: '#1a1a2e' }}>
          <Plus className="w-4 h-4" /> Log Cheque
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Received',  value: kpi.received,  style: STATUS_STYLE.received },
          { label: 'Deposited', value: kpi.deposited, style: STATUS_STYLE.deposited },
          { label: 'Cleared',   value: kpi.cleared,   style: STATUS_STYLE.cleared },
          { label: 'Bounced',   value: kpi.bounced,   style: STATUS_STYLE.bounced },
        ].map(({ label, value, style }) => (
          <div key={label} className="glass-card px-4 py-3 text-center">
            <p className="text-xl font-bold tabular-nums" style={{ color: style.color }}>{value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
        <div className="glass-card px-4 py-3 text-center md:col-span-1">
          <p className="text-lg font-bold tabular-nums gold-text">{fmtAed(kpi.pending_total)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Pending (Rcv + Dep)</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search cheque #, payer, bank…"
            className="pl-8 pr-3 py-2 rounded-lg text-xs outline-none w-56"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }}>
          <option value="all">All Statuses</option>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{LABEL(s)}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }}>
          <option value="all">All Types</option>
          {TYPE_OPTS.map(t => <option key={t} value={t}>{LABEL(t)}</option>)}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No cheques found.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full glass-table">
              <thead>
                <tr>
                  <th className="text-left">Cheque #</th>
                  <th className="text-left">Payer</th>
                  <th className="text-right">Amount</th>
                  <th className="text-left">Bank</th>
                  <th className="text-left">Received</th>
                  <th className="text-left">Type</th>
                  <th className="text-left">Purpose</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Logged By</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td className="font-mono font-semibold text-white/90">{c.cheque_number || '—'}</td>
                    <td className="font-medium text-white/90">{c.payer_name}</td>
                    <td className="text-right tabular-nums font-semibold" style={{ color: 'hsl(38 92% 60%)' }}>{fmtAed(c.amount_aed)}</td>
                    <td className="text-white/60">{c.bank_name || '—'}</td>
                    <td className="text-white/70">{fmtDate(c.received_date)}</td>
                    <td><Pill value={c.cheque_type || 'current'} styleMap={TYPE_STYLE} /></td>
                    <td className="text-white/60 capitalize">{c.purpose ? LABEL(c.purpose) : '—'}</td>
                    <td><Pill value={c.status || 'received'} styleMap={STATUS_STYLE} /></td>
                    <td className="text-white/50 text-[11px]">{c.received_by_email ? c.received_by_email.split('@')[0] : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Log Cheque Sheet ──────────────────────────────────────────────────── */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setSheetOpen(false)} />
          <div className="w-full max-w-lg h-full overflow-y-auto flex flex-col"
            style={{ background: 'hsl(222 47% 9%)', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <h2 className="font-display text-lg font-semibold text-white">Log New Cheque</h2>
              <button onClick={() => setSheetOpen(false)} className="text-muted-foreground hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 px-6 py-5 space-y-4">
              {/* Cheque # + Bank */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Cheque Number <span className="text-red-400">*</span></label>
                  <input value={form.cheque_number} onChange={sf('cheque_number')} placeholder="e.g. 000123456" className="field-input" />
                </div>
                <div>
                  <label className="field-label">Bank Name</label>
                  <input value={form.bank_name} onChange={sf('bank_name')} placeholder="e.g. Emirates NBD" className="field-input" />
                </div>
              </div>

              {/* Payer */}
              <div>
                <label className="field-label">Payer Name <span className="text-red-400">*</span></label>
                <input value={form.payer_name} onChange={sf('payer_name')} placeholder="Full name or company" className="field-input" />
              </div>

              {/* Amount + Purpose */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Amount (AED) <span className="text-red-400">*</span></label>
                  <input type="number" value={form.amount_aed} onChange={sf('amount_aed')} placeholder="0" className="field-input" />
                </div>
                <div>
                  <label className="field-label">Purpose</label>
                  <select value={form.purpose} onChange={sf('purpose')} className="field-input">
                    {PURPOSE_OPTS.map(p => <option key={p} value={p}>{LABEL(p)}</option>)}
                  </select>
                </div>
              </div>

              {/* Cheque date + Received date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Cheque Date</label>
                  <input type="date" value={form.cheque_date} onChange={sf('cheque_date')} className="field-input" />
                </div>
                <div>
                  <label className="field-label">Received Date <span className="text-red-400">*</span></label>
                  <input type="date" value={form.received_date} onChange={sf('received_date')} className="field-input" />
                </div>
              </div>

              {/* Type + Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Type</label>
                  <select value={form.cheque_type} onChange={sf('cheque_type')} className="field-input">
                    {TYPE_OPTS.map(t => <option key={t} value={t}>{LABEL(t)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Status</label>
                  <select value={form.status} onChange={sf('status')} className="field-input">
                    {STATUS_OPTS.map(s => <option key={s} value={s}>{LABEL(s)}</option>)}
                  </select>
                </div>
              </div>

              {/* Received by */}
              <div>
                <label className="field-label">Received By (email)</label>
                <input value={form.received_by_email} onChange={sf('received_by_email')} placeholder="admin@erudite-estate.com" className="field-input" />
              </div>

              {/* Optional links */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Linked Invoice ID <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <input value={form.linked_invoice_id} onChange={sf('linked_invoice_id')} placeholder="Invoice ID" className="field-input" />
                </div>
                <div>
                  <label className="field-label">Linked Landlord ID <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <input value={form.linked_landlord_id} onChange={sf('linked_landlord_id')} placeholder="Landlord ID" className="field-input" />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="field-label">Notes</label>
                <textarea value={form.notes} onChange={sf('notes')} rows={3} placeholder="Any additional notes…" className="field-input resize-none" />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <button onClick={() => setSheetOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all active:scale-95"
                style={{ background: 'hsl(38 92% 50%)', color: '#1a1a2e' }}>
                {saving ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Saving…</span> : 'Log Cheque'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .field-label { display: block; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.4); margin-bottom: 5px; }
        .field-input { width: 100%; padding: 8px 12px; border-radius: 10px; font-size: 13px; outline: none; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.9); }
        .field-input:focus { border-color: hsl(38 92% 50% / 0.5); box-shadow: 0 0 0 2px hsl(38 92% 50% / 0.1); }
        select.field-input option { background: #1a1a2e; color: white; }
      `}</style>
    </div>
  );
}