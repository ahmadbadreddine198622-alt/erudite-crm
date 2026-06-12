import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Plus, Search, FileText, X, ChevronDown, Download, ExternalLink, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// ─── Templates ────────────────────────────────────────────────────────────────
export const TEMPLATES = [
  // payment_received
  { key: 'booking_deposit',    ack_type: 'payment_received',  label: 'Booking deposit received',     subject: 'Booking deposit received',     details: 'Received from {client_name} the sum of AED {amount} as booking deposit for {property_ref}, paid via {payment_method}, reference {reference}.' },
  { key: 'commission_payment', ack_type: 'payment_received',  label: 'Commission payment received',  subject: 'Commission payment received',  details: 'Received from {client_name} AED {amount} being agreed agency commission for {property_ref}.' },
  { key: 'token_eoi',          ack_type: 'payment_received',  label: 'Token / EOI amount received',  subject: 'Token / EOI amount received',  details: 'Received AED {amount} as token / expression of interest against {property_ref}.' },
  { key: 'rent_payment',       ack_type: 'payment_received',  label: 'Rent payment received',        subject: 'Rent payment received',        details: 'Received AED {amount} from {client_name} towards rent for {property_ref}.' },
  { key: 'security_deposit',   ack_type: 'payment_received',  label: 'Security deposit received',    subject: 'Security deposit received',    details: 'Received AED {amount} as refundable security deposit for {property_ref}.' },
  // cheque_received
  { key: 'cheques_received',   ack_type: 'cheque_received',   label: 'Cheque(s) received',           subject: 'Cheque(s) received',           details: 'Received from {client_name} cheque(s) totalling AED {amount} for {property_ref}. Cheque reference(s): {reference}.' },
  { key: 'managers_cheque',    ack_type: 'cheque_received',   label: "Manager's cheque received",    subject: "Manager's cheque received",    details: "Received manager's cheque AED {amount}, reference {reference}, towards {property_ref}." },
  // document_handover
  { key: 'title_deed',         ack_type: 'document_handover', label: 'Title deed copy handover',     subject: 'Title deed copy handover',     details: 'Acknowledge handover of title deed (copy) for {property_ref} between Erudite and {client_name}.' },
  { key: 'form_a_docs',        ack_type: 'document_handover', label: 'Form A / mandate documents received', subject: 'Form A / mandate documents received', details: 'Received signed Form A and owner documents for {property_ref} from {client_name}.' },
  { key: 'kyc_docs',           ack_type: 'document_handover', label: 'Passport / Emirates ID copies received', subject: 'Passport / Emirates ID copies received', details: 'Received KYC documents (passport / Emirates ID) from {client_name} for {property_ref}.' },
  { key: 'mou_form_f',         ack_type: 'document_handover', label: 'MOU / Form F handover',        subject: 'MOU / Form F handover',        details: 'Acknowledge handover of signed MOU (Form F) for {property_ref}.' },
  { key: 'noc_received',       ack_type: 'document_handover', label: 'Developer NOC received',       subject: 'Developer NOC received',       details: 'Received developer NOC for {property_ref} from {client_name}.' },
  // keys_handover
  { key: 'keys_to_client',     ack_type: 'keys_handover',     label: 'Keys handed to client',        subject: 'Keys handed to client',        details: 'Handed over key set(s) and access cards for {property_ref} to {client_name}.' },
  { key: 'keys_from_landlord', ack_type: 'keys_handover',     label: 'Keys received from landlord',  subject: 'Keys received from landlord',  details: 'Received key set(s) / access for {property_ref} from {client_name} for listing / viewing purposes.' },
  { key: 'access_cards',       ack_type: 'keys_handover',     label: 'Access cards / fobs handover', subject: 'Access cards / fobs handover', details: 'Acknowledge handover of access fobs / parking cards for {property_ref}.' },
  // general
  { key: 'viewing_ack',        ack_type: 'general',           label: 'Viewing acknowledgement',      subject: 'Viewing acknowledgement',      details: '{client_name} attended a viewing of {property_ref} accompanied by Erudite.' },
  { key: 'doc_collection',     ack_type: 'general',           label: 'Document collection acknowledgement', subject: 'Document collection acknowledgement', details: 'Acknowledge collection of documents from {client_name}.' },
  { key: 'free_text',          ack_type: 'general',           label: 'Free text',                    subject: '',                             details: '' },
];

const TEMPLATE_GROUPS = [
  { type: 'payment_received',  label: 'Payment Received' },
  { type: 'cheque_received',   label: 'Cheque Received' },
  { type: 'document_handover', label: 'Document Handover' },
  { type: 'keys_handover',     label: 'Keys Handover' },
  { type: 'general',           label: 'General' },
];

const TYPE_LABELS = {
  payment_received:  'Payment Received',
  cheque_received:   'Cheque Received',
  document_handover: 'Document Handover',
  keys_handover:     'Keys Handover',
  general:           'General',
};

const TYPE_COLORS = {
  payment_received:  { bg: 'rgba(34,197,94,0.12)',  color: '#4ade80',  border: 'rgba(34,197,94,0.25)' },
  cheque_received:   { bg: 'rgba(99,102,241,0.12)', color: '#a5b4fc',  border: 'rgba(99,102,241,0.25)' },
  document_handover: { bg: 'rgba(6,182,212,0.12)',  color: '#67e8f9',  border: 'rgba(6,182,212,0.25)' },
  keys_handover:     { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24',  border: 'rgba(245,158,11,0.25)' },
  general:           { bg: 'rgba(148,163,184,0.1)', color: 'rgba(148,163,184,0.9)', border: 'rgba(148,163,184,0.2)' },
};

const STATUS_COLORS = {
  draft:  { bg: 'rgba(148,163,184,0.1)', color: 'rgba(148,163,184,0.9)', border: 'rgba(148,163,184,0.2)' },
  issued: { bg: 'rgba(34,197,94,0.12)',  color: '#4ade80',  border: 'rgba(34,197,94,0.25)' },
  void:   { bg: 'rgba(239,68,68,0.12)',  color: '#fca5a5',  border: 'rgba(239,68,68,0.25)' },
};

const PAYMENT_METHODS = ['bank_transfer', 'cheque', 'cash', 'card', 'n_a'];
const PM_LABELS = { bank_transfer: 'Bank Transfer', cheque: 'Cheque', cash: 'Cash', card: 'Card', n_a: 'N/A' };

const showFinancialFields = (type) => ['payment_received', 'cheque_received'].includes(type);

function Pill({ label, style }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border" style={style}>
      {label}
    </span>
  );
}

const EMPTY_FORM = {
  ack_date: format(new Date(), 'yyyy-MM-dd'),
  ack_type: 'general',
  template_key: '',
  client_name: '',
  client_phone: '',
  subject: '',
  details: '',
  amount_aed: '',
  payment_method: 'n_a',
  reference: '',
  property_ref: '',
  related_lead_id: '',
  related_landlord_id: '',
  status: 'draft',
};

export default function Acknowledgements() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['acknowledgements'],
    queryFn: () => base44.entities.Acknowledgement.list('-created_date', 200),
  });

  const openNew = async () => {
    const user = await base44.auth.me().catch(() => null);
    setForm({ ...EMPTY_FORM, issued_by_email: user?.email || '', ack_date: format(new Date(), 'yyyy-MM-dd') });
    setSheetOpen(true);
  };

  const applyTemplate = (key) => {
    const t = TEMPLATES.find(t => t.key === key);
    if (!t) return;
    setForm(f => ({ ...f, template_key: key, ack_type: t.ack_type, subject: t.subject, details: t.details }));
  };

  const handleSave = async () => {
    if (!form.client_name.trim()) return toast.error('Client name is required');
    if (!form.subject.trim()) return toast.error('Subject is required');
    setSaving(true);
    try {
      const payload = {
        ...form,
        amount_aed: form.amount_aed !== '' ? parseFloat(form.amount_aed) : null,
      };
      // Remove empty strings for optional fields
      ['template_key','client_phone','reference','property_ref','related_lead_id','related_landlord_id','pdf_url'].forEach(k => {
        if (!payload[k]) delete payload[k];
      });

      const created = await base44.entities.Acknowledgement.create(payload);

      // Auto-generate ack_number
      const res = await base44.functions.invoke('generateAckNumber', { ack_id: created.id });
      const ackNum = res.data?.ack_number;
      if (ackNum) {
        await base44.entities.Acknowledgement.update(created.id, { ack_number: ackNum });
      }

      toast.success(`Acknowledgement ${ackNum || ''} saved`);
      qc.invalidateQueries({ queryKey: ['acknowledgements'] });
      setSheetOpen(false);
    } catch (err) {
      toast.error('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async (record) => {
    setGeneratingPdf(true);
    try {
      const res = await base44.functions.invoke('generateAcknowledgementPDF', { acknowledgement_id: record.id });
      const { pdf_base64, drive_url, filename } = res.data;

      // Trigger browser download
      const byteChars = atob(pdf_base64);
      const byteNums = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteNums], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `ACK-${record.ack_number || record.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      // Success toast with Drive link
      toast.success(
        drive_url
          ? `PDF ready! View in Google Drive`
          : 'PDF downloaded successfully',
        drive_url ? {
          action: { label: 'Open Drive', onClick: () => window.open(drive_url, '_blank') },
          duration: 6000,
        } : {}
      );

      // Refresh the record in the list and update detail view
      await qc.invalidateQueries({ queryKey: ['acknowledgements'] });
      // Fetch the updated record to refresh the detail panel
      const updated = await base44.entities.Acknowledgement.get(record.id).catch(() => null);
      if (updated) setDetailRecord(updated);
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Failed to generate PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Filter + search
  const filtered = records.filter(r => {
    if (filterType !== 'all' && r.ack_type !== filterType) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (r.client_name || '').toLowerCase().includes(q) || (r.ack_number || '').toLowerCase().includes(q);
    }
    return true;
  });

  const fmtAed = (n) => n != null ? `AED ${Number(n).toLocaleString()}` : '—';

  return (
    <div className="page-root">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title text-2xl font-semibold mb-1">Acknowledgements</h1>
          <p className="page-subtitle">{records.length} record{records.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: 'hsl(38 92% 50%)', color: '#1a1a2e' }}
        >
          <Plus className="w-4 h-4" /> New Acknowledgement
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search client or ACK-#…"
            className="pl-8 pr-3 py-2 rounded-lg text-xs outline-none w-52"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }}
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }}
        >
          <option value="all">All Types</option>
          {TEMPLATE_GROUPS.map(g => <option key={g.type} value={g.type}>{g.label}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }}
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="issued">Issued</option>
          <option value="void">Void</option>
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
          <p className="text-sm">No acknowledgements found.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full glass-table">
            <thead>
              <tr>
                <th className="text-left">ACK #</th>
                <th className="text-left">Date</th>
                <th className="text-left">Type</th>
                <th className="text-left">Client</th>
                <th className="text-left">Subject</th>
                <th className="text-right">Amount</th>
                <th className="text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const tc = TYPE_COLORS[r.ack_type] || TYPE_COLORS.general;
                const sc = STATUS_COLORS[r.status] || STATUS_COLORS.draft;
                return (
                  <tr key={r.id} className="cursor-pointer" onClick={() => setDetailRecord(r)}>
                    <td className="font-mono font-semibold" style={{ color: 'hsl(38 92% 55%)' }}>
                      {r.ack_number || <span className="text-muted-foreground italic text-[10px]">pending</span>}
                    </td>
                    <td>{r.ack_date ? format(new Date(r.ack_date), 'd MMM yyyy') : '—'}</td>
                    <td><Pill label={TYPE_LABELS[r.ack_type] || r.ack_type} style={{ background: tc.bg, color: tc.color, borderColor: tc.border }} /></td>
                    <td className="font-medium text-white/90">{r.client_name}</td>
                    <td className="text-white/60 max-w-xs truncate">{r.subject}</td>
                    <td className="text-right tabular-nums">{r.amount_aed != null ? fmtAed(r.amount_aed) : '—'}</td>
                    <td><Pill label={r.status} style={{ background: sc.bg, color: sc.color, borderColor: sc.border }} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── New Acknowledgement Sheet ─────────────────────────────────────────── */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div className="flex-1 bg-black/50" onClick={() => setSheetOpen(false)} />
          {/* Panel */}
          <div className="w-full max-w-lg h-full overflow-y-auto flex flex-col"
            style={{ background: 'hsl(222 47% 9%)', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            {/* Sheet header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <h2 className="font-display text-lg font-semibold text-white">New Acknowledgement</h2>
              <button onClick={() => setSheetOpen(false)} className="text-muted-foreground hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 px-6 py-5 space-y-5">
              {/* Row: ACK # + Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">ACK Number</label>
                  <input readOnly value="Auto-generated" className="field-input opacity-50 cursor-not-allowed" />
                </div>
                <div>
                  <label className="field-label">Date</label>
                  <input type="date" value={form.ack_date}
                    onChange={e => setForm(f => ({ ...f, ack_date: e.target.value }))}
                    className="field-input" />
                </div>
              </div>

              {/* Template picker */}
              <div>
                <label className="field-label">Template <span className="text-muted-foreground font-normal">(optional)</span></label>
                <select value={form.template_key}
                  onChange={e => applyTemplate(e.target.value)}
                  className="field-input">
                  <option value="">— Choose a template —</option>
                  {TEMPLATE_GROUPS.map(g => (
                    <optgroup key={g.type} label={g.label}>
                      {TEMPLATES.filter(t => t.ack_type === g.type).map(t => (
                        <option key={t.key} value={t.key}>{t.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="field-label">Type</label>
                <select value={form.ack_type}
                  onChange={e => setForm(f => ({ ...f, ack_type: e.target.value }))}
                  className="field-input">
                  {TEMPLATE_GROUPS.map(g => <option key={g.type} value={g.type}>{g.label}</option>)}
                </select>
              </div>

              {/* Client */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Client Name <span className="text-red-400">*</span></label>
                  <input value={form.client_name}
                    onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                    placeholder="Full name"
                    className="field-input" />
                </div>
                <div>
                  <label className="field-label">Client Phone</label>
                  <input value={form.client_phone}
                    onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))}
                    placeholder="+971…"
                    className="field-input" />
                </div>
              </div>

              {/* Property ref */}
              <div>
                <label className="field-label">Property / Unit Ref</label>
                <input value={form.property_ref}
                  onChange={e => setForm(f => ({ ...f, property_ref: e.target.value }))}
                  placeholder="e.g. Unit 2403, Burj Vista"
                  className="field-input" />
              </div>

              {/* Subject */}
              <div>
                <label className="field-label">Subject <span className="text-red-400">*</span></label>
                <input value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="Short title"
                  className="field-input" />
              </div>

              {/* Details */}
              <div>
                <label className="field-label">Details</label>
                <textarea value={form.details}
                  onChange={e => setForm(f => ({ ...f, details: e.target.value }))}
                  rows={5}
                  placeholder="Full acknowledgement wording…"
                  className="field-input resize-none" />
              </div>

              {/* Financial fields — conditional */}
              {showFinancialFields(form.ack_type) && (
                <div className="space-y-4 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Payment Details</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Amount (AED)</label>
                      <input type="number" value={form.amount_aed}
                        onChange={e => setForm(f => ({ ...f, amount_aed: e.target.value }))}
                        placeholder="0"
                        className="field-input" />
                    </div>
                    <div>
                      <label className="field-label">Payment Method</label>
                      <select value={form.payment_method}
                        onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
                        className="field-input">
                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{PM_LABELS[m]}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Reference (cheque no / transfer ref)</label>
                    <input value={form.reference}
                      onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                      placeholder="e.g. CHQ-001234"
                      className="field-input" />
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <label className="field-label">Status</label>
                <select value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="field-input">
                  <option value="draft">Draft</option>
                  <option value="issued">Issued</option>
                  <option value="void">Void</option>
                </select>
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
                {saving ? 'Saving…' : 'Save Acknowledgement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail View ───────────────────────────────────────────────────────── */}
      {detailRecord && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setDetailRecord(null)} />
          <div className="w-full max-w-lg h-full overflow-y-auto flex flex-col"
            style={{ background: 'hsl(222 47% 9%)', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Acknowledgement</p>
                <h2 className="font-display text-xl font-semibold" style={{ color: 'hsl(38 92% 55%)' }}>
                  {detailRecord.ack_number || 'Pending'}
                </h2>
              </div>
              <button onClick={() => setDetailRecord(null)} className="text-muted-foreground hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 px-6 py-5 space-y-5">
              {/* Status + Type */}
              <div className="flex gap-2 flex-wrap">
                {(() => { const sc = STATUS_COLORS[detailRecord.status] || STATUS_COLORS.draft; return <Pill label={detailRecord.status} style={{ background: sc.bg, color: sc.color, borderColor: sc.border }} />; })()}
                {(() => { const tc = TYPE_COLORS[detailRecord.ack_type] || TYPE_COLORS.general; return <Pill label={TYPE_LABELS[detailRecord.ack_type] || detailRecord.ack_type} style={{ background: tc.bg, color: tc.color, borderColor: tc.border }} />; })()}
              </div>

              <DetailRow label="Date" value={detailRecord.ack_date ? format(new Date(detailRecord.ack_date), 'd MMMM yyyy') : '—'} />
              <DetailRow label="Client" value={detailRecord.client_name} />
              {detailRecord.client_phone && <DetailRow label="Client Phone" value={detailRecord.client_phone} />}
              {detailRecord.property_ref && <DetailRow label="Property / Unit Ref" value={detailRecord.property_ref} />}
              <DetailRow label="Subject" value={detailRecord.subject} />

              {detailRecord.details && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Details</p>
                  <div className="rounded-xl px-4 py-3 text-sm text-white/85 leading-relaxed whitespace-pre-wrap"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {detailRecord.details}
                  </div>
                </div>
              )}

              {detailRecord.amount_aed != null && (
                <DetailRow label="Amount" value={fmtAed(detailRecord.amount_aed)} gold />
              )}
              {detailRecord.payment_method && detailRecord.payment_method !== 'n_a' && (
                <DetailRow label="Payment Method" value={PM_LABELS[detailRecord.payment_method] || detailRecord.payment_method} />
              )}
              {detailRecord.reference && <DetailRow label="Reference" value={detailRecord.reference} />}
              {detailRecord.issued_by_email && <DetailRow label="Issued By" value={detailRecord.issued_by_email} />}
            </div>

            {/* PDF Actions Footer */}
            <div className="px-6 py-4 border-t flex flex-col gap-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => handleGeneratePdf(detailRecord)}
                disabled={generatingPdf}
                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                style={{ background: 'hsl(38 92% 50%)', color: '#1a1a2e' }}
              >
                {generatingPdf
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                  : <><Download className="w-4 h-4" /> Generate &amp; Download PDF</>
                }
              </button>
              {detailRecord.pdf_url && (
                <a
                  href={detailRecord.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-xs font-medium transition-colors"
                  style={{ color: 'hsl(38 92% 60%)' }}
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open saved PDF
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inline styles */}
      <style>{`
        .field-label { display: block; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.4); margin-bottom: 5px; }
        .field-input { width: 100%; padding: 8px 12px; border-radius: 10px; font-size: 13px; outline: none; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.9); }
        .field-input:focus { border-color: hsl(38 92% 50% / 0.5); box-shadow: 0 0 0 2px hsl(38 92% 50% / 0.1); }
        select.field-input option { background: #1a1a2e; color: white; }
      `}</style>
    </div>
  );
}

function DetailRow({ label, value, gold }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm" style={gold ? { color: 'hsl(38 92% 55%)', fontWeight: 600 } : { color: 'rgba(255,255,255,0.85)' }}>{value}</p>
    </div>
  );
}