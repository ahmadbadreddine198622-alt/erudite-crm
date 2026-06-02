import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { differenceInDays, formatDistanceToNow, parseISO, isPast } from 'date-fns';
import {
  ShieldAlert, AlertTriangle, Clock, MessageCircle, FileX,
  Loader2, Sparkles, RefreshCw, ChevronDown, ChevronUp,
  Phone, Users, CreditCard, FileWarning, Building2, Banknote
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Active deal stages to monitor
const ACTIVE_STAGES = [
  'viewing', 'offer_drafting', 'offer_submitted', 'negotiating',
  'agreement', 'diligence', 'noc_signing', 'closing',
];

const STAGE_LABELS = {
  viewing: 'Viewing',
  offer_drafting: 'Offer Drafting',
  offer_submitted: 'Offer Submitted',
  negotiating: 'Negotiating',
  agreement: 'Agreement',
  diligence: 'Due Diligence',
  noc_signing: 'NOC / Signing',
  closing: 'Closing / DLD',
};

// ─── Dubai-Reality Risk Scoring Engine ─────────────────────────────────────
function computeDealRisk(deal, lead) {
  const signals = [];
  const now = new Date();

  // 1. Communication gap (uses deal.last_contact_date or lead.last_touch_at)
  const lastContact = deal?.last_contact_date || lead?.last_touch_at || lead?.last_activity_at || deal?.updated_date;
  const commGap = lastContact ? differenceInDays(now, parseISO(lastContact)) : 999;
  if (commGap >= 22) {
    signals.push({ score: 35, label: `No contact for ${commGap} days`, icon: MessageCircle, severity: 'critical', type: 'comm' });
  } else if (commGap >= 15) {
    signals.push({ score: 20, label: `No contact for ${commGap} days`, icon: MessageCircle, severity: 'high', type: 'comm' });
  } else if (commGap >= 7) {
    signals.push({ score: 10, label: `No contact for ${commGap} days`, icon: MessageCircle, severity: 'medium', type: 'comm' });
  }

  // 2. Bounced or overdue cheque (+40 — instant critical trigger)
  const chequeStatus = deal?.cheque_status;
  const chequeDue = deal?.cheque_due_date;
  if (chequeStatus === 'bounced') {
    signals.push({ score: 40, label: 'Cheque bounced — escalate now', icon: CreditCard, severity: 'critical', type: 'cheque' });
  } else if (chequeStatus === 'pending' && chequeDue && isPast(parseISO(chequeDue))) {
    const overdueDays = differenceInDays(now, parseISO(chequeDue));
    signals.push({ score: 40, label: `Cheque overdue by ${overdueDays}d`, icon: CreditCard, severity: 'critical', type: 'cheque' });
  }

  // 3. Form F / MOU / Form I expired or missing at wrong stage
  const formStatus = deal?.form_status;
  const formExpiry = deal?.form_expiry_date;
  const lateStages = ['negotiating', 'agreement', 'diligence', 'noc_signing', 'closing'];
  if (formStatus === 'expired') {
    signals.push({ score: 25, label: 'Form/MOU expired — needs renewal', icon: FileWarning, severity: 'high', type: 'form' });
  } else if (formStatus === 'none' && lateStages.includes(deal?.stage)) {
    signals.push({ score: 25, label: 'No signed Form F/MOU at this stage', icon: FileX, severity: 'high', type: 'form' });
  } else if (formExpiry && isPast(parseISO(formExpiry))) {
    signals.push({ score: 25, label: `Form expired ${differenceInDays(now, parseISO(formExpiry))}d ago`, icon: FileWarning, severity: 'high', type: 'form' });
  }

  // 4. DLD transfer date passed but deal not closed (+35)
  const dldDate = deal?.dld_transfer_date;
  if (dldDate && isPast(parseISO(dldDate)) && !deal?.dld_transfer_done) {
    const overdueDays = differenceInDays(now, parseISO(dldDate));
    signals.push({ score: 35, label: `DLD transfer overdue by ${overdueDays}d`, icon: Building2, severity: 'critical', type: 'dld' });
  }

  // 5. Financing unconfirmed within 14 days of transfer (+25)
  const financingStatus = deal?.financing_status;
  if (financingStatus === 'unconfirmed' && dldDate) {
    const daysToTransfer = differenceInDays(parseISO(dldDate), now);
    if (daysToTransfer >= 0 && daysToTransfer <= 14) {
      signals.push({ score: 25, label: `Financing unconfirmed — ${daysToTransfer}d to transfer`, icon: Banknote, severity: 'high', type: 'financing' });
    }
  }
  if (financingStatus === 'declined') {
    signals.push({ score: 35, label: 'Financing declined', icon: Banknote, severity: 'critical', type: 'financing' });
  }

  // 6. Counterparty unresponsive (no update in 10+ days on active deal)
  const counterpartyUpdate = deal?.counterparty_last_update_at;
  if (counterpartyUpdate) {
    const counterpartyGap = differenceInDays(now, parseISO(counterpartyUpdate));
    if (counterpartyGap >= 10 && ACTIVE_STAGES.includes(deal?.stage)) {
      signals.push({ score: 20, label: `Counterparty silent for ${counterpartyGap}d`, icon: Users, severity: 'high', type: 'counterparty' });
    }
  }

  // 7. Stage stagnation (Dubai deals should move within 14 days)
  const stageEntered = deal?.stage_entered_at || lead?.stage_entered_at;
  const daysInStage = stageEntered ? differenceInDays(now, parseISO(stageEntered)) : null;
  if (daysInStage !== null) {
    if (daysInStage >= 21) {
      signals.push({ score: 20, label: `Stuck in stage for ${daysInStage}d`, icon: Clock, severity: 'high', type: 'stagnation' });
    } else if (daysInStage >= 14) {
      signals.push({ score: 10, label: `In stage for ${daysInStage}d`, icon: Clock, severity: 'medium', type: 'stagnation' });
    }
  }

  // Compute total score
  const totalScore = signals.reduce((sum, s) => sum + s.score, 0);
  const hasInstantCritical = signals.some(s => s.score >= 40);

  // Tier mapping
  let tier;
  if (hasInstantCritical || totalScore >= 60) tier = 'critical';
  else if (totalScore >= 35) tier = 'high';
  else if (totalScore >= 15) tier = 'watch';
  else tier = 'healthy';

  // Dominant signal (highest score)
  const dominantSignal = signals.sort((a, b) => b.score - a.score)[0];

  return { signals, totalScore, tier, dominantSignal, commGap, daysInStage };
}

// ─── Recovery Action Generator ─────────────────────────────────────────────
function getInstantRecoveryAction(risk, deal, lead) {
  const dominant = risk.dominantSignal;
  if (!dominant) return null;

  const name = lead?.full_name || deal?.lead_name || 'the client';
  const prop = deal?.property_ref || 'the property';

  const actions = {
    cheque: `📞 CALL NOW — ${name} re: bounced/overdue cheque on ${prop}. Script: "Hi ${name}, I'm calling about the payment for ${prop}. We need to resolve this today to keep the deal alive. Can we arrange a replacement cheque or bank transfer within 24 hours?"`,
    dld: `📞 URGENT CALL — DLD transfer is overdue. Call ${name} immediately, then escalate to CEO. Prepare cancellation docs as leverage. WhatsApp follow-up with DLD appointment link.`,
    financing: `📞 CALL ${name} TODAY — Financing must be confirmed before transfer. Get written pre-approval from their bank within 48h or consider asking for cash alternative. Escalate to manager if unresponsive.`,
    form: `📱 WhatsApp ${name} — "Hi, our Form F/MOU needs to be renewed to keep this deal protected. Can we meet or sign digitally today? This protects your rights too." Then call if no reply in 2h.`,
    comm: `📱 WhatsApp ${name} — "Hi ${name}, just checking in on ${prop} — are you still interested? We have other inquiries on this unit, wanted to give you first right." Call immediately after.`,
    counterparty: `📧 Email counterparty agent — "Following up on ${prop}. Our client is committed and waiting on your response. Please update by EOD or we'll have to review our client's options." CC manager.`,
    stagnation: `📞 Call ${name} — "Hi, I want to make sure we're still aligned on ${prop}. What's the main thing holding you back right now?" Then log outcome and move or close the stage.`,
  };

  return actions[dominant.type] || `📞 Call ${name} about ${prop} today. Dominant risk: ${dominant.label}`;
}

// ─── UI Components ──────────────────────────────────────────────────────────
const TIER_CONFIG = {
  critical: { label: 'Critical', color: 'text-red-400', border: 'rgba(239,68,68,0.35)', bg: 'rgba(239,68,68,0.08)', badge: 'bg-red-500/15 text-red-400 border-red-500/30' },
  high:     { label: 'High Risk', color: 'text-orange-400', border: 'rgba(249,115,22,0.30)', bg: 'rgba(249,115,22,0.07)', badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  watch:    { label: 'Watch', color: 'text-amber-400', border: 'rgba(245,158,11,0.25)', bg: 'rgba(245,158,11,0.06)', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
};

function RiskCard({ deal, lead, risk }) {
  const [expanded, setExpanded] = useState(false);
  const [aiPlan, setAiPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const cfg = TIER_CONFIG[risk.tier] || TIER_CONFIG.watch;

  const instantAction = getInstantRecoveryAction(risk, deal, lead);

  const getAIPlan = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('claudeAI', {
        prompt: `You are an elite Dubai real estate deal-saver. Analyze this at-risk deal and give specific recovery steps tuned to Dubai brokerage reality (DLD, Form F, NOC, cheques, counterparty agents).

Deal: ${deal?.property_ref || 'N/A'} | Type: ${deal?.deal_type || 'N/A'} | Stage: ${STAGE_LABELS[deal?.stage] || deal?.stage}
Client: ${lead?.full_name || deal?.lead_name} | Value: AED ${(deal?.deal_value || 0).toLocaleString()}
Agent: ${deal?.agent_name || deal?.assigned_agent_email}
Cheque status: ${deal?.cheque_status || 'N/A'} | Form status: ${deal?.form_status || 'N/A'}
Financing: ${deal?.financing_status || 'N/A'} | DLD date: ${deal?.dld_transfer_date || 'N/A'}
Risk score: ${risk.totalScore} | Tier: ${risk.tier}
Signals: ${risk.signals.map(s => s.label).join(' | ')}
Last contact: ${risk.commGap} days ago | Days in stage: ${risk.daysInStage || 'N/A'}

Return JSON:
{
  "situation_assessment": "<2 sentences — what's happening and why this deal is at risk>",
  "immediate_action": "<the single most important thing to do TODAY — include exact message/script>",
  "recovery_steps": ["<step 1>", "<step 2>", "<step 3>"],
  "risk_of_loss": "<low | medium | high | critical>",
  "days_to_act": <number>
}`,
        response_json_schema: {
          type: 'object',
          properties: {
            situation_assessment: { type: 'string' },
            immediate_action: { type: 'string' },
            recovery_steps: { type: 'array', items: { type: 'string' } },
            risk_of_loss: { type: 'string' },
            days_to_act: { type: 'number' },
          },
        },
      });
      setAiPlan(res?.data || res);
      setExpanded(true);
    } catch {
      toast.error('Could not generate AI recovery plan');
    } finally {
      setLoading(false);
    }
  };

  const phone = lead?.phone || deal?.client_phone;
  const whatsapp = lead?.whatsapp || deal?.client_whatsapp;

  return (
    <div className="rounded-2xl p-4 border transition-all" style={{ background: cfg.bg, borderColor: cfg.border }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}>{cfg.label}</span>
            <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">
              {STAGE_LABELS[deal?.stage] || deal?.stage}
            </span>
            <span className="text-[10px] text-white/30 ml-auto">Score: {risk.totalScore}</span>
          </div>
          <p className="font-semibold text-white/90 truncate">{lead?.full_name || deal?.lead_name}</p>
          <p className="text-xs text-amber-400/80 font-medium">{deal?.property_ref || 'No property ref'}</p>
          {deal?.deal_value && (
            <p className="text-xs text-white/40 mt-0.5">AED {deal.deal_value.toLocaleString()}</p>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {phone && (
            <a href={`tel:${phone}`} className="p-1.5 rounded-lg bg-white/6 border border-white/10 hover:bg-white/10 transition-colors" title="Call">
              <Phone className="w-3.5 h-3.5 text-white/55" />
            </a>
          )}
          {whatsapp && (
            <a href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
              className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors" title="WhatsApp">
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
            </a>
          )}
        </div>
      </div>

      {/* Risk signals */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {risk.signals.map((s, i) => {
          const SIcon = s.icon;
          const sc = s.severity === 'critical' ? 'text-red-400 bg-red-500/10 border-red-500/20'
                   : s.severity === 'high' ? 'text-orange-400 bg-orange-500/10 border-orange-500/20'
                   : 'text-amber-400 bg-amber-500/10 border-amber-500/20';
          return (
            <span key={i} className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${sc}`}>
              <SIcon className="w-3 h-3" />{s.label}
            </span>
          );
        })}
      </div>

      {/* Instant recovery action */}
      {instantAction && (
        <div className="mb-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-[10px] uppercase tracking-wider text-white/35 mb-1">Immediate Action</p>
          <p className="text-xs text-white/75 leading-relaxed">{instantAction}</p>
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-3 text-[11px] text-white/35 mb-3 flex-wrap">
        {deal?.agent_name && <span>Agent: {deal.agent_name}</span>}
        {risk.commGap < 999 && <span>· Last contact {risk.commGap}d ago</span>}
        {deal?.counterparty_agent && <span>· Counterparty: {deal.counterparty_agent}</span>}
      </div>

      {/* AI deep-dive button */}
      {!aiPlan ? (
        <Button size="sm" variant="outline" onClick={getAIPlan} disabled={loading}
          className="gap-1.5 text-xs h-7 border-white/15 text-white/65 hover:text-white/90 w-full">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-violet-400" />}
          {loading ? 'Analyzing…' : 'Get Deep AI Recovery Plan'}
        </Button>
      ) : (
        <div className="mt-2 space-y-3">
          <button onClick={() => setExpanded(e => !e)}
            className="w-full flex items-center justify-between text-xs font-semibold text-violet-300 py-1">
            <span className="flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> AI Recovery Plan</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {expanded && (
            <div className="space-y-3 pt-1 border-t border-white/8">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/35 mb-1">Situation</p>
                <p className="text-xs text-white/70 leading-relaxed">{aiPlan.situation_assessment}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.20)' }}>
                <p className="text-[10px] uppercase tracking-wider text-violet-400/70 mb-1">Immediate Action Today</p>
                <p className="text-xs text-white/85 leading-relaxed">{aiPlan.immediate_action}</p>
              </div>
              {aiPlan.recovery_steps?.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/35 mb-1.5">Recovery Steps</p>
                  <ol className="space-y-1">
                    {aiPlan.recovery_steps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-xs text-white/65">
                        <span className="text-violet-400 font-bold flex-shrink-0">{i + 1}.</span>{step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="flex items-center gap-3">
                {aiPlan.risk_of_loss && (
                  <span className="text-[10px] text-white/40">Risk of loss: <span className="text-red-400 font-semibold">{aiPlan.risk_of_loss}</span></span>
                )}
                {aiPlan.days_to_act && (
                  <span className="text-[10px] text-white/40">Act within: <span className="text-amber-400 font-semibold">{aiPlan.days_to_act}d</span></span>
                )}
                <button onClick={getAIPlan} disabled={loading} className="ml-auto text-[10px] text-white/30 hover:text-white/55 flex items-center gap-1">
                  <RefreshCw className="w-2.5 h-2.5" /> Refresh
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function DealRiskMonitor() {
  const [filter, setFilter] = useState('all');

  // Fetch active deals
  const { data: deals = [], isLoading: dealsLoading, refetch: refetchDeals } = useQuery({
    queryKey: ['risk-deals'],
    queryFn: () => base44.entities.Deal.list('-updated_date', 300),
    staleTime: 2 * 60_000,
  });

  // Fetch active leads (for enrichment)
  const { data: leads = [], isLoading: leadsLoading, refetch: refetchLeads } = useQuery({
    queryKey: ['risk-leads'],
    queryFn: () => base44.entities.Lead.filter({ status: 'active' }, '-updated_date', 300),
    staleTime: 2 * 60_000,
  });

  const isLoading = dealsLoading || leadsLoading;

  // Build lead lookup map
  const leadMap = useMemo(() => {
    const map = {};
    leads.forEach(l => { map[l.id] = l; });
    return map;
  }, [leads]);

  const refetch = () => { refetchDeals(); refetchLeads(); };

  // Score all active deals
  const scoredDeals = useMemo(() => {
    return deals
      .filter(d => ACTIVE_STAGES.includes(d.stage))
      .map(deal => {
        const lead = leadMap[deal.lead_id] || null;
        const risk = computeDealRisk(deal, lead);
        return { deal, lead, risk };
      })
      .filter(({ risk }) => risk.tier !== 'healthy')
      .sort((a, b) => {
        const order = { critical: 0, high: 1, watch: 2 };
        return (order[a.risk.tier] ?? 9) - (order[b.risk.tier] ?? 9);
      });
  }, [deals, leadMap]);

  // Also score active leads that have no Deal record (legacy / lead-based tracking)
  const leadOnlyRisks = useMemo(() => {
    const dealLeadIds = new Set(deals.map(d => d.lead_id));
    const LEAD_STAGES = ['viewing', 'objection_offer', 'negotiation_deal_lock', 'closing_dld', 'contract_cheques', 'ejari_movein'];
    return leads
      .filter(l => LEAD_STAGES.includes(l.stage) && !dealLeadIds.has(l.id))
      .map(lead => {
        const risk = computeDealRisk(null, lead);
        return { deal: null, lead, risk };
      })
      .filter(({ risk }) => risk.tier !== 'healthy')
      .sort((a, b) => {
        const order = { critical: 0, high: 1, watch: 2 };
        return (order[a.risk.tier] ?? 9) - (order[b.risk.tier] ?? 9);
      });
  }, [leads, deals]);

  const allRisks = useMemo(() => [...scoredDeals, ...leadOnlyRisks], [scoredDeals, leadOnlyRisks]);

  const filtered = filter === 'all' ? allRisks : allRisks.filter(d => d.risk.tier === filter);

  const counts = {
    critical: allRisks.filter(d => d.risk.tier === 'critical').length,
    high:     allRisks.filter(d => d.risk.tier === 'high').length,
    watch:    allRisks.filter(d => d.risk.tier === 'watch').length,
  };

  return (
    <div className="page-root">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <h1 className="page-title text-xl">Deal Risk Monitor</h1>
          </div>
          <p className="page-subtitle">Dubai-tuned risk scoring across {deals.length} deals + {leads.length} leads</p>
        </div>
        <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading} className="gap-1.5 flex-shrink-0">
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </Button>
      </div>

      {/* Counter cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { key: 'critical', label: 'Critical', color: 'text-red-400',    bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.25)' },
          { key: 'high',     label: 'High Risk', color: 'text-orange-400', bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.25)' },
          { key: 'watch',    label: 'Watch',     color: 'text-amber-400',  bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)' },
        ].map(c => (
          <button key={c.key} onClick={() => setFilter(filter === c.key ? 'all' : c.key)}
            className="rounded-xl p-3 text-center transition-all"
            style={{
              background: filter === c.key ? c.bg : 'rgba(255,255,255,0.05)',
              border: `1px solid ${filter === c.key ? c.border : 'rgba(255,255,255,0.10)'}`,
            }}>
            <p className={`text-2xl font-bold ${c.color}`}>{isLoading ? '—' : counts[c.key]}</p>
            <p className="text-[11px] text-white/50 font-medium mt-0.5">{c.label}</p>
          </button>
        ))}
      </div>

      {/* Signal legend */}
      <div className="mb-4 rounded-xl p-3 flex flex-wrap gap-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-[10px] text-white/30 uppercase tracking-wider w-full mb-1">Scoring signals active</p>
        {[
          { icon: CreditCard, label: 'Bounced/overdue cheque (+40)', color: 'text-red-400' },
          { icon: Building2,  label: 'DLD date passed (+35)',         color: 'text-red-400' },
          { icon: MessageCircle, label: 'No contact 22d+ (+35)',      color: 'text-red-400' },
          { icon: FileWarning, label: 'Form expired/missing (+25)',   color: 'text-orange-400' },
          { icon: Banknote,   label: 'Financing unconfirmed (+25)',   color: 'text-orange-400' },
          { icon: Users,      label: 'Counterparty silent (+20)',     color: 'text-amber-400' },
          { icon: Clock,      label: 'Stage stagnation (+20)',        color: 'text-amber-400' },
        ].map((s, i) => {
          const SI = s.icon;
          return (
            <span key={i} className={`inline-flex items-center gap-1 text-[10px] ${s.color}`}>
              <SI className="w-3 h-3" />{s.label}
            </span>
          );
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-white/40">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Scoring deals…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <ShieldAlert className="w-10 h-10 text-emerald-500/50" />
          <p className="text-sm text-white/50 font-medium">No at-risk deals — all looking healthy!</p>
          <p className="text-xs text-white/30">
            {allRisks.length === 0 && deals.length === 0
              ? 'Add deals to the pipeline to start monitoring'
              : `${deals.length} deals + ${leads.length} leads scored`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ deal, lead, risk }, i) => (
            <RiskCard key={deal?.id || lead?.id || i} deal={deal} lead={lead} risk={risk} />
          ))}
        </div>
      )}
    </div>
  );
}