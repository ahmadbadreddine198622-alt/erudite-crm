import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Loader2, PhoneCall, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// ── Field option lists ────────────────────────────────────────────────────────

const MOTIVATION_OPTS = [
  ['', '— Motivation —'],
  ['relocating', 'Relocating'],
  ['cashing_out', 'Cashing Out'],
  ['upgrading_downsizing', 'Upgrading / Downsizing'],
  ['distressed_need_funds', 'Distressed / Needs Funds'],
  ['inherited', 'Inherited'],
  ['poor_returns', 'Poor Returns'],
  ['just_testing_market', 'Just Testing Market'],
  ['other', 'Other'],
  ['unknown', 'Unknown'],
];

const TIMELINE_OPTS = [
  ['', '— Timeline —'],
  ['asap_urgent', 'ASAP / Urgent'],
  ['1_3_months', '1–3 Months'],
  ['3_6_months', '3–6 Months'],
  ['6_12_months', '6–12 Months'],
  ['no_rush_testing', 'No Rush / Testing'],
  ['unknown', 'Unknown'],
];

const PRICE_VS_VAL_OPTS = [
  ['', '— Price vs Valuation —'],
  ['realistic', 'Realistic'],
  ['slightly_high', 'Slightly High'],
  ['significantly_overpriced', 'Significantly Overpriced'],
  ['below_market', 'Below Market'],
  ['not_discussed', 'Not Discussed'],
];

const MANDATE_OPTS = [
  ['', '— Mandate Openness —'],
  ['open_to_exclusive', 'Open to Exclusive'],
  ['non_exclusive_only', 'Non-Exclusive Only'],
  ['already_with_other_brokers', 'Already With Other Brokers'],
  ['wants_to_self_sell', 'Wants to Self-Sell'],
  ['undecided', 'Undecided'],
  ['not_discussed', 'Not Discussed'],
];

const TENANCY_OPTS = [
  ['', '— Tenancy Status —'],
  ['vacant', 'Vacant'],
  ['tenanted_lease_active', 'Tenanted — Lease Active'],
  ['tenanted_lease_expiring', 'Tenanted — Lease Expiring'],
  ['owner_occupied', 'Owner-Occupied'],
  ['unknown', 'Unknown'],
];

const MORTGAGE_OPTS = [
  ['', '— Mortgage Status —'],
  ['free_and_clear', 'Free & Clear'],
  ['mortgaged_local', 'Mortgaged (Local Bank)'],
  ['mortgaged_overseas', 'Mortgaged (Overseas)'],
  ['payment_plan', 'Payment Plan'],
  ['unknown', 'Unknown'],
];

const DECISION_OPTS = [
  ['', '— Decision Maker —'],
  ['sole_decision_maker', 'Sole Decision Maker'],
  ['joint_needs_spouse', 'Joint / Needs Spouse'],
  ['represents_owner', 'Represents Owner'],
  ['unknown', 'Unknown'],
];

const OUTCOME_OPTS = [
  ['', '— Call Outcome —'],
  ['interested_proceeding', 'Interested / Proceeding'],
  ['needs_followup', 'Needs Follow-Up'],
  ['callback_requested', 'Callback Requested'],
  ['thinking_about_it', 'Thinking About It'],
  ['not_ready', 'Not Ready'],
  ['not_interested', 'Not Interested'],
  ['no_answer', 'No Answer'],
  ['wrong_number', 'Wrong Number'],
  ['dead_lead', 'Dead Lead'],
];

const RAPPORT_OPTS = [
  ['', '— Rapport —'],
  ['cold', 'Cold'],
  ['warming', 'Warming'],
  ['rapport_built', 'Rapport Built'],
  ['trust_established', 'Trust Established'],
  ['champion', 'Champion'],
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls = 'w-full px-2.5 py-1.5 text-xs rounded-md';
const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' };

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</label>
      {children}
    </div>
  );
}

