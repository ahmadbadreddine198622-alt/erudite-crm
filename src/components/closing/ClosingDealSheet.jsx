import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Loader2, CheckCircle2, ArrowRight, Sparkles, AlertTriangle } from 'lucide-react';
import EmailComposeButton from '@/components/shared/EmailComposeButton';
import { toast } from 'sonner';
import { CLOSING_STAGES } from '@/pages/ClosingHub';
import WritingField from '@/components/shared/WritingField';

const fmtAed = (n) => n ? `AED ${Number(n).toLocaleString('en-AE', { maximumFractionDigits: 0 })}` : '—';

const NOC_OPTS = ['not_required', 'pending', 'received', 'rejected'];
const LABEL = s => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// V3 Phase 2 (REMEMBER): tiny inline sparkline (auto-scaled) for the closing-risk trajectory.
function RiskSparkline({ series }) {
  if (!Array.isArray(series) || series.length < 2) return null;
  const w = 60, h = 16, pad = 2;
  const lo = Math.min(...series), hi = Math.max(...series), span = (hi - lo) || 1;
  const pts = series.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (series.length - 1);
    const y = pad + (h - pad * 2) * (1 - (v - lo) / span);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke="#fbbf24" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ClosingDealSheet({ deal, open, onClose, onSaved }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    stage: deal.stage || 'not_started',
    trustee_office: deal.trustee_office || '',
    trustee_appointment_at: deal.trustee_appointment_at ? deal.trustee_appointment_at.slice(0, 16) : '',
    cheques_received_count: deal.cheques_received_count ?? 0,
    cheques_required_count: deal.cheques_required_count ?? 0,
    noc_status: deal.noc_status || 'not_required',
    dld_transfer_ref: deal.dld_transfer_ref || '',
    title_deed_number: deal.title_deed_number || '',
    notes: deal.notes || '',
    deal_value_aed: deal.deal_value_aed || '',
    commission_amount_aed: deal.commission_amount_aed || '',
    commission_amount_buy_side_aed: deal.commission_amount_buy_side_aed || '',
  });
  const [saving, setSaving] = useState(false);
  const [runningAI, setRunningAI] = useState(false);
  const [aiData, setAiData] = useState({
    ai_risk_score: deal.ai_risk_score ?? null,
    ai_next_best_action: deal.ai_next_best_action ?? null,
    ai_rolling_summary: deal.ai_rolling_summary ?? null,
    ai_predicted_close_date: deal.ai_predicted_close_date ?? null,
    ai_deal_thesis: deal.ai_deal_thesis ?? null,
    ai_open_questions: Array.isArray(deal.ai_open_questions) ? deal.ai_open_questions : [],
  });

  // V3 Phase 2 (REMEMBER): closing-risk trajectory from the append-only snapshot history. Read-only;
  // degrades to nothing until >=2 snapshots exist (entity created + accrued post-publish). The queryFn
  // swallows errors so it's harmless before ClosingDealScoreSnapshot is live.
  // Fetch linked lead's email for the Email button
  const { data: linkedLead } = useQuery({
    queryKey: ['closing_lead_email', deal.lead_id],
    queryFn: () => base44.entities.Lead.get(deal.lead_id),
    enabled: !!deal.lead_id,
    staleTime: 300_000,
    retry: false,
  });
  const leadEmail = linkedLead?.email || '';

  const { data: riskSnapshots = [] } = useQuery({
    queryKey: ['closing_snapshots', deal.id],
    queryFn: async () => {
      try { return await base44.entities.ClosingDealScoreSnapshot.filter({ closing_deal_id: deal.id }, '-captured_at', 30); }
      catch { return []; }
    },
    enabled: !!deal?.id,
    retry: false,
    staleTime: 30000,
  });
  const riskTrend = (() => {
    const series = [...(Array.isArray(riskSnapshots) ? riskSnapshots : [])].reverse()
      .map(s => s.ai_risk_score).filter(v => typeof v === 'number' && isFinite(v));
    if (series.length < 2) return null;
    return { series: series.slice(-12), delta: Math.round(series[series.length - 1] - series[series.length - 2]) };
  })();

  const handleRunAI = async () => {
    setRunningAI(true);
    try {
      const res = await base44.functions.invoke('closingDealOrchestrator', { deal_id: deal.id });
      if (res.data?.ok) {
        setAiData({
          ai_risk_score: res.data.ai_risk_score,
          ai_next_best_action: res.data.ai_next_best_action,
          ai_rolling_summary: res.data.ai_rolling_summary,
          ai_predicted_close_date: res.data.ai_predicted_close_date,
          ai_deal_thesis: res.data.ai_deal_thesis ?? null,
          ai_open_questions: Array.isArray(res.data.ai_open_questions) ? res.data.ai_open_questions : [],
        });
        qc.invalidateQueries({ queryKey: ['closing_deals'] });
        toast.success('AI analysis complete');
      }
    } catch (err) {
      toast.error('AI failed: ' + err.message);
    } finally {
      setRunningAI(false);
    }
  };

  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const sn = k => e => setForm(f => ({ ...f, [k]: Number(e.target.value) }));

  const stageIdx = CLOSING_STAGES.findIndex(s => s.key === form.stage);

  const handleAdvanceStage = (newStage) => {
    const prev = form.stage;
    setForm(f => ({ ...f, stage: newStage }));
    // persist immediately
    base44.entities.ClosingDeal.update(deal.id, {
      stage: newStage,
      stage_entered_at: new Date().toISOString(),
      stage_history: [
        ...(deal.stage_history || []),
        { stage: prev, entered_at: deal.stage_entered_at || deal.created_date, exited_at: new Date().toISOString() }
      ]
    }).then(() => {
      toast.success(`Advanced to ${CLOSING_STAGES.find(s => s.key === newStage)?.label}`);
      qc.invalidateQueries({ queryKey: ['closing_deals'] });
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        stage: form.stage,
        trustee_office: form.trustee_office || undefined,
        trustee_appointment_at: form.trustee_appointment_at ? new Date(form.trustee_appointment_at).toISOString() : undefined,
        cheques_received_count: form.cheques_received_count,
        cheques_required_count: form.cheques_required_count,
        noc_status: form.noc_status,
        dld_transfer_ref: form.dld_transfer_ref || undefined,
        title_deed_number: form.title_deed_number || undefined,
        notes: form.notes || undefined,
        deal_value_aed: form.deal_value_aed ? parseFloat(form.deal_value_aed) : undefined,
        commission_amount_aed: form.commission_amount_aed ? parseFloat(form.commission_amount_aed) : undefined,
        commission_amount_buy_side_aed: form.commission_amount_buy_side_aed ? parseFloat(form.commission_amount_buy_side_aed) : undefined,
      };
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
      await base44.entities.ClosingDeal.update(deal.id, payload);
      toast.success('Closing deal updated');
      qc.invalidateQueries({ queryKey: ['closing_deals'] });
      onSaved?.();
    } catch (err) {
      toast.error('Failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const nextStage = stageIdx < CLOSING_STAGES.length - 1 ? CLOSING_STAGES[stageIdx + 1] : null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-full max-w-lg h-full overflow-y-auto flex flex-col"
        style={{ background: 'hsl(222 47% 9%)', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              {deal.closing_reference || 'Closing Deal'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {deal.property_ref || 'No property ref'}
              {deal.deal_type ? ` · ${deal.deal_type === 'rent' ? 'Rent' : 'Sale'}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-5">

          {/* AI Panel */}
          <div className="rounded-xl p-3 space-y-3"
            style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)' }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" style={{ color: '#c4b5fd' }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#c4b5fd' }}>AI Analysis</span>
              </div>
              <button onClick={handleRunAI} disabled={runningAI}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all active:scale-95 disabled:opacity-50"
                style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', color: '#c4b5fd' }}>
                {runningAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {runningAI ? 'Analysing…' : 'Run AI'}
              </button>
            </div>

            {aiData.ai_risk_score != null && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0"
                  style={{ color: aiData.ai_risk_score >= 70 ? '#fca5a5' : aiData.ai_risk_score >= 40 ? '#fbbf24' : '#4ade80' }} />
                <span className="text-xs font-bold"
                  style={{ color: aiData.ai_risk_score >= 70 ? '#fca5a5' : aiData.ai_risk_score >= 40 ? '#fbbf24' : '#4ade80' }}>
                  Risk Score: {aiData.ai_risk_score}/100
                </span>
                {aiData.ai_predicted_close_date && (
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    Predicted close: {aiData.ai_predicted_close_date}
                  </span>
                )}
              </div>
            )}

            {/* V3 P2 REMEMBER: risk trajectory over the orchestrator's run history (rising risk = red) */}
            {riskTrend && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Risk trend</span>
                <RiskSparkline series={riskTrend.series} />
                <span className="text-[10px] font-bold"
                  style={{ color: riskTrend.delta > 0 ? '#fca5a5' : riskTrend.delta < 0 ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>
                  {riskTrend.delta > 0 ? '▲' : riskTrend.delta < 0 ? '▼' : '→'}{riskTrend.delta !== 0 ? Math.abs(riskTrend.delta) : ''}
                </span>
              </div>
            )}

            {aiData.ai_next_best_action && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Next Best Action</p>
                <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>{aiData.ai_next_best_action}</p>
              </div>
            )}

            {aiData.ai_rolling_summary && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Summary</p>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{aiData.ai_rolling_summary}</p>
              </div>
            )}

            {/* V3 P2 REMEMBER: persistent strategy the brain carries across runs */}
            {aiData.ai_deal_thesis && (
              <div className="rounded-md p-2" style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.22)', borderLeft: '2px solid rgba(139,92,246,0.7)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#c4b5fd' }}>Strategy</p>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>{aiData.ai_deal_thesis}</p>
              </div>
            )}

            {/* V3 P2 REMEMBER: ask-the-agent — uncertainties the brain wants a human to resolve */}
            {Array.isArray(aiData.ai_open_questions) && aiData.ai_open_questions.filter(q => q && q.question).length > 0 && (
              <div className="rounded-md p-2" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.28)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#93c5fd' }}>Needs your input</p>
                <div className="flex flex-col gap-1.5">
                  {aiData.ai_open_questions.filter(q => q && q.question).map((q, i) => (
                    <div key={i}>
                      <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>? {q.question}</p>
                      {q.why && <p className="text-[10px] leading-snug" style={{ color: 'rgba(255,255,255,0.5)' }}>{q.why}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!aiData.ai_risk_score && !aiData.ai_next_best_action && !runningAI && (
              <p className="text-[11px] text-muted-foreground">No analysis yet — click Run AI to generate insights.</p>
            )}
          </div>

          {/* Stage rail */}
          <div>
            <label className="field-label">Closing Stage</label>
            <div className="flex flex-col gap-1.5 mt-2">
              {CLOSING_STAGES.map((s, i) => {
                const isActive = form.stage === s.key;
                const isPast = i < stageIdx;
                return (
                  <button key={s.key} onClick={() => setForm(f => ({ ...f, stage: s.key }))}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all text-left"
                    style={{
                      background: isActive ? s.color + '22' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isActive ? s.color + '55' : 'rgba(255,255,255,0.07)'}`,
                    }}>
                    <div className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: isActive ? s.color : isPast ? s.color + '66' : 'rgba(255,255,255,0.15)' }} />
                    <span style={{ color: isActive ? s.color : isPast ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.4)' }}>
                      {s.label}
                    </span>
                    {isActive && <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: s.color + '33', color: s.color }}>Current</span>}
                    {isPast && <CheckCircle2 className="w-3.5 h-3.5 ml-auto flex-shrink-0" style={{ color: s.color + '88' }} />}
                  </button>
                );
              })}
            </div>
            {/* Quick advance button */}
            {nextStage && (
              <button onClick={() => handleAdvanceStage(nextStage.key)}
                className="w-full mt-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
                style={{ background: nextStage.color + '22', border: `1px solid ${nextStage.color}55`, color: nextStage.color }}>
                <ArrowRight className="w-3.5 h-3.5" />
                Advance to: {nextStage.label}
              </button>
            )}
          </div>

          <div className="gold-divider" />

          {/* Trustee */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Trustee Office</label>
              <input value={form.trustee_office} onChange={sf('trustee_office')} placeholder="e.g. Dubai Trustee" className="field-input" />
            </div>
            <div>
              <label className="field-label">Appointment Date/Time</label>
              <input type="datetime-local" value={form.trustee_appointment_at} onChange={sf('trustee_appointment_at')} className="field-input" />
            </div>
          </div>

          {/* Cheques */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Cheques Received</label>
              <input type="number" value={form.cheques_received_count} onChange={sn('cheques_received_count')} min="0" className="field-input" />
            </div>
            <div>
              <label className="field-label">Cheques Required</label>
              <input type="number" value={form.cheques_required_count} onChange={sn('cheques_required_count')} min="0" className="field-input" />
            </div>
          </div>

          {/* NOC */}
          <div>
            <label className="field-label">NOC Status</label>
            <select value={form.noc_status} onChange={sf('noc_status')} className="field-input">
              {NOC_OPTS.map(o => <option key={o} value={o}>{LABEL(o)}</option>)}
            </select>
          </div>

          {/* DLD + title deed */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">DLD Transfer Ref</label>
              <input value={form.dld_transfer_ref} onChange={sf('dld_transfer_ref')} placeholder="DLD reference" className="field-input" />
            </div>
            <div>
              <label className="field-label">Title Deed Number</label>
              <input value={form.title_deed_number} onChange={sf('title_deed_number')} placeholder="Deed #" className="field-input" />
            </div>
          </div>

          {/* Financials */}
          <div>
            <label className="field-label">Deal Value (AED)</label>
            <input type="number" value={form.deal_value_aed} onChange={sf('deal_value_aed')} placeholder="0" className="field-input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Commission — Sell (AED)</label>
              <input type="number" value={form.commission_amount_aed} onChange={sf('commission_amount_aed')} placeholder="0" className="field-input" />
            </div>
            <div>
              <label className="field-label">Commission — Buy (AED)</label>
              <input type="number" value={form.commission_amount_buy_side_aed} onChange={sf('commission_amount_buy_side_aed')} placeholder="0" className="field-input" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="field-label">Notes</label>
            <WritingField value={form.notes} onChange={sf('notes')} rows={3} placeholder="Closing notes…" className="field-input resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <EmailComposeButton toEmail={leadEmail} toName={deal.lead_name} />
        </div>
        <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all active:scale-95"
            style={{ background: 'hsl(38 92% 50%)', color: '#1a1a2e' }}>
            {saving ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Saving…</span> : 'Save Changes'}
          </button>
        </div>

        <style>{`
          .field-label{display:block;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.4);margin-bottom:5px;}
          .field-input{width:100%;padding:8px 12px;border-radius:10px;font-size:13px;outline:none;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.9);}
          .field-input:focus{border-color:hsl(38 92% 50% / 0.5);box-shadow:0 0 0 2px hsl(38 92% 50% / 0.1);}
          select.field-input option{background:#1a1a2e;color:white;}
        `}</style>
      </div>
    </div>
  );
}