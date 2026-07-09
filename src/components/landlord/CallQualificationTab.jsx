import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Loader2, PhoneCall, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import BrainQualifyFlow from './BrainQualifyFlow';

// ── Helpers ───────────────────────────────────────────────────────────────────

function rapportColor(r) {
  const m = { cold: 'text-slate-400', warming: 'text-amber-400', rapport_built: 'text-blue-400', trust_established: 'text-emerald-400', champion: 'text-yellow-400' };
  return m[r] || 'text-muted-foreground';
}

function outcomeColor(o) {
  if (['interested_proceeding'].includes(o)) return 'text-emerald-400';
  if (['dead_lead', 'not_interested'].includes(o)) return 'text-red-400';
  if (['no_answer', 'wrong_number'].includes(o)) return 'text-slate-400';
  return 'text-amber-400';
}

// ── History item ──────────────────────────────────────────────────────────────

function QualHistoryItem({ q }) {
  const [open, setOpen] = useState(false);
  const date = q.call_date ? new Date(q.call_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="rounded-lg border" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <PhoneCall className="w-3 h-3 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
          <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>{date}</span>
          {q.call_outcome && (
            <span className={`text-[10px] font-medium ${outcomeColor(q.call_outcome)}`}>{q.call_outcome.replace(/_/g, ' ')}</span>
          )}
          {q.rapport_after_call && (
            <span className={`text-[10px] font-medium ${rapportColor(q.rapport_after_call)}`}>· {q.rapport_after_call.replace(/_/g, ' ')}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {q.ai_processed && <CheckCircle2 className="w-3 h-3 text-emerald-500" title="AI processed" />}
          {open ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-1.5 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {[
            ['Motivation', q.motivation?.replace(/_/g, ' ')],
            ['Timeline', q.timeline_urgency?.replace(/_/g, ' ')],
            ['Price Expectation', q.price_expectation_aed ? `AED ${Number(q.price_expectation_aed).toLocaleString()}` : null],
            ['Price vs Val', q.price_vs_valuation?.replace(/_/g, ' ')],
            ['Mandate', q.mandate_openness?.replace(/_/g, ' ')],
            ['Competing Brokers', q.competing_brokers],
            ['Tenancy', q.tenancy_status?.replace(/_/g, ' ')],
            ['Available From', q.available_from],
            ['Mortgage', q.mortgage_status?.replace(/_/g, ' ')],
            ['Decision Maker', q.is_decision_maker?.replace(/_/g, ' ')],
            ['Next Step', q.next_step],
            ['Follow-up', q.followup_date],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <span className="text-[10px] shrink-0 w-28" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{value}</span>
            </div>
          ))}
          {q.motivation_notes && (
            <div className="mt-1 rounded px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.6)' }}>{q.motivation_notes}</p>
            </div>
          )}
          {q.agent_notes && (
            <div className="mt-1 rounded px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-[10px] italic" style={{ color: 'rgba(255,255,255,0.5)' }}>{q.agent_notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const EMPTY = {
  motivation: '', motivation_notes: '', timeline_urgency: '',
  price_expectation_aed: '', price_vs_valuation: '',
  mandate_openness: '', competing_brokers: '',
  tenancy_status: '', available_from: '',
  mortgage_status: '', is_decision_maker: '',
  call_outcome: '', rapport_after_call: '',
  next_step: '', followup_date: '', agent_notes: '',
};

export default function CallQualificationTab({ landlord, onReportSaved }) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [saved, setSaved] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: history = [], isLoading: histLoading } = useQuery({
    queryKey: ['call-qualifications', landlord.id],
    queryFn: () => base44.entities.CallQualification.filter({ landlord_id: landlord.id }, '-call_date', 100),
    enabled: !!landlord.id,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        landlord_id: landlord.id,
        landlord_name: landlord.full_name_en || landlord.full_name || '',
        agent_email: user?.email || '',
        call_date: new Date().toISOString(),
        ai_processed: false,
      };
      const optionalFields = [
        'motivation', 'motivation_notes', 'timeline_urgency',
        'price_vs_valuation', 'mandate_openness', 'competing_brokers',
        'tenancy_status', 'available_from', 'mortgage_status',
        'is_decision_maker', 'call_outcome', 'rapport_after_call',
        'next_step', 'followup_date', 'agent_notes',
      ];
      for (const k of optionalFields) {
        if (form[k]) payload[k] = form[k];
      }
      if (form.price_expectation_aed) {
        const n = Number(form.price_expectation_aed);
        if (!isNaN(n) && n > 0) payload.price_expectation_aed = n;
      }
      return base44.entities.CallQualification.create(payload);
    },
    onSuccess: async () => {
      const savedForm = { ...form };
      qc.invalidateQueries({ queryKey: ['call-qualifications', landlord.id] });
      base44.functions.invoke('landlordOrchestrator', { landlord_id: landlord.id, force: true }).catch(() => {});
      setForm(EMPTY);
      setSaved(true);

      setReportLoading(true);
      try {
        const reportRes = await base44.functions.invoke('generateCallReport', {
          landlord_id: landlord.id,
          qualification: savedForm,
          agent_email: user?.email || '',
          agent_name: user?.full_name || '',
        });
        const data = reportRes?.data ?? reportRes;
        if (data?.ok) {
          if (onReportSaved) onReportSaved();
          const { dismiss } = toast({
            title: '✅ Call logged',
            description: 'AI report saved to Notes & Activity' + (data.followup_id ? ' + Follow-up scheduled' : ''),
          });
          setTimeout(dismiss, 2500);
        } else if (data?.error) {
          const { dismiss } = toast({ title: 'Call logged', description: data.error });
          setTimeout(dismiss, 2500);
        }
      } catch (e) {
        const { dismiss } = toast({ title: 'Call logged', description: 'Report generation failed — qualification saved.' });
        setTimeout(dismiss, 2500);
      } finally {
        setReportLoading(false);
        setTimeout(() => setSaved(false), 3000);
      }
    },
    onError: e => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <BrainQualifyFlow
        form={form}
        set={set}
        setForm={setForm}
        landlord={landlord}
        onSave={() => saveMutation.mutate()}
        saving={saveMutation.isPending}
        reportLoading={reportLoading}
        saved={saved}
      />

      {/* History */}
      {histLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : history.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Previous Calls ({history.length})
          </h3>
          {history.map(q => <QualHistoryItem key={q.id} q={q} />)}
        </div>
      ) : null}
    </div>
  );
}