function Sel({ value, onChange, opts }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={inputCls} style={inputStyle}>
      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

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
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <PhoneCall className="w-3 h-3 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
          <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>{date}</span>
          {q.call_outcome && (
            <span className={`text-[10px] font-medium ${outcomeColor(q.call_outcome)}`}>
              {q.call_outcome.replace(/_/g, ' ')}
            </span>
          )}
          {q.rapport_after_call && (
            <span className={`text-[10px] font-medium ${rapportColor(q.rapport_after_call)}`}>
              · {q.rapport_after_call.replace(/_/g, ' ')}
            </span>
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

export default function CallQualificationTab({ landlord }) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [saved, setSaved] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['call-qualifications', landlord.id] });
      setForm(EMPTY);
      setSaved(true);
      setIsExpanded(false); // Collapse after save
      setTimeout(() => setSaved(false), 3000);
      toast({ title: 'Call logged', description: 'Qualification saved. AI scoring will run shortly.' });
    },
    onError: e => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-5">
      {/* ── Collapsible Form ── */}
      <div className="rounded-xl overflow-hidden border" style={{ background: 'rgba(250,180,40,0.04)', borderColor: 'rgba(250,180,40,0.15)' }}>
        {/* Header bar - always visible */}
        <button
          onClick={() => setIsExpanded(e => !e)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-amber-500/10"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(250,180,40,0.15)' }}>
              <PhoneCall className="w-4 h-4" style={{ color: 'hsl(38 92% 55%)' }} />
            </div>
            <div>
              <span className="text-sm font-semibold" style={{ color: 'hsl(38 92% 60%)', fontFamily: 'var(--font-display)' }}>
                📞 Log This Call
              </span>
              <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {isExpanded ? 'Click to collapse' : 'Click to expand form'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saved && (
              <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Saved
              </span>
            )}
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.4)' }} />
            ) : (
              <ChevronDown className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.4)' }} />
            )}
          </div>
        </button>

        {/* Expandable content with smooth animation */}
        <div
          className="transition-all duration-300 ease-in-out overflow-hidden"
          style={{
            maxHeight: isExpanded ? '2000px' : '0px',
            opacity: isExpanded ? 1 : 0,
          }}
        >
          <div className="px-4 pb-4 pt-2 space-y-3 border-t" style={{ borderColor: 'rgba(250,180,40,0.1)' }}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Motivation">
                <Sel value={form.motivation} onChange={v => set('motivation', v)} opts={MOTIVATION_OPTS} />
              </Field>
              <Field label="Timeline / Urgency">
                <Sel value={form.timeline_urgency} onChange={v => set('timeline_urgency', v)} opts={TIMELINE_OPTS} />
              </Field>
            </div>

            <Field label="Motivation Notes">
              <input className={inputCls} style={inputStyle} placeholder="In the owner's own words…" value={form.motivation_notes} onChange={e => set('motivation_notes', e.target.value)} />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Price Expectation (AED)">
                <input type="number" className={inputCls} style={inputStyle} placeholder="e.g. 1400000" value={form.price_expectation_aed} onChange={e => set('price_expectation_aed', e.target.value)} />
              </Field>
              <Field label="Price vs Valuation">
                <Sel value={form.price_vs_valuation} onChange={v => set('price_vs_valuation', v)} opts={PRICE_VS_VAL_OPTS} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Mandate Openness">
                <Sel value={form.mandate_openness} onChange={v => set('mandate_openness', v)} opts={MANDATE_OPTS} />
              </Field>
              <Field label="Competing Brokers">
                <input className={inputCls} style={inputStyle} placeholder="Which / how many?" value={form.competing_brokers} onChange={e => set('competing_brokers', e.target.value)} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Tenancy Status">
                <Sel value={form.tenancy_status} onChange={v => set('tenancy_status', v)} opts={TENANCY_OPTS} />
              </Field>
              <Field label="Available From">
                <input type="date" className={inputCls} style={inputStyle} value={form.available_from} onChange={e => set('available_from', e.target.value)} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Mortgage Status">
                <Sel value={form.mortgage_status} onChange={v => set('mortgage_status', v)} opts={MORTGAGE_OPTS} />
              </Field>
              <Field label="Decision Maker?">
                <Sel value={form.is_decision_maker} onChange={v => set('is_decision_maker', v)} opts={DECISION_OPTS} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Call Outcome">
                <Sel value={form.call_outcome} onChange={v => set('call_outcome', v)} opts={OUTCOME_OPTS} />
              </Field>
              <Field label="Rapport After Call">
                <Sel value={form.rapport_after_call} onChange={v => set('rapport_after_call', v)} opts={RAPPORT_OPTS} />
              </Field>
            </div>

            <Field label="Next Step">
              <input className={inputCls} style={inputStyle} placeholder="Agreed next action…" value={form.next_step} onChange={e => set('next_step', e.target.value)} />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Follow-Up Date">
                <input type="date" className={inputCls} style={inputStyle} value={form.followup_date} onChange={e => set('followup_date', e.target.value)} />
              </Field>
            </div>

            <Field label="Agent Notes">
              <textarea
                rows={3}
                className={inputCls + ' resize-none'}
                style={inputStyle}
                placeholder="Anything else from the call…"
                value={form.agent_notes}
                onChange={e => set('agent_notes', e.target.value)}
              />
            </Field>

            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              style={{ background: saved ? 'rgba(16,185,129,0.2)' : 'hsl(38 92% 50%)', color: saved ? '#34d399' : 'hsl(222 47% 11%)', border: saved ? '1px solid rgba(16,185,129,0.4)' : 'none' }}
            >
              {saveMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : saved
                ? <><CheckCircle2 className="w-4 h-4" /> Saved!</>
                : <><PhoneCall className="w-4 h-4" /> Save Call</>}
            </button>
          </div>
        </div>
      </div>

      {/* ── History ── */}
      <div>
        <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Call History ({history.length})
        </p>
        {histLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
        ) : history.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: 'rgba(255,255,255,0.3)' }}>No calls logged yet</p>
        ) : (
          <div className="space-y-2">
            {history.map(q => <QualHistoryItem key={q.id} q={q} />)}
          </div>
        )}
      </div>
    </div>
  );
}