import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { format, addDays, startOfMonth, endOfMonth, isValid, differenceInDays } from 'date-fns';
import {
  Plus, Search, X, Loader2, FileText, ImageIcon, Paperclip,
  ChevronUp, ChevronDown, ArrowUpDown, AlertTriangle, Clock, Lock, Trash2, CheckSquare, Square,
} from 'lucide-react';
import { toast } from 'sonner';
import ChequeDrawer from '@/components/cheques/ChequeDrawer';

// ── Helpers ───────────────────────────────────────────────────────────────────
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

const TYPE_LABEL_MAP = {
  commission: 'Commission', rent: 'Rent', deposit: 'Security',
  service_charge: 'Service Charge', booking: 'Booking / MOU',
  dld_fee: 'DLD Fee', managers: "Manager's", other: 'Other',
};

const LABEL = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const fmtAed = (n) => n != null ? `AED ${Number(n).toLocaleString('en-AE', { minimumFractionDigits: 0 })}` : '—';
const fmtDate = (d) => {
  try { if (!d) return '—'; const dt = new Date(d); return isValid(dt) ? format(dt, 'd MMM yyyy') : d; }
  catch { return d || '—'; }
};
const deriveSide = (c) => {
  if (c.purpose === 'rent' || c.cheque_type === 'post_dated') return 'rent';
  if (['commission', 'booking', 'dld_fee', 'managers'].includes(c.purpose)) return 'sale';
  return 'other';
};
const deriveTypeLabel = (c) => {
  if (!c) return '—';
  if (c.purpose === 'rent' && c.cheque_type === 'post_dated') return 'Rent / PDC';
  return TYPE_LABEL_MAP[c.purpose] || LABEL(c.purpose || 'other');
};
const sanitize = (s) => (s || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);

function Pill({ value }) {
  const s = STATUS_STYLE[value] || { bg: 'rgba(148,163,184,0.1)', color: 'rgba(255,255,255,0.6)', border: 'rgba(148,163,184,0.2)' };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      {LABEL(value)}
    </span>
  );
}
function AgentChip({ email }) {
  if (!email) return <span className="text-white/25 text-xs">—</span>;
  const name = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.25)' }}>
      {name}
    </span>
  );
}
function SortIcon({ field, sort }) {
  if (sort.field !== field) return <ArrowUpDown className="w-3 h-3 opacity-25 inline ml-1" />;
  return sort.dir === 'asc'
    ? <ChevronUp className="w-3 h-3 inline ml-1" style={{ color: 'hsl(38 92% 50%)' }} />
    : <ChevronDown className="w-3 h-3 inline ml-1" style={{ color: 'hsl(38 92% 50%)' }} />;
}

const EMPTY_FORM = {
  cheque_number: '', bank_name: '', payer_name: '', payee_name: '',
  amount_aed: '', cheque_date: '', received_date: '', deposit_date: '',
  received_by_email: '', assigned_agent_email: '', cheque_type: 'current',
  status: 'received', purpose: 'commission', held_by: '', notes: '',
  cheque_image_url: '', cheque_drive_url: '',
};

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

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ChequeRegister() {
  const { isAdmin, loading: authLoading, user } = useCurrentUser();
  const qc = useQueryClient();

  const [sideFilter, setSideFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ field: 'received_date', dir: 'desc' });
  const [selectedCheque, setSelectedCheque] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [fromScan, setFromScan] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [scanUploading, setScanUploading] = useState(false);
  const [scanDragOver, setScanDragOver] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const fileRef = useRef(null);
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    if (user?.email) setForm(f => ({ ...f, received_by_email: user.email }));
  }, [user?.email]);

  const { data: cheques = [], isLoading } = useQuery({
    queryKey: ['cheques-register'],
    queryFn: () => base44.entities.Cheque.list('-received_date', 1000),
  });

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const in30Days = addDays(today, 30);
    const live = cheques.filter(c => ['received', 'deposited'].includes(c.status));
    const dueToDeposit = cheques.filter(c => c.deposit_date && c.status === 'received' && new Date(c.deposit_date) >= today && new Date(c.deposit_date) <= in30Days)
      .sort((a, b) => new Date(a.deposit_date) - new Date(b.deposit_date));
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
      dueCount: dueToDeposit.length, dueSum: dueToDeposit.reduce((s, c) => s + (c.amount_aed || 0), 0), dueRange,
      clearedCount: clearedMonth.length, clearedSum: clearedMonth.reduce((s, c) => s + (c.amount_aed || 0), 0),
      bouncedCount: bounced.length, expiringCount: expiring.length,
    };
  }, [cheques, today]);

  const dueNext14 = useMemo(() => {
    const in14 = addDays(today, 14);
    return cheques.filter(c => c.deposit_date && c.status === 'received' && new Date(c.deposit_date) >= today && new Date(c.deposit_date) <= in14)
      .sort((a, b) => new Date(a.deposit_date) - new Date(b.deposit_date));
  }, [cheques, today]);

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

  const toggleSort = (field) => setSort(prev => prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' });

  // ── Selection ──────────────────────────────────────────────────────────────
  const allFilteredIds = filtered.map(c => c.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allFilteredIds));
  };
  const toggleOne = (id, e) => {
    e.stopPropagation();
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // ── Bulk delete ────────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const ids = [...selected];
    let failed = 0;
    for (const id of ids) {
      try { await base44.entities.Cheque.delete(id); }
      catch { failed++; }
    }
    setBulkDeleting(false);
    setConfirmBulkDelete(false);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ['cheques-register'] });
    if (failed === 0) toast.success(`${ids.length} cheque record${ids.length > 1 ? 's' : ''} deleted (Drive archives preserved)`);
    else toast.error(`Deleted ${ids.length - failed}, failed ${failed}`);
  };

  // ── Scan intake ────────────────────────────────────────────────────────────
  const processScan = async (file) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') return toast.error('Please upload an image or PDF');
    setScanUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const extracted = await base44.integrations.Core.InvokeLLM({
        prompt: 'You are reading a UAE bank cheque image. Extract every visible field. Return amounts as numbers. Return dates in YYYY-MM-DD format. If a field is illegible, return an empty string — never invent values.',
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            cheque_number: { type: 'string' },
            bank_name: { type: 'string' },
            payer_name: { type: 'string' },
            payee_name: { type: 'string' },
            amount_aed: { type: 'number' },
            cheque_date: { type: 'string' },
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
      setFromScan(true);
      setAddOpen(true);
      toast.success('Cheque scanned — review and correct below before saving');
    } catch (err) {
      toast.error('Scan failed: ' + err.message);
    } finally {
      setScanUploading(false);
    }
  };

  // ── Save (add form) ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.cheque_number.trim()) return toast.error('Cheque number is required');
    if (!form.payer_name.trim()) return toast.error('Payer name is required');
    if (!form.amount_aed || isNaN(parseFloat(form.amount_aed))) return toast.error('Amount is required');
    if (!form.received_date) return toast.error('Received date is required');
    setSaving(true);
    try {
      const payload = { ...form, amount_aed: parseFloat(form.amount_aed) };
      // Try Drive upload if we have a scan
      if (payload.cheque_image_url) {
        try {
          const fileName = `${sanitize(payload.payer_name)}_${sanitize(payload.bank_name || 'cheque')}_${payload.cheque_date || format(today, 'yyyy-MM-dd')}.jpg`;
          const driveRes = await base44.functions.invoke('uploadToGoogleDrive', {
            file_url: payload.cheque_image_url,
            fileName,
            folderName: 'Erudite — Cheque Archive',
          });
          const driveUrl = driveRes?.data?.webViewLink || driveRes?.data?.file_url;
          if (driveUrl) {
            payload.cheque_drive_url = driveUrl;
            toast.success('Scan archived to Google Drive ✓');
          }
        } catch {
          toast.info('Scan saved locally; Drive backup unavailable — connect Google Drive to enable archive');
        }
      }
      // Clean empty fields
      ['deposit_date', 'cheque_date', 'bank_name', 'payee_name', 'held_by', 'assigned_agent_email', 'notes', 'cheque_image_url', 'cheque_drive_url']
        .forEach(k => { if (!payload[k]) delete payload[k]; });
      await base44.entities.Cheque.create(payload);
      toast.success('Cheque logged');
      qc.invalidateQueries({ queryKey: ['cheques-register'] });
      setAddOpen(false);
      setFromScan(false);
    } catch (err) {
      toast.error('Failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const sf = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  // ── Drawer callbacks ───────────────────────────────────────────────────────
  const handleUpdated = (updated) => {
    setSelectedCheque(updated);
    qc.invalidateQueries({ queryKey: ['cheques-register'] });
  };
  const handleDeleted = () => {
    setSelectedCheque(null);
    qc.invalidateQueries({ queryKey: ['cheques-register'] });
  };

  // ── Admin gate ─────────────────────────────────────────────────────────────
  if (authLoading) return (
    <div className="page-root flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
    </div>
  );
  if (!isAdmin) return (
    <div className="page-root flex items-center justify-center min-h-[60vh]">
      <div className="glass-card p-12 text-center max-w-sm">
        <Lock className="w-10 h-10 text-white/20 mx-auto mb-4" />
        <h2 className="text-lg font-semibold mb-1">Restricted Access</h2>
        <p className="text-sm text-white/40">Cheque Register is available to administrators only.</p>
      </div>
    </div>
  );

  return (
    <div className="page-root">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1.5" style={{ color: 'hsl(38 92% 50%)' }}>ERUDITE · FINANCE</p>
          <h1 className="page-title text-3xl mb-1">Cheque Register</h1>
          <p className="page-subtitle">Track, deposit and reconcile all incoming cheques · scans archived to Google Drive</p>
        </div>
        <button
          onClick={() => { setForm({ ...EMPTY_FORM, received_date: format(today, 'yyyy-MM-dd'), received_by_email: user?.email || '' }); setFromScan(false); setAddOpen(true); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 shrink-0"
          style={{ background: 'hsl(38 92% 50%)', color: '#1a1a2e' }}>
          <Plus className="w-4 h-4" /> Add Cheque
        </button>
      </div>

      {/* ── Sale / Rent / All ──────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {[{ key: 'all', label: 'All' }, { key: 'sale', label: 'Sale' }, { key: 'rent', label: 'Rent' }].map(({ key, label }) => (
          <button key={key} onClick={() => setSideFilter(key)}
            className="px-5 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={sideFilter === key ? { background: 'hsl(38 92% 50%)', color: '#1a1a2e' } : { color: 'rgba(255,255,255,0.5)' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── 5 KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'In Register', val: kpi.inRegisterCount, sub: fmtAed(kpi.inRegisterSum), color: '#a5b4fc' },
          { label: 'Due to Deposit', val: kpi.dueCount, sub: kpi.dueRange || fmtAed(kpi.dueSum), color: '#67e8f9' },
          { label: 'Cleared This Month', val: kpi.clearedCount, sub: fmtAed(kpi.clearedSum), color: '#4ade80' },
          { label: 'Bounced', val: kpi.bouncedCount, sub: 'bounced or returned', color: '#fca5a5' },
          { label: 'Expiring ≤30d', val: kpi.expiringCount, sub: '6-mo stale approaching', color: kpi.expiringCount > 0 ? '#fbbf24' : 'rgba(255,255,255,0.4)' },
        ].map(({ label, val, sub, color }) => (
          <div key={label} className="glass-card px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">{label}</p>
            <p className="text-xl font-bold tabular-nums" style={{ color }}>{val}</p>
            <p className="text-[11px] text-white/35 mt-0.5 truncate">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Scan Drop Zone ─────────────────────────────────────────────────── */}
      <div
        className="mb-5 rounded-xl border-2 border-dashed transition-all cursor-pointer"
        style={{
          borderColor: scanDragOver ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.12)',
          background: scanDragOver ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.025)',
          padding: '16px 20px',
        }}
        onDragOver={(e) => { e.preventDefault(); setScanDragOver(true); }}
        onDragLeave={() => setScanDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setScanDragOver(false); const f = e.dataTransfer?.files?.[0]; if (f) processScan(f); }}
        onClick={() => !scanUploading && fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) processScan(f); e.target.value = ''; }} />
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
            {scanUploading ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'hsl(38 92% 50%)' }} /> : <ImageIcon className="w-5 h-5" style={{ color: 'hsl(38 92% 50%)' }} />}
          </div>
          <div>
            <p className="text-sm font-semibold text-white/80">
              {scanUploading ? 'AI reading cheque…' : 'Drop a cheque scan or photo to auto-fill'}
            </p>
            <p className="text-xs text-white/35 mt-0.5">
              {scanUploading ? 'Extracting number, bank, payer, amount — review step before saving' : 'AI extracts all fields · review step before saving · PNG / JPEG / PDF · archived to Drive'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Due for Deposit — next 14 days ─────────────────────────────────── */}
      {dueNext14.length > 0 && (
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" style={{ color: '#67e8f9' }} />
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
      <div className="flex flex-wrap gap-2 mb-4 items-center">
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
        <span className="text-xs text-white/30 px-1">{filtered.length} cheque{filtered.length !== 1 ? 's' : ''}</span>
        {someSelected && (
          <span className="text-xs ml-auto" style={{ color: 'hsl(38 92% 55%)' }}>{selected.size} selected</span>
        )}
      </div>

      {/* ── Bulk action bar ─────────────────────────────────────────────────── */}
      {someSelected && (
        <div className="mb-3 flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
          <span className="text-sm font-semibold text-red-400">{selected.size} cheque{selected.size > 1 ? 's' : ''} selected</span>
          <button onClick={() => setConfirmBulkDelete(true)}
            className="ml-auto flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
            <Trash2 className="w-3.5 h-3.5" /> Delete selected
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-white/30 hover:text-white transition">Clear</button>
        </div>
      )}

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
                  <th className="w-8 px-3">
                    <button onClick={toggleSelectAll} className="text-white/40 hover:text-white transition">
                      {allSelected ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  {COLS.map(col => (
                    <th key={col.field} className="text-left cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleSort(col.field)}>
                      {col.label}<SortIcon field={col.field} sort={sort} />
                    </th>
                  ))}
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const isExpiring = c.is_stale || (c.stale_at && new Date(c.stale_at) <= in30Days);
                  const isSelected = selected.has(c.id);
                  return (
                    <tr key={c.id} className="cursor-pointer"
                      style={isSelected ? { background: 'rgba(245,158,11,0.05)' } : {}}
                      onClick={() => setSelectedCheque(c)}>
                      <td className="px-3" onClick={e => e.stopPropagation()}>
                        <button onClick={(e) => toggleOne(c.id, e)} className="text-white/40 hover:text-white transition">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
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
                          <span className="flex items-center gap-1 text-[11px]" style={{ color: isExpiring ? '#fbbf24' : 'rgba(255,255,255,0.3)' }}>
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
                      <td><Pill value={c.status || 'received'} /></td>
                      <td className="pr-3">
                        {(c.cheque_image_url || c.cheque_drive_url) && (
                          <Paperclip className="w-3.5 h-3.5" style={{ color: 'hsl(38 92% 50%)' }} title="Scan attached" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Detail drawer ─────────────────────────────────────────────────── */}
      {selectedCheque && (
        <ChequeDrawer
          cheque={selectedCheque}
          onClose={() => setSelectedCheque(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}

      {/* ── Bulk delete confirm ────────────────────────────────────────────── */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => !bulkDeleting && setConfirmBulkDelete(false)} />
          <div className="relative glass-card p-8 max-w-sm w-full mx-4 text-center">
            <Trash2 className="w-10 h-10 mx-auto mb-4" style={{ color: '#fca5a5' }} />
            <h3 className="text-lg font-semibold mb-1">Delete {selected.size} cheque{selected.size > 1 ? 's' : ''}?</h3>
            <p className="text-sm text-white/40 mb-6">This cannot be undone. Google Drive archive copies are preserved.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmBulkDelete(false)} disabled={bulkDeleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                Cancel
              </button>
              <button onClick={handleBulkDelete} disabled={bulkDeleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: 'rgba(239,68,68,0.8)', color: 'white' }}>
                {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {bulkDeleting ? 'Deleting…' : 'Delete Records'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Review form panel ────────────────────────────────────────── */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="flex-1 bg-black/50" onClick={() => !saving && setAddOpen(false)} />
          <div className="w-full max-w-lg h-full flex flex-col"
            style={{ background: 'hsl(222 47% 9%)', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-start justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-0.5">
                  {fromScan ? 'Review AI Scan — Edit Before Saving' : 'Log New Cheque'}
                </p>
                <h2 className="font-display text-lg font-semibold text-white">
                  {fromScan ? 'Confirm Cheque Details' : 'Add Cheque'}
                </h2>
              </div>
              <button onClick={() => setAddOpen(false)} className="text-white/40 hover:text-white transition mt-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {form.cheque_image_url && (
                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <ImageIcon className="w-4 h-4 shrink-0" style={{ color: 'hsl(38 92% 50%)' }} />
                  <a href={form.cheque_image_url} target="_blank" rel="noopener noreferrer" className="text-xs flex-1 truncate" style={{ color: 'hsl(38 92% 60%)' }}>Scan attached — tap to preview</a>
                  <button onClick={() => setForm(f => ({ ...f, cheque_image_url: '' }))} className="text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}
              {fromScan && (
                <div className="px-3 py-2.5 rounded-lg text-xs" style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)', color: '#93c5fd' }}>
                  ✦ AI-extracted values pre-filled — review and correct any errors before saving. Nothing is saved until you press "Log Cheque".
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
                <div><label className="cr-label">Assigned Agent</label><input value={form.assigned_agent_email} onChange={sf('assigned_agent_email')} placeholder="agent@…" className="cr-input" /></div>
                <div><label className="cr-label">Received By</label><input value={form.received_by_email} onChange={sf('received_by_email')} placeholder="admin@…" className="cr-input" /></div>
              </div>
              <div><label className="cr-label">Notes</label><textarea value={form.notes} onChange={sf('notes')} rows={2} placeholder="Any additional notes…" className="cr-input resize-none" /></div>
            </div>

            <div className="px-6 py-4 border-t flex gap-3 shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <button onClick={() => setAddOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all active:scale-95 flex items-center justify-center gap-2"
                style={{ background: 'hsl(38 92% 50%)', color: '#1a1a2e' }}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : 'Log Cheque'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .cr-label { display:block; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:rgba(255,255,255,0.4); margin-bottom:5px; }
        .cr-input { width:100%; padding:8px 12px; border-radius:10px; font-size:13px; outline:none; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.9); font-family:inherit; }
        .cr-input:focus { border-color:hsl(38 92% 50% / 0.5); box-shadow:0 0 0 2px hsl(38 92% 50% / 0.1); }
        select.cr-input option { background:#1a1a2e; color:white; }
        textarea.cr-input { resize:none; }
      `}</style>
    </div>
  );
}