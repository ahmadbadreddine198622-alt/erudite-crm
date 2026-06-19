import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { format, addDays, startOfMonth, endOfMonth, isValid, differenceInDays } from 'date-fns';
import {
  Plus, Search, X, Loader2, FileText, ImageIcon,
  ChevronUp, ChevronDown, ArrowUpDown, AlertTriangle, Clock, Lock,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Constants ────────────────────────────────────────────────────────────────
const STATUS_OPTS = ['received', 'deposited', 'cleared', 'bounced', 'returned', 'cancelled', 'replaced'];

const STATUS_STYLE = {
  received:  { bg: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: 'rgba(99,102,241,0.3)' },
  deposited: { bg: 'rgba(6,182,212,0.15)',  color: '#67e8f9', border: 'rgba(6,182,212,0.3)' },
  cleared:   { bg: 'rgba(34,197,94,0.15)',  color: '#4ade80', border: 'rgba(34,197,94,0.3)' },
  bounced:   { bg: 'rgba(239,68,68,0.15)',  color: '#fca5a5', border: 'rgba(239,68,68,0.3)' },
  returned:  { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
  cancelled: { bg: 'rgba(148,163,184,0.1)', color: 'rgba(148,163,184,0.8)', border: 'rgba(148,163,184,0.25)' },
  replaced:  { bg: 'rgba(168,85,247,0.15)', color: '#d8b4fe', border: 'rgba(168,85,247,0.3)' },
};

const SALE_PURPOSES = ['commission', 'booking', 'dld_fee', 'managers'];
const ALL_PURPOSE_OPTS = ['commission', 'rent', 'deposit', 'service_charge', 'booking', 'dld_fee', 'managers', 'other'];
const TYPE_OPTS = ['current', 'post_dated'];

const deriveSide = (c) => {
  if (c.purpose === 'rent' || c.cheque_type === 'post_dated') return 'rent';
  if (SALE_PURPOSES.includes(c.purpose)) return 'sale';
  return 'other';
};
const deriveTypeLabel = (c) => {
  const side = deriveSide(c);
  if (side === 'rent') return c.cheque_type === 'post_dated' ? 'Post-Dated' : 'Rent';
  if (side === 'sale') return LABEL(c.purpose);
  return c.purpose ? LABEL(c.purpose) : 'Other';
};

const LABEL = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const fmtAed = (n) => n != null ? `AED ${Number(n).toLocaleString('en-AE', { minimumFractionDigits: 0 })}` : '—';
const fmtDate = (d) => {
  try { if (!d) return '—'; const dt = new Date(d); return isValid(dt) ? format(dt, 'd MMM yyyy') : d; }
  catch { return d || '—'; }
};

const STATUS_ACTIONS = {
  received:  ['deposited', 'bounced', 'returned', 'cancelled'],
  deposited: ['cleared', 'bounced', 'returned'],
  bounced:   ['replaced'],
  returned:  ['replaced'],
  cancelled: [], cleared: [], replaced: [],
};

const EMPTY_FORM = {
  cheque_number: '', bank_name: '', payer_name: '', payee_name: '',
  amount_aed: '', cheque_date: '', received_date: '',
  deposit_date: '', received_by_email: '', assigned_agent_email: '',
  cheque_type: 'current', status: 'received', purpose: 'commission',
  held_by: '', notes: '', cheque_image_url: '',
};

// ── Sub-components ────────────────────────────────────────────────────────────
function Pill({ value, styleMap }) {
  const s = styleMap?.[value] || { bg: 'rgba(148,163,184,0.1)', color: 'rgba(255,255,255,0.6)', border: 'rgba(148,163,184,0.2)' };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      {LABEL(value)}
    </span>
  );
}

function AgentChip({ email }) {
  if (!email) return <span className="text-white/30 text-xs">—</span>;
  const name = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.25)' }}>
      {name}
    </span>
  );
}

function SortIcon({ field, sort }) {
  if (sort.field !== field) return <ArrowUpDown className="w-3 h-3 opacity-30 inline ml-1" />;
  return sort.dir === 'asc'
    ? <ChevronUp className="w-3 h-3 inline ml-1" style={{ color: 'hsl(38 92% 50%)' }} />
    : <ChevronDown className="w-3 h-3 inline ml-1" style={{ color: 'hsl(38 92% 50%)' }} />;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ChequeRegister() {
  const { isAdmin, loading: authLoading, user } = useCurrentUser();
  const qc = useQueryClient();

  // ── State ─────────────────────────────────────────────────────────────────
  const [sideFilter, setSideFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ field: 'received_date', dir: 'desc' });
  const [selectedCheque, setSelectedCheque] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [scanDragOver, setScanDragOver] = useState(false);
  const [scanUploading, setScanUploading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const fileRef = useRef(null);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: cheques = [], isLoading } = useQuery({
    queryKey: ['cheques-register'],
    queryFn: () => base44.entities.Cheque.list('-received_date', 1000),
  });

  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    if (user?.email) setForm(f => ({ ...f, received_by_email: user.email }));
  }, [user?.email]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const in30Days = addDays(today, 30);

    const live = cheques.filter(c => ['received', 'deposited'].includes(c.status));
    const dueToDeposit = cheques.filter(c =>
      c.deposit_date && c.status === 'received' &&
      new Date(c.deposit_date) >= today && new Date(c.deposit_date) <= in30Days
    ).sort((a, b) => new Date(a.deposit_date) - new Date(b.deposit_date));

    const clearedMonth = cheques.filter(c => {
      if (c.status !== 'cleared' || !c.cleared_date) return false;
      const cd = new Date(c.cleared_date);
      return cd >= monthStart && cd <= monthEnd;
    });
    const bounced = cheques.filter(c => ['bounced', 'returned'].includes(c.status));
    const expiring = cheques.filter(c => {
      if (c.is_stale) return true;
      if (!c.stale_at) return false;
      const sd = new Date(c.stale_at);
      return isValid(sd) && sd >= today && sd <= in30Days;
    });

    const dueRange = dueToDeposit.length >= 2
      ? `${fmtDate(dueToDeposit[0].deposit_date)} – ${fmtDate(dueToDeposit[dueToDeposit.length - 1].deposit_date)}`
      : dueToDeposit.length === 1 ? fmtDate(dueToDeposit[0].deposit_date) : null;

    return {
      inRegisterCount: live.length,
      inRegisterSum: live.reduce((s, c) => s + (c.amount_aed || 0), 0),
      dueCount: dueToDeposit.length,
      dueSum: dueToDeposit.reduce((s, c) => s + (c.amount_aed || 0), 0),
      dueRange,
      clearedCount: clearedMonth.length,
      clearedSum: clearedMonth.reduce((s, c) => s + (c.amount_aed || 0), 0),
      bouncedCount: bounced.length,
      expiringCount: expiring.length,
    };
  }, [cheques, today]);

  // ── Due next 14 days strip ─────────────────────────────────────────────────
  const dueNext14 = useMemo(() => {
    const in14 = addDays(today, 14);
    return cheques
      .filter(c => c.deposit_date && c.status === 'received' && new Date(c.deposit_date) >= today && new Date(c.deposit_date) <= in14)
      .sort((a, b) => new Date(a.deposit_date) - new Date(b.deposit_date));
  }, [cheques, today]);

  // ── Filtered & Sorted ──────────────────────────────────────────────────────
  const in30Days = addDays(today, 30);

  const filtered = useMemo(() => {
    let arr = cheques;
    if (sideFilter !== 'all') arr = arr.filter(c => deriveSide(c) === sideFilter);
    if (statusFilter !== 'all') arr = arr.filter(c => c.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(c =>
        (c.cheque_number || '').toLowerCase().includes(q) ||
        (c.payer_name || '').toLowerCase().includes(q) ||
        (c.payee_name || '').toLowerCase().includes(q) ||
        (c.bank_name || '').toLowerCase().includes(q) ||
        (c.held_by || '').toLowerCase().includes(q)
      );
    }
    return [...arr].sort((a, b) => {
      let av = a[sort.field], bv = b[sort.field];
      if (sort.field === 'amount_aed') { av = Number(av) || 0; bv = Number(bv) || 0; }
      else if (['deposit_date', 'received_date', 'cheque_date', 'stale_at', 'cleared_date'].includes(sort.field)) {
        av = av ? new Date(av).getTime() : 0; bv = bv ? new Date(bv).getTime() : 0;
      } else { av = (av || '').toString().toLowerCase(); bv = (bv || '').toString().toLowerCase(); }
      return sort.dir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }, [cheques, sideFilter, statusFilter, search, sort]);

  const toggleSort = (field) =>
    setSort(prev => prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' });

  // ── Scan (AI intake) ──────────────────────────────────────────────────────
  const processScan = async (file) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      return toast.error('Please upload an image or PDF');
    }
    setScanUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const extracted = await base44.integrations.Core.InvokeLLM({
        prompt: 'Extract cheque details from this cheque image. Return all visible fields as JSON. Use null for any field not visible or unclear.',
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            cheque_number: { type: 'string' },
            bank_name: { type: 'string' },
            payer_name: { type: 'string' },
            payee_name: { type: 'string' },
            amount_aed: { type: 'number' },
            cheque_date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
          },
        },
      });
      const p = extracted || {};
      setForm({
        ...EMPTY_FORM,
        received_date: format(today, 'yyyy-MM-dd'),
        received_by_email: user?.email || '',
        cheque_image_url: file_url,
        cheque_number: p.cheque_number || '',
        bank_name: p.bank_name || '',
        payer_name: p.payer_name || '',
        payee_name: p.payee_name || '',
        amount_aed: p.amount_aed ? String(p.amount_aed) : '',
        cheque_date: p.cheque_date || '',
      });
      setAddOpen(true);
      toast.success('Cheque scanned — review and confirm below');
    } catch (err) {
      toast.error('Scan failed: ' + err.message);
    } finally {
      setScanUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setScanDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processScan(file);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.cheque_number.trim()) return toast.error('Cheque number is required');
    if (!form.payer_name.trim()) return toast.error('Payer name is required');
    if (!form.amount_aed || isNaN(parseFloat(form.amount_aed))) return toast.error('Amount is required');
    if (!form.received_date) return toast.error('Received date is required');
    setSaving(true);
    try {
      const payload = { ...form, amount_aed: parseFloat(form.amount_aed) };
      ['deposit_date', 'cheque_date', 'bank_name', 'payee_name', 'held_by',
        'assigned_agent_email', 'linked_invoice_id', 'linked_landlord_id', 'notes', 'cheque_image_url']
        .forEach(k => { if (!payload[k]) delete payload[k]; });
      await base44.entities.Cheque.create(payload);
      toast.success('Cheque logged');
      qc.invalidateQueries({ queryKey: ['cheques-register'] });
      setAddOpen(false);
    } catch (err) {
      toast.error('Failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Status action ─────────────────────────────────────────────────────────
  const handleStatusAction = async (chequeId, newStatus) => {
    setUpdatingStatus(newStatus);
    try {
      const patch = { status: newStatus };
      if (['cleared', 'bounced', 'returned'].includes(newStatus)) {
        patch.cleared_date = format(today, 'yyyy-MM-dd');
      }
      await base44.entities.Cheque.update(chequeId, patch);
      toast.success(`Marked as ${LABEL(newStatus)}`);
      qc.invalidateQueries({ queryKey: ['cheques-register'] });
      setSelectedCheque(prev => prev ? { ...prev, ...patch } : prev);
    } catch (err) {
      toast.error('Update failed: ' + err.message);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const sf = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  // ── Admin gate ────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="page-root flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="page-root flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-12 text-center max-w-sm">
          <Lock className="w-10 h-10 text-white/20 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-1">Restricted Access</h2>
          <p className="text-sm text-white/40">Cheque Register is available to administrators only.</p>
        </div>
      </div>
    );
  }

  // VAT breakdown (display only, commission purpose)
  const vatBreakdown = selectedCheque?.purpose === 'commission' && selectedCheque?.amount_aed
    ? { gross: selectedCheque.amount_aed, vat: selectedCheque.amount_aed * 5 / 105, net: selectedCheque.amount_aed / 1.05 }
    : null;

  const COLS = [
    { label: 'Cheque', field: 'cheque_number' },
    { label: 'Type', field: 'purpose' },
    { label: 'Amount', field: 'amount_aed' },
    { label: 'Payer', field: 'payer_name' },
    { label: 'Payee', field: 'payee_name' },
    { label: 'Deposit', field: 'deposit_date' },
    { label: '6-Mo Expiry', field: 'stale_at' },
    { label: 'Agent', field: 'assigned_agent_email' },
    { label: 'Held By', field: 'held_by' },
    { label: 'Status', field: 'status' },
  ];

  return (
    <div className="page-root">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1.5" style={{ color: 'hsl(38 92% 50%)' }}>
            ERUDITE · FINANCE
          </p>
          <h1 className="page-title text-3xl mb-1">Cheque Register</h1>
          <p className="page-subtitle">Track, deposit and reconcile all incoming cheques in one place</p>
        </div>
        <button
          onClick={() => { setForm({ ...EMPTY_FORM, received_date: format(today, 'yyyy-MM-dd'), received_by_email: user?.email || '' }); setAddOpen(true); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 shrink-0"
          style={{ background: 'hsl(38 92% 50%)', color: '#1a1a2e' }}>
          <Plus className="w-4 h-4" /> Add Cheque
        </button>
      </div>

      {/* ── Sale / Rent / All toggle ─────────────────────────────────────── */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {[{ key: 'all', label: 'All' }, { key: 'sale', label: 'Sale' }, { key: 'rent', label: 'Rent' }].map(({ key, label }) => (
          <button key={key} onClick={() => setSideFilter(key)}
            className="px-5 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={sideFilter === key ? { background: 'hsl(38 92% 50%)', color: '#1a1a2e' } : { color: 'rgba(255,255,255,0.5)' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── 5 KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="glass-card px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">In Register</p>
          <p className="text-xl font-bold tabular-nums" style={{ color: '#a5b4fc' }}>{kpi.inRegisterCount}</p>
          <p className="text-[11px] text-white/40 mt-0.5 truncate">{fmtAed(kpi.inRegisterSum)}</p>
        </div>
        <div className="glass-card px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Due to Deposit</p>
          <p className="text-xl font-bold tabular-nums" style={{ color: '#67e8f9' }}>{kpi.dueCount}</p>
          <p className="text-[11px] text-white/40 mt-0.5 truncate">{kpi.dueRange || fmtAed(kpi.dueSum)}</p>
        </div>
        <div className="glass-card px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Cleared This Month</p>
          <p className="text-xl font-bold tabular-nums" style={{ color: '#4ade80' }}>{kpi.clearedCount}</p>
          <p className="text-[11px] text-white/40 mt-0.5 truncate">{fmtAed(kpi.clearedSum)}</p>
        </div>
        <div className="glass-card px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Bounced</p>
          <p className="text-xl font-bold tabular-nums" style={{ color: '#fca5a5' }}>{kpi.bouncedCount}</p>
          <p className="text-[11px] text-white/40 mt-0.5">bounced or returned</p>
        </div>
        <div className="glass-card px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Expiring ≤30 Days</p>
          <p className="text-xl font-bold tabular-nums" style={{ color: kpi.expiringCount > 0 ? '#fbbf24' : 'rgba(255,255,255,0.5)' }}>{kpi.expiringCount}</p>
          <p className="text-[11px] text-white/40 mt-0.5">6-mo stale approaching</p>
        </div>
      </div>

      {/* ── Scan Drop Zone ─────────────────────────────────────────────────── */}
      <div
        className="mb-5 rounded-xl border-2 border-dashed transition-all cursor-pointer"
        style={{
          borderColor: scanDragOver ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.12)',
          background: scanDragOver ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.025)',
          padding: '18px 22px',
        }}
        onDragOver={(e) => { e.preventDefault(); setScanDragOver(true); }}
        onDragLeave={() => setScanDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !scanUploading && fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) processScan(f); e.target.value = ''; }} />
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
            {scanUploading
              ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'hsl(38 92% 50%)' }} />
              : <ImageIcon className="w-5 h-5" style={{ color: 'hsl(38 92% 50%)' }} />}
          </div>
          <div>
            <p className="text-sm font-semibold text-white/80">
              {scanUploading ? 'Reading cheque with AI…' : 'Drop a cheque scan or photo to auto-fill'}
            </p>
            <p className="text-xs text-white/35 mt-0.5">
              {scanUploading ? 'Extracting cheque number, bank, payer, amount and date' : 'AI extracts all visible fields · PNG / JPEG / PDF accepted'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Due for Deposit strip ──────────────────────────────────────────── */}
      {dueNext14.length > 0 && (
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 inline" style={{ color: '#67e8f9' }} />
            Due for Deposit — Next 14 Days ({dueNext14.length})
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dueNext14.map(c => {
              const daysLeft = differenceInDays(new Date(c.deposit_date), today);
              const urgent = daysLeft <= 3;
              return (
                <button key={c.id} onClick={() => setSelectedCheque(c)}
                  className="shrink-0 glass-card px-4 py-3 text-left rounded-xl hover:border-accent/20 transition-all min-w-[155px]"
                  style={{ borderColor: urgent ? 'rgba(252,165,165,0.2)' : undefined }}>
                  <p className="text-[11px] font-mono font-semibold text-white/80 truncate">{c.cheque_number || '—'}</p>
                  <p className="text-sm font-bold tabular-nums mt-0.5" style={{ color: urgent ? '#fca5a5' : '#67e8f9' }}>{fmtAed(c.amount_aed)}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">
                    {daysLeft === 0 ? 'Due today' : daysLeft === 1 ? 'Due tomorrow' : `Due in ${daysLeft}d`}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search cheque #, payer, payee, bank…"
            className="pl-8 pr-3 py-2 rounded-lg text-xs outline-none w-64"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }}>
          <option value="all">All Statuses</option>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{LABEL(s)}</option>)}
        </select>
        {filtered.length > 0 && (
          <span className="flex items-center text-xs text-white/30 px-2">{filtered.length} cheque{filtered.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <FileText className="w-10 h-10 mx-auto mb-3 text-white/15" />
          <p className="text-sm text-white/40">No cheques match your filters.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full glass-table">
              <thead>
                <tr>
                  {COLS.map(col => (
                    <th key={col.field} className="text-left cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleSort(col.field)}>
                      {col.label}<SortIcon field={col.field} sort={sort} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const isExpiring = c.is_stale || (c.stale_at && new Date(c.stale_at) <= in30Days);
                  return (
                    <tr key={c.id} className="cursor-pointer" onClick={() => setSelectedCheque(c)}>
                      <td>
                        <span className="font-mono font-semibold text-white/90">{c.cheque_number || '—'}</span>
                        {c.bank_name && <span className="block text-[10px] text-white/40 mt-0.5">{c.bank_name}</span>}
                      </td>
                      <td className="text-xs text-white/55">{deriveTypeLabel(c)}</td>
                      <td className="text-right tabular-nums font-semibold whitespace-nowrap" style={{ color: 'hsl(38 92% 60%)' }}>{fmtAed(c.amount_aed)}</td>
                      <td className="font-medium text-white/85">{c.payer_name || '—'}</td>
                      <td className="text-white/55">{c.payee_name || '—'}</td>
                      <td className="text-white/55 whitespace-nowrap">{fmtDate(c.deposit_date)}</td>
                      <td className="whitespace-nowrap">
                        {c.stale_at ? (
                          <span className="flex items-center gap-1 text-[11px]" style={{ color: isExpiring ? '#fbbf24' : 'rgba(255,255,255,0.35)' }}>
                            {isExpiring && <AlertTriangle className="w-3 h-3 shrink-0" />}
                            {fmtDate(c.stale_at)}
                          </span>
                        ) : c.is_stale ? (
                          <span className="flex items-center gap-1 text-[11px] text-amber-400">
                            <AlertTriangle className="w-3 h-3" /> Stale
                          </span>
                        ) : <span className="text-white/20">—</span>}
                      </td>
                      <td><AgentChip email={c.assigned_agent_email} /></td>
                      <td className="text-white/45 text-xs">{c.held_by || '—'}</td>
                      <td><Pill value={c.status || 'received'} styleMap={STATUS_STYLE} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Detail Drawer ──────────────────────────────────────────────────── */}
      {selectedCheque && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="flex-1 bg-black/50" onClick={() => setSelectedCheque(null)} />
          <div className="w-full max-w-md h-full overflow-y-auto flex flex-col"
            style={{ background: 'hsl(222 47% 9%)', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            {/* Header */}
            <div className="px-6 py-4 border-b flex items-start justify-between gap-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-0.5">Cheque Detail</p>
                <h2 className="font-mono text-xl font-bold text-white">{selectedCheque.cheque_number || 'Unnumbered'}</h2>
                {selectedCheque.bank_name && <p className="text-xs text-white/40">{selectedCheque.bank_name}</p>}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Pill value={selectedCheque.status || 'received'} styleMap={STATUS_STYLE} />
                <button onClick={() => setSelectedCheque(null)} className="text-white/40 hover:text-white transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 px-6 py-5 space-y-6">
              {/* Amount hero */}
              <div className="text-center py-5 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}>
                <p className="text-3xl font-bold tabular-nums" style={{ color: 'hsl(38 92% 55%)' }}>{fmtAed(selectedCheque.amount_aed)}</p>
                <p className="text-xs text-white/40 mt-1">{LABEL(selectedCheque.purpose || 'other')} · {deriveTypeLabel(selectedCheque)}</p>
              </div>

              {/* Key facts */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-3">Key Details</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['Payer', selectedCheque.payer_name],
                    ['Payee', selectedCheque.payee_name],
                    ['Cheque Date', fmtDate(selectedCheque.cheque_date)],
                    ['Received', fmtDate(selectedCheque.received_date)],
                    ['Deposit Due', fmtDate(selectedCheque.deposit_date)],
                    ['Cleared / Bounced', fmtDate(selectedCheque.cleared_date)],
                    ['Held By', selectedCheque.held_by],
                    ['Agent', selectedCheque.assigned_agent_email ? selectedCheque.assigned_agent_email.split('@')[0] : null],
                    ['Received By', selectedCheque.received_by_email ? selectedCheque.received_by_email.split('@')[0] : null],
                    ['Cheque Type', LABEL(selectedCheque.cheque_type)],
                    ['6-Mo Stale At', fmtDate(selectedCheque.stale_at)],
                    ['Issue Date', fmtDate(selectedCheque.issue_date)],
                  ].filter(([, v]) => v && v !== '—').map(([label, value]) => (
                    <div key={label} className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-0.5">{label}</p>
                      <p className="text-xs font-medium text-white/80 truncate">{value}</p>
                    </div>
                  ))}
                </div>
                {selectedCheque.notes && (
                  <div className="mt-2 rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-0.5">Notes</p>
                    <p className="text-xs text-white/60 whitespace-pre-wrap">{selectedCheque.notes}</p>
                  </div>
                )}
              </section>

              {/* Commission VAT breakdown (display only) */}
              {vatBreakdown && (
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-3">Commission VAT Breakdown</p>
                  <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    {[
                      ['Total (VAT Inclusive)', fmtAed(vatBreakdown.gross), 'hsl(38 92% 55%)'],
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
                  <p className="text-[10px] text-white/25 mt-1.5">Display only · net = amount ÷ 1.05</p>
                </section>
              )}

              {/* Lifecycle timeline */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-3">Lifecycle</p>
                <div>
                  {[
                    { label: 'Received', date: selectedCheque.received_date, done: true, color: '#a5b4fc' },
                    { label: 'Deposited', date: selectedCheque.deposit_date, done: ['deposited', 'cleared', 'bounced', 'returned'].includes(selectedCheque.status), color: '#67e8f9' },
                    {
                      label: ['bounced', 'returned'].includes(selectedCheque.status) ? LABEL(selectedCheque.status) : 'Cleared',
                      date: selectedCheque.cleared_date,
                      done: ['cleared', 'bounced', 'returned'].includes(selectedCheque.status),
                      color: selectedCheque.status === 'bounced' ? '#fca5a5' : selectedCheque.status === 'returned' ? '#fbbf24' : '#4ade80',
                    },
                  ].map((step, i) => (
                    <div key={step.label} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center border-2 mt-0.5"
                          style={step.done
                            ? { background: step.color + '22', borderColor: step.color }
                            : { background: 'transparent', borderColor: 'rgba(255,255,255,0.12)' }}>
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
                </div>
              </section>

              {/* Status action buttons */}
              {(STATUS_ACTIONS[selectedCheque.status] || []).length > 0 && (
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-3">Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {(STATUS_ACTIONS[selectedCheque.status] || []).map(action => {
                      const s = STATUS_STYLE[action] || {};
                      return (
                        <button key={action}
                          onClick={() => handleStatusAction(selectedCheque.id, action)}
                          disabled={!!updatingStatus}
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

              {/* Scan link */}
              {selectedCheque.cheque_image_url && (
                <a href={selectedCheque.cheque_image_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-medium hover:opacity-80 transition"
                  style={{ color: 'hsl(38 92% 55%)' }}>
                  <ImageIcon className="w-3.5 h-3.5" /> View cheque scan / photo
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Add Cheque Modal ───────────────────────────────────────────────── */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="flex-1 bg-black/50" onClick={() => setAddOpen(false)} />
          <div className="w-full max-w-lg h-full overflow-y-auto flex flex-col"
            style={{ background: 'hsl(222 47% 9%)', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <h2 className="font-display text-lg font-semibold text-white">Log Cheque</h2>
              <button onClick={() => setAddOpen(false)} className="text-white/40 hover:text-white transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 px-6 py-5 space-y-4">
              {form.cheque_image_url && (
                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <ImageIcon className="w-4 h-4 shrink-0" style={{ color: 'hsl(38 92% 50%)' }} />
                  <a href={form.cheque_image_url} target="_blank" rel="noopener noreferrer" className="text-xs flex-1" style={{ color: 'hsl(38 92% 60%)' }}>Scan attached — tap to preview</a>
                  <button onClick={() => setForm(f => ({ ...f, cheque_image_url: '' }))} className="text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="cr-label">Cheque # <span className="text-red-400">*</span></label><input value={form.cheque_number} onChange={sf('cheque_number')} placeholder="000123" className="cr-input" /></div>
                <div><label className="cr-label">Bank Name</label><input value={form.bank_name} onChange={sf('bank_name')} placeholder="Emirates NBD" className="cr-input" /></div>
              </div>
              <div><label className="cr-label">Payer <span className="text-red-400">*</span></label><input value={form.payer_name} onChange={sf('payer_name')} placeholder="Full name or company" className="cr-input" /></div>
              <div><label className="cr-label">Payee</label><input value={form.payee_name} onChange={sf('payee_name')} placeholder="Payable to" className="cr-input" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="cr-label">Amount (AED) <span className="text-red-400">*</span></label><input type="number" value={form.amount_aed} onChange={sf('amount_aed')} placeholder="0" className="cr-input" /></div>
                <div><label className="cr-label">Purpose</label>
                  <select value={form.purpose} onChange={sf('purpose')} className="cr-input">
                    {ALL_PURPOSE_OPTS.map(p => <option key={p} value={p}>{LABEL(p)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="cr-label">Cheque Date</label><input type="date" value={form.cheque_date} onChange={sf('cheque_date')} className="cr-input" /></div>
                <div><label className="cr-label">Received Date <span className="text-red-400">*</span></label><input type="date" value={form.received_date} onChange={sf('received_date')} className="cr-input" /></div>
              </div>
              <div><label className="cr-label">Deposit Date (scheduled)</label><input type="date" value={form.deposit_date} onChange={sf('deposit_date')} className="cr-input" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="cr-label">Type</label>
                  <select value={form.cheque_type} onChange={sf('cheque_type')} className="cr-input">
                    {TYPE_OPTS.map(t => <option key={t} value={t}>{LABEL(t)}</option>)}
                  </select>
                </div>
                <div><label className="cr-label">Status</label>
                  <select value={form.status} onChange={sf('status')} className="cr-input">
                    {STATUS_OPTS.map(s => <option key={s} value={s}>{LABEL(s)}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="cr-label">Held By</label><input value={form.held_by} onChange={sf('held_by')} placeholder="Office Safe / Bank / Agent…" className="cr-input" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="cr-label">Assigned Agent</label><input value={form.assigned_agent_email} onChange={sf('assigned_agent_email')} placeholder="agent@erudite-estate.com" className="cr-input" /></div>
                <div><label className="cr-label">Received By</label><input value={form.received_by_email} onChange={sf('received_by_email')} placeholder="admin@…" className="cr-input" /></div>
              </div>
              <div><label className="cr-label">Notes</label><textarea value={form.notes} onChange={sf('notes')} rows={2} placeholder="Any additional notes…" className="cr-input resize-none" /></div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <button onClick={() => setAddOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>Cancel</button>
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
        .cr-label { display: block; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.4); margin-bottom: 5px; }
        .cr-input { width: 100%; padding: 8px 12px; border-radius: 10px; font-size: 13px; outline: none; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.9); }
        .cr-input:focus { border-color: hsl(38 92% 50% / 0.5); box-shadow: 0 0 0 2px hsl(38 92% 50% / 0.1); }
        select.cr-input option { background: #1a1a2e; color: white; }
        textarea.cr-input { font-family: inherit; }
      `}</style>
    </div>
  );
}