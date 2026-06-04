import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, FileText, CheckCircle2, AlertTriangle, XCircle, Loader2, ExternalLink, Users, ChevronRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function fmt(val) {
  if (val == null) return '—';
  return String(val);
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtAED(n) {
  if (!n) return '—';
  return 'AED ' + Number(n).toLocaleString();
}

// ─── Status dot ───────────────────────────────────────────────────────────────
function StatusDot({ ok }) {
  return <span className={cn('inline-block w-2 h-2 rounded-full mr-1.5', ok ? 'bg-emerald-400' : 'bg-red-400')} />;
}

// ─── Field Row ────────────────────────────────────────────────────────────────
function Row({ label, value, highlight }) {
  return (
    <div className="flex justify-between items-start gap-4 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-white/40 shrink-0">{label}</span>
      <span className={cn('text-xs font-medium text-right break-all', highlight ? 'text-amber-400' : 'text-white/80')}>{value}</span>
    </div>
  );
}

// ─── Result panel ─────────────────────────────────────────────────────────────
function ResultPanel({ result, onConfirm, confirming, fileUrl }) {
  const { match, will_write_to, needs_review, proposed_landlord_updates: pu, broker, warnings, mode } = result;

  // ── WRITTEN (post-confirm) ─────────────────────────────────────────
  if (mode === 'written') {
    const w = result.written;
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/8 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
          <div>
            <p className="font-semibold text-emerald-300">Mandate applied successfully</p>
            <p className="text-sm text-white/50 mt-0.5">
              {w?.landlord_name} · {w?.stage_advanced_to ? `Stage → ${w.stage_advanced_to.replace(/_/g, ' ')}` : 'Stage unchanged'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-white/40 mb-1">Landlord updated</p>
            <p className="font-medium">{w?.landlord_updated ? '✓ Yes' : '✗ No'}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-white/40 mb-1">Property row updated</p>
            <p className="font-medium">{w?.landlordproperty_updated ? '✓ Yes' : '✗ No'}</p>
          </div>
        </div>
        <a
          href={`/landlords?id=${w?.landlord_id}`}
          className="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
        >
          View landlord record <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    );
  }

  // ── WRITE ERROR ─────────────────────────────────────────────────────
  if (mode === 'write_error') {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/8 p-6 space-y-3">
        <div className="flex items-center gap-3">
          <XCircle className="w-6 h-6 text-red-400 shrink-0" />
          <p className="font-semibold text-red-300">Write failed</p>
        </div>
        <p className="text-xs text-white/50 font-mono bg-black/30 rounded-lg p-3 break-all">{result.error}</p>
        <p className="text-xs text-white/40">Step: {result.step}</p>
      </div>
    );
  }

  // ── REFUSED ─────────────────────────────────────────────────────────
  if (mode === 'refused') {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-6 space-y-3">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-amber-400 shrink-0" />
          <p className="font-semibold text-amber-300">Write refused</p>
        </div>
        <p className="text-sm text-white/60">{result.note}</p>
      </div>
    );
  }

  // ── NEEDS REVIEW (joint unit) ────────────────────────────────────────
  if (needs_review && !will_write_to) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
          <div>
            <p className="font-semibold text-amber-300">Needs manual review — joint unit</p>
            <p className="text-sm text-white/50 mt-0.5">The contract seller could not be uniquely matched to a co-owner. Resolve manually in the Landlords pipeline.</p>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-white/40 uppercase tracking-wide">Candidate co-owners</p>
          {(needs_review.candidate_co_owners || []).map((co, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
              <Users className="w-4 h-4 text-white/30 shrink-0" />
              <span className="text-sm text-white/70">{co.name}</span>
              <span className="text-xs text-white/30 ml-auto font-mono">{co.landlord_id}</span>
            </div>
          ))}
        </div>
        {warnings?.length > 0 && <WarningsList warnings={warnings} />}
      </div>
    );
  }

  // ── NO MATCH ─────────────────────────────────────────────────────────
  if (!will_write_to) {
    const candidates = match?.candidates || [];
    return (
      <div className="rounded-2xl border border-white/10 bg-white/4 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <XCircle className="w-6 h-6 text-white/30 shrink-0" />
          <div>
            <p className="font-semibold text-white/70">No matching owner found in the system</p>
            <p className="text-sm text-white/40 mt-0.5">This owner may not yet be in the database, or is a different project's owner.</p>
          </div>
        </div>
        {candidates.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-wide">Closest name matches</p>
            {candidates.map((c, i) => (
              <div key={i} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                <Users className="w-4 h-4 text-white/30 shrink-0" />
                <span className="text-sm text-white/70">{c.name}</span>
                <span className="text-xs text-white/30 ml-auto">{c.shared_name_tokens} token{c.shared_name_tokens !== 1 ? 's' : ''} matched</span>
              </div>
            ))}
          </div>
        )}
        {warnings?.length > 0 && <WarningsList warnings={warnings} />}
      </div>
    );
  }

  // ── MATCH FOUND (preview) ─────────────────────────────────────────────
  const isErudite = broker?.office_is_erudite;

  return (
    <div className="space-y-4">
      {/* Competitor warning — prominent */}
      {!isErudite && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-300">Competitor brokerage mandate</p>
            <p className="text-xs text-white/50 mt-0.5">Office: {broker?.broker_office || 'Unknown'} (ORN {broker?.broker_orn || 'n/a'})</p>
          </div>
        </div>
      )}

      {/* Match card */}
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wide mb-1">Matched landlord</p>
            <p className="text-lg font-semibold font-display text-amber-400">{will_write_to.landlord_name}</p>
            <p className="text-xs text-white/40 mt-0.5">
              via <span className="text-white/60">{will_write_to.matched_via}</span>
              {' · '}tier <span className="text-white/60">{will_write_to.tier}</span>
            </p>
          </div>
          <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/10 shrink-0">
            Preview
          </Badge>
        </div>

        {/* Proposed updates */}
        <div className="bg-black/20 rounded-xl p-4 space-y-0.5">
          <p className="text-xs text-white/30 uppercase tracking-wide mb-2">Proposed mandate updates</p>
          <Row label="Contract #" value={fmt(pu?.form_a_contract_number)} highlight />
          <Row label="Mandate type" value={fmt(pu?.mandate_type)?.replace(/_/g, ' ')} />
          <Row label="Mandate status" value={fmt(pu?.mandate_status)?.replace(/_/g, ' ')} />
          <Row label="Expires" value={fmtDate(pu?.mandate_expires_at)} />
          <Row label="Asking price" value={fmtAED(pu?.asking_price_aed)} />
          <Row label="Assigned agent" value={fmt(pu?.assigned_agent_email)} />
          {pu?.stage && <Row label="Stage → " value={pu.stage.replace(/_/g, ' ')} highlight />}
        </div>

        {/* Broker info */}
        <div className="bg-black/20 rounded-xl p-4 space-y-0.5">
          <p className="text-xs text-white/30 uppercase tracking-wide mb-2">Broker</p>
          <Row label="Broker name" value={fmt(broker?.broker_name)} />
          <Row label="Office" value={fmt(broker?.broker_office)} />
          <Row
            label="Erudite office"
            value={isErudite ? '✓ Yes' : '✗ No — competitor'}
          />
        </div>

        {warnings?.length > 0 && <WarningsList warnings={warnings} />}

        {/* Confirm button */}
        <Button
          onClick={() => onConfirm(fileUrl)}
          disabled={confirming}
          className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold h-11 text-sm"
        >
          {confirming
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying mandate…</>
            : <><CheckCircle2 className="w-4 h-4" /> Confirm &amp; Apply</>}
        </Button>
        <p className="text-xs text-white/30 text-center">This will write the mandate to the matched landlord. Irreversible.</p>
      </div>
    </div>
  );
}

function WarningsList({ warnings }) {
  // Filter out the generic "owner contact not present" info warning to reduce noise
  const shown = warnings.filter(w => !w.startsWith('Owner contact (mobile/email'));
  if (!shown.length) return null;
  return (
    <div className="space-y-1.5">
      {shown.map((w, i) => (
        <div key={i} className="flex items-start gap-2 text-xs text-amber-300/80 bg-amber-500/8 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
          <span>{w}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────
function DropZone({ onFile, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handle = (file) => {
    if (!file || file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file.');
      return;
    }
    onFile(file);
  };

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (!disabled) handle(e.dataTransfer.files[0]); }}
      className={cn(
        'relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 px-8 py-14',
        dragging
          ? 'border-amber-400 bg-amber-500/10 scale-[1.01]'
          : 'border-white/15 bg-white/3 hover:border-amber-500/40 hover:bg-white/5',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
        <Upload className="w-6 h-6 text-amber-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-white/80">Drop a Form A PDF here</p>
        <p className="text-xs text-white/35 mt-1">or click to browse · PDF only</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
        disabled={disabled}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FormAInbox() {
  const [phase, setPhase] = useState('idle'); // idle | uploading | parsing | preview | confirming | done
  const [fileName, setFileName] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const [error, setError] = useState(null);

  const reset = () => {
    setPhase('idle');
    setFileName(null);
    setFileUrl(null);
    setParseResult(null);
    setError(null);
  };

  const handleFile = async (file) => {
    setError(null);
    setParseResult(null);
    setFileName(file.name);
    setPhase('uploading');

    // 1. Upload to get a persistent URL
    let url;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      url = file_url;
      setFileUrl(url);
    } catch (e) {
      setError('Upload failed: ' + e.message);
      setPhase('idle');
      return;
    }

    // 2. Parse in preview mode (confirm: false)
    setPhase('parsing');
    try {
      const res = await base44.functions.invoke('parseFormA', { file_url: url, confirm: false });
      setParseResult(res.data);
      setPhase('preview');
    } catch (e) {
      setError('Parse failed: ' + e.message);
      setPhase('idle');
    }
  };

  const handleConfirm = async (url) => {
    setPhase('confirming');
    try {
      const res = await base44.functions.invoke('parseFormA', { file_url: url, confirm: true });
      setParseResult(res.data);
      setPhase('done');
      toast.success('Mandate applied successfully');
    } catch (e) {
      setError('Confirm failed: ' + e.message);
      setPhase('preview');
    }
  };

  const isLoading = phase === 'uploading' || phase === 'parsing';
  const isConfirming = phase === 'confirming';

  return (
    <div className="page-root max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
            <FileText className="w-5 h-5 text-amber-400" />
          </div>
          <h1 className="page-title text-2xl">Form A Inbox</h1>
        </div>
        <p className="page-subtitle ml-12">Upload a signed DLD Form A — auto-matches to the landlord and proposes the mandate update for your review before writing anything.</p>
      </div>

      {/* Drop zone — hidden once a file is in-flight */}
      {(phase === 'idle' || isLoading) && (
        <div className="mb-6">
          <DropZone onFile={handleFile} disabled={isLoading} />
          {isLoading && (
            <div className="flex items-center gap-3 mt-4 px-4 py-3 rounded-xl bg-white/5 border border-white/8">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/80">
                  {phase === 'uploading' ? 'Uploading PDF…' : 'Parsing contract…'}
                </p>
                {fileName && <p className="text-xs text-white/35 truncate">{fileName}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-3">
          <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Result */}
      {parseResult && (
        <div className="space-y-4">
          {/* File pill */}
          {fileName && (phase === 'preview' || phase === 'done' || phase === 'confirming') && (
            <div className="flex items-center gap-2 text-xs text-white/40 mb-1">
              <FileText className="w-3.5 h-3.5" />
              <span className="truncate">{fileName}</span>
              {(phase === 'preview') && (
                <button onClick={reset} className="ml-auto text-white/30 hover:text-white/60 transition-colors shrink-0">✕ New upload</button>
              )}
            </div>
          )}

          <ResultPanel
            result={parseResult}
            onConfirm={handleConfirm}
            confirming={isConfirming}
            fileUrl={fileUrl}
          />

          {phase === 'done' && (
            <button onClick={reset} className="w-full text-xs text-white/30 hover:text-white/60 transition-colors py-2">
              ↑ Upload another Form A
            </button>
          )}
        </div>
      )}
    </div>
  );
}