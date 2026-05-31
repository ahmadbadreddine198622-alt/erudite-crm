import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { differenceInDays, formatDistanceToNow, parseISO } from 'date-fns';
import { ShieldAlert, AlertTriangle, Clock, MessageCircle, FileX, Loader2, Sparkles, RefreshCw, ChevronDown, ChevronUp, Phone, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Stages considered "active deals" worth monitoring
const DEAL_STAGES = [
  'viewing', 'objection_offer', 'negotiation_deal_lock', 'closing_dld',
  'qualified_tenant', 'viewing_decision', 'contract_cheques', 'ejari_movein',
];

const STAGE_LABELS = {
  viewing: 'Viewing', objection_offer: 'Offer/Objection',
  negotiation_deal_lock: 'Negotiation', closing_dld: 'Closing/DLD',
  qualified_tenant: 'Qualified Tenant', viewing_decision: 'Viewing Decision',
  contract_cheques: 'Contract & Cheques', ejari_movein: 'Ejari / Move-in',
};

function computeRisk(lead) {
  const flags = [];
  const now = new Date();

  // 1. Communication gap
  const lastContact = lead.last_touch_at || lead.last_activity_at || lead.updated_date;
  const commGap = lastContact ? differenceInDays(now, parseISO(lastContact)) : 999;
  if (commGap >= 10) flags.push({ type: 'comm', severity: 'critical', label: `No contact for ${commGap}d`, icon: MessageCircle });
  else if (commGap >= 5) flags.push({ type: 'comm', severity: 'high', label: `No contact for ${commGap}d`, icon: MessageCircle });

  // 2. Stage stagnation
  const stageEntered = lead.stage_entered_at;
  const daysInStage = stageEntered ? differenceInDays(now, parseISO(stageEntered)) : null;
  if (daysInStage !== null) {
    if (daysInStage >= 21) flags.push({ type: 'stage', severity: 'critical', label: `Stuck in stage for ${daysInStage}d`, icon: Clock });
    else if (daysInStage >= 10) flags.push({ type: 'stage', severity: 'high', label: `In stage for ${daysInStage}d`, icon: Clock });
  }

  // 3. No AI score / low score in closing stage
  if (lead.ai_lead_score !== undefined && lead.ai_lead_score < 40 &&
      ['negotiation_deal_lock', 'closing_dld', 'contract_cheques'].includes(lead.stage)) {
    flags.push({ type: 'score', severity: 'high', label: `Low AI score: ${lead.ai_lead_score}/100`, icon: ShieldAlert });
  }

  // 4. Activity count low
  if ((lead.activity_count || 0) < 2 && daysInStage !== null && daysInStage > 5) {
    flags.push({ type: 'activity', severity: 'medium', label: 'Very low engagement activity', icon: Users });
  }

  // Overall severity
  const hasCritical = flags.some(f => f.severity === 'critical');
  const hasHigh = flags.some(f => f.severity === 'high');
  const riskLevel = hasCritical ? 'critical' : hasHigh ? 'high' : flags.length > 0 ? 'medium' : 'none';

  return { flags, riskLevel, commGap, daysInStage };
}

const RISK_CONFIG = {
  critical: { label: 'Critical Risk', color: 'text-red-400', border: 'border-red-500/30', bg: 'rgba(239,68,68,0.08)', badge: 'bg-red-500/15 text-red-400 border-red-500/30' },
  high:     { label: 'High Risk',     color: 'text-orange-400', border: 'border-orange-500/30', bg: 'rgba(249,115,22,0.07)', badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  medium:   { label: 'Watch',         color: 'text-amber-400', border: 'border-amber-500/25', bg: 'rgba(245,158,11,0.06)', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
};

function RiskCard({ lead, risk }) {
  const [expanded, setExpanded] = useState(false);
  const [aiPlan, setAiPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const cfg = RISK_CONFIG[risk.riskLevel] || RISK_CONFIG.medium;

  const getRecoveryPlan = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('claudeAI', {
        prompt: `You are an elite Dubai real estate sales coach. Analyze this at-risk deal and give specific, actionable recovery steps.

Lead: ${lead.full_name} | Stage: ${STAGE_LABELS[lead.stage] || lead.stage} | Intent: ${lead.intent || 'unknown'}
Budget: ${lead.budget_min ? `AED ${lead.budget_min.toLocaleString()} – ${(lead.budget_max || lead.budget_min).toLocaleString()}` : 'not specified'}
Last contact: ${risk.commGap} days ago | Days in stage: ${risk.daysInStage || 'unknown'}
Risk flags: ${risk.flags.map(f => f.label).join(', ')}
AI Score: ${lead.ai_lead_score || 'unscored'}/100
Notes: ${lead.notes || 'none'}

Return JSON with:
{
  "situation_assessment": "<2 sentences on what's happening and why this deal is at risk>",
  "immediate_action": "<the single most important thing to do TODAY with exact message or approach>",
  "recovery_steps": ["<step 1>", "<step 2>", "<step 3>"],
  "risk_of_loss": "<low | medium | high | critical>",
  "days_to_act": <number of days before this lead is likely lost>
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
      toast.error('Could not generate recovery plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl p-4 border transition-all" style={{ background: cfg.bg, borderColor: cfg.border.replace('border-', '') }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
              {cfg.label}
            </span>
            <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">
              {STAGE_LABELS[lead.stage] || lead.stage}
            </span>
          </div>
          <p className="font-semibold text-white/90 truncate">{lead.full_name}</p>
          {lead.phone && (
            <p className="text-xs text-white/45 mt-0.5">{lead.phone}</p>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="p-1.5 rounded-lg bg-white/6 border border-white/10 hover:bg-white/10 transition-colors">
              <Phone className="w-3.5 h-3.5 text-white/55" />
            </a>
          )}
          {lead.whatsapp && (
            <a href={`https://wa.me/${lead.whatsapp?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
               className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
            </a>
          )}
        </div>
      </div>

      {/* Risk flags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {risk.flags.map((f, i) => {
          const FIcon = f.icon;
          const fc = f.severity === 'critical' ? 'text-red-400 bg-red-500/10 border-red-500/20'
                   : f.severity === 'high' ? 'text-orange-400 bg-orange-500/10 border-orange-500/20'
                   : 'text-amber-400 bg-amber-500/10 border-amber-500/20';
          return (
            <span key={i} className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${fc}`}>
              <FIcon className="w-3 h-3" />
              {f.label}
            </span>
          );
        })}
      </div>

      {/* Budget & last update */}
      <div className="flex items-center gap-3 text-[11px] text-white/40 mb-3">
        {lead.budget_max && (
          <span>AED {(lead.budget_max / 1_000_000).toFixed(1)}M budget</span>
        )}
        {lead.last_touch_at && (
          <span>Last touch {formatDistanceToNow(parseISO(lead.last_touch_at))} ago</span>
        )}
        {lead.assigned_agent_name && (
          <span>· {lead.assigned_agent_name}</span>
        )}
      </div>

      {/* AI Recovery Plan */}
      {!aiPlan && (
        <Button size="sm" variant="outline" onClick={getRecoveryPlan} disabled={loading}
          className="gap-1.5 text-xs h-7 border-white/15 text-white/65 hover:text-white/90 w-full">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-violet-400" />}
          {loading ? 'Analyzing deal…' : 'Get AI Recovery Plan'}
        </Button>
      )}

      {aiPlan && (
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
                        <span className="text-violet-400 font-bold flex-shrink-0">{i + 1}.</span>
                        {step}
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
                <button onClick={getRecoveryPlan} disabled={loading} className="ml-auto text-[10px] text-white/30 hover:text-white/55 flex items-center gap-1">
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

export default function DealRiskMonitor() {
  const [filter, setFilter] = useState('all');

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ['deal-risk-leads'],
    queryFn: () => base44.entities.Lead.filter({ status: 'active' }, '-updated_date', 300),
    staleTime: 2 * 60_000,
  });

  const atRiskDeals = useMemo(() => {
    return leads
      .filter(l => DEAL_STAGES.includes(l.stage))
      .map(lead => ({ lead, risk: computeRisk(lead) }))
      .filter(({ risk }) => risk.riskLevel !== 'none')
      .sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2 };
        return (order[a.risk.riskLevel] ?? 9) - (order[b.risk.riskLevel] ?? 9);
      });
  }, [leads]);

  const filtered = filter === 'all' ? atRiskDeals : atRiskDeals.filter(d => d.risk.riskLevel === filter);

  const counts = {
    critical: atRiskDeals.filter(d => d.risk.riskLevel === 'critical').length,
    high:     atRiskDeals.filter(d => d.risk.riskLevel === 'high').length,
    medium:   atRiskDeals.filter(d => d.risk.riskLevel === 'medium').length,
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
          <p className="page-subtitle">Intelligent flags for at-risk transactions with AI-suggested recovery actions</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 flex-shrink-0">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { key: 'critical', label: 'Critical', color: 'text-red-400', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.25)' },
          { key: 'high',     label: 'High Risk', color: 'text-orange-400', bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.25)' },
          { key: 'medium',   label: 'Watch',    color: 'text-amber-400', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)' },
        ].map(c => (
          <button key={c.key} onClick={() => setFilter(filter === c.key ? 'all' : c.key)}
            className="rounded-xl p-3 text-center transition-all"
            style={{ background: filter === c.key ? c.bg : 'rgba(255,255,255,0.05)', border: `1px solid ${filter === c.key ? c.border : 'rgba(255,255,255,0.10)'}` }}>
            <p className={`text-2xl font-bold ${c.color}`}>{counts[c.key]}</p>
            <p className="text-[11px] text-white/50 font-medium mt-0.5">{c.label}</p>
          </button>
        ))}
      </div>

      {/* Deals list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-white/40">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Analyzing deals…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <ShieldAlert className="w-10 h-10 text-emerald-500/50" />
          <p className="text-sm text-white/50 font-medium">No at-risk deals — all looking healthy!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ lead, risk }) => (
            <RiskCard key={lead.id} lead={lead} risk={risk} />
          ))}
        </div>
      )}
    </div>
  );
}