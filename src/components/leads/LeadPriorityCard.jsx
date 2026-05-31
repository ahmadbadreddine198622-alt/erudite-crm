import { Phone, MessageSquare, Clock, TrendingUp, TrendingDown, Minus, AlertTriangle, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const STAGE_LABELS = {
  intake_clarify: 'Intake',
  contact_identity: 'Contact',
  financial_qualification: 'Financial Qual.',
  intent_lock: 'Intent Lock',
  unit_matching: 'Unit Match',
  viewing: 'Viewing',
  objection_offer: 'Objection/Offer',
  negotiation_deal_lock: 'Negotiation',
  closing_dld: 'Closing DLD',
  closed: 'Closed',
  new_tenant_lead: 'New Tenant',
  qualified_tenant: 'Qual. Tenant',
  viewing_decision: 'Viewing Decision',
  contract_cheques: 'Contract',
  ejari_movein: 'Ejari/Move-in',
};

const SCORE_COLOR = (s) => {
  if (s >= 75) return 'text-emerald-400';
  if (s >= 50) return 'text-amber-400';
  if (s >= 25) return 'text-orange-400';
  return 'text-red-400';
};

const SCORE_BG = (s) => {
  if (s >= 75) return 'bg-emerald-500/15 border-emerald-500/30';
  if (s >= 50) return 'bg-amber-500/15 border-amber-500/30';
  if (s >= 25) return 'bg-orange-500/15 border-orange-500/30';
  return 'bg-red-500/15 border-red-500/30';
};

function MiniBar({ value = 0, color = 'bg-amber-500' }) {
  return (
    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export default function LeadPriorityCard({ lead, rank, onSelect }) {
  const score = lead.ai_lead_score || 0;
  const bd = lead.ai_lead_score_breakdown || {};
  const trend = lead.ai_score_trend;
  const churn = lead.ai_churn_prediction?.risk_level;
  const conversion = lead.ai_conversion_probability;
  const daysSince = lead.days_since_last_contact;

  const TrendIcon = trend === 'rising' ? TrendingUp : trend === 'falling' ? TrendingDown : Minus;
  const trendColor = trend === 'rising' ? 'text-emerald-400' : trend === 'falling' ? 'text-red-400' : 'text-slate-400';

  return (
    <button
      onClick={() => onSelect(lead)}
      className={`w-full text-left glass-card border rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer ${SCORE_BG(score)}`}
    >
      <div className="flex items-start gap-3">
        {/* Rank badge */}
        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/60 shrink-0 mt-0.5">
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="font-semibold text-white text-sm truncate">{lead.full_name}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              <TrendIcon className={`w-3.5 h-3.5 ${trendColor}`} />
              <span className={`text-lg font-bold tabular-nums ${SCORE_COLOR(score)}`}>{score}</span>
            </div>
          </div>

          {/* Stage + intent */}
          <div className="flex items-center gap-2 mb-2.5">
            <span className="jewel-pill jewel-slate text-xs">{STAGE_LABELS[lead.stage] || lead.stage}</span>
            {lead.intent && lead.intent !== 'unknown' && (
              <span className="jewel-pill jewel-blue text-xs">{lead.intent}</span>
            )}
            {churn === 'critical' && (
              <span className="jewel-pill jewel-rose text-xs flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" />At Risk</span>
            )}
            {lead.ai_buying_signals?.length > 0 && (
              <span className="jewel-pill jewel-gold text-xs flex items-center gap-1"><Star className="w-2.5 h-2.5" />Signal</span>
            )}
          </div>

          {/* Score breakdown mini bars */}
          <div className="space-y-1 mb-2.5">
            {[
              { label: 'Budget Fit', value: bd.budget_fit, color: 'bg-emerald-500' },
              { label: 'Urgency', value: bd.timeline_urgency, color: 'bg-amber-500' },
              { label: 'Engagement', value: bd.engagement, color: 'bg-blue-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-[10px] text-white/40 w-16 shrink-0">{label}</span>
                <MiniBar value={value} color={color} />
                <span className="text-[10px] text-white/50 w-6 text-right tabular-nums">{value || 0}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-[11px] text-white/40">
            <div className="flex items-center gap-3">
              {daysSince != null && (
                <span className={`flex items-center gap-1 ${daysSince > 5 ? 'text-red-400' : ''}`}>
                  <Clock className="w-3 h-3" />{daysSince}d ago
                </span>
              )}
              {conversion != null && (
                <span className="flex items-center gap-1 text-emerald-400/80">
                  <TrendingUp className="w-3 h-3" />{Math.round(conversion * 100)}% conv.
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Phone className="w-3 h-3" />
              <MessageSquare className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}