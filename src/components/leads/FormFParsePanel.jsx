import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Sparkles, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp, ArrowUpRight } from 'lucide-react';
import SendToClosingButton from '@/components/closing/SendToClosingButton';

export default function FormFParsePanel({ lead, onSaved }) {
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null); // the full preview response
  const [saveResult, setSaveResult] = useState(null); // written / write_error / refused
  const [showProposed, setShowProposed] = useState(false);

  const handleParse = async () => {
    setParsing(true);
    setPreview(null);
    setSaveResult(null);
    try {
      const res = await base44.functions.invoke('parseFormF', {
        file_url: lead.form_f_url,
        lead_id: lead.id,
        confirm: false,
      });
      setPreview(res.data);
    } catch (err) {
      setPreview({ warnings: ['Parse request failed: ' + err.message] });
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await base44.functions.invoke('parseFormF', {
        file_url: lead.form_f_url,
        lead_id: lead.id,
        confirm: true,
      });
      setSaveResult(res.data);
      if (res.data?.mode === 'written') {
        onSaved?.();
      }
    } catch (err) {
      setSaveResult({ mode: 'write_error', error: err.message });
    } finally {
      setSaving(false);
    }
  };

  const ex = preview?.extracted;
  const proposed = preview?.proposed_lead_updates;
  const noteAppend = preview?.proposed_note_append;
  const warnings = preview?.warnings || [];
  const hasContent = ex && (ex.buyer_name || ex.sell_price_aed || ex.unit_reference);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: preview ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">AI Form F Parser</span>
        </div>
        <button
          onClick={handleParse}
          disabled={parsing || saving}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-40"
          style={{ background: 'hsl(38 92% 50% / 0.15)', border: '1px solid hsl(38 92% 50% / 0.35)', color: 'hsl(38 92% 55%)' }}
        >
          {parsing ? <><Loader2 className="w-3 h-3 animate-spin" />Parsing…</> : 'Parse Form F'}
        </button>
      </div>

      {/* Preview panel */}
      {preview && (
        <div className="px-4 py-4 space-y-4">

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-300 space-y-1">
                {warnings.map((w, i) => <p key={i}>{w}</p>)}
              </div>
            </div>
          )}

          {/* Extracted fields */}
          {hasContent && (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Extracted Values</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Buyer Name" value={ex.buyer_name} />
                <Field label="Seller Name" value={ex.seller_name} />
                <Field label="Unit / Property" value={ex.unit_reference} />
                <Field label="Project" value={ex.project_name} />
                <Field label="Price (AED)" value={ex.sell_price_aed?.toLocaleString()} />
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-white/40">Dates</p>
                  <p className="text-xs text-white/70">{ex.start_date_raw || '—'} → {ex.end_date_raw || '—'}</p>
                </div>
              </div>

              {/* Proposed writes toggle */}
              {(proposed || noteAppend) && (
                <div>
                  <button
                    onClick={() => setShowProposed(p => !p)}
                    className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/40 hover:text-white/60 transition-colors"
                  >
                    {showProposed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    What will be written
                  </button>
                  {showProposed && (
                    <div className="mt-2 rounded-lg p-3 space-y-1.5 text-xs font-mono" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      {proposed && Object.entries(proposed).map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <span className="text-amber-400/70 shrink-0">{k}:</span>
                          <span className="text-white/70 break-all">{String(v)}</span>
                        </div>
                      ))}
                      {noteAppend && (
                        <div className="flex gap-2">
                          <span className="text-amber-400/70 shrink-0">notes (append):</span>
                          <span className="text-white/70 break-all">{noteAppend}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Save result */}
          {saveResult && (
            <SaveResultBanner result={saveResult} lead={lead} />
          )}

          {/* Confirm & Save button — hide once successfully written */}
          {hasContent && saveResult?.mode !== 'written' && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-40"
              style={{ background: 'hsl(38 92% 50%)', color: '#1a1a2e' }}
            >
              {saving ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Saving…</span> : 'Confirm & Save to Lead'}
            </button>
          )}

          {/* Post-save: Send to Closing CTA */}
          {saveResult?.mode === 'written' && lead.stage === 'closing_dld' && (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs text-emerald-300 flex-1">Lead updated. Ready to open a closing?</span>
              <SendToClosingButton
                leadId={lead.id}
                propertyRef={lead.closing_property_ref}
                projectId={lead.closing_project_id}
                size="xs"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium text-white/40">{label}</p>
      <p className="text-xs text-white/85 font-medium">{value || <span className="text-white/25 italic">—</span>}</p>
    </div>
  );
}

function SaveResultBanner({ result, lead }) {
  if (result.mode === 'written') {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="text-xs text-emerald-300">Saved: {result.written?.fields?.join(', ')}</span>
      </div>
    );
  }
  if (result.mode === 'write_error') {
    return (
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
        <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
        <span className="text-xs text-red-300 font-mono break-all">{result.error || 'Write failed'}</span>
      </div>
    );
  }
  if (result.mode === 'refused') {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-xs text-amber-300">Nothing to write: {result.reason}</span>
      </div>
    );
  }
  return null;
}