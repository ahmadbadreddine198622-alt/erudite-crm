// Vital Signs strip — 4 score gauges (with rationale tooltips), momentum, strike-now,
// est. commission, days in stage. Read-only from existing Landlord score fields.
import { Zap } from 'lucide-react';
import { PALETTE, scoreColor, fmtAED, MOMENTUM_COLOR } from './cmdHelpers';

function Gauge({ label, value, suffix = '', rationale }) {
  const has = value != null && !isNaN(value);
  const pct = has ? Math.max(0, Math.min(100, value)) : 0;
  const color = scoreColor(has ? value : null);
  return (
    <div
      className="flex-1 min-w-[120px] rounded-xl px-3 py-2.5"
      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${PALETTE.cardBorder}` }}
      title={rationale || ''}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: PALETTE.textFaint }}>{label}</span>
        <span className="text-[20px] font-bold tabular-nums" style={{ color }}>{has ? `${Math.round(value)}${suffix}` : '—'}</span>
      </div>
      <div className="h-1.5 mt-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      {rationale && <div className="text-[10px] mt-1.5 line-clamp-2" style={{ color: PALETTE.textDim }}>{rationale}</div>}
    </div>
  );
}

export default function VitalSigns({ raw }) {
  const winPct = raw.mandate_win_probability != null ? Math.round(raw.mandate_win_probability * 100) : null;
  const strike = raw.ai_strike_now === true || (typeof raw.ai_strike_now === 'object' && raw.ai_strike_now && (raw.ai_strike_now.is_strike || raw.ai_strike_now.active));
  const momColor = MOMENTUM_COLOR(raw.ai_momentum);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-stretch gap-2 flex-wrap">
        <Gauge label="Trust" value={raw.trust_score} rationale={raw.trust_score_rationale} />
        <Gauge label="Responsiveness" value={raw.responsiveness_score} rationale={raw.responsiveness_score_rationale} />
        <Gauge label="Urgency" value={raw.urgency_score} rationale={raw.urgency_score_rationale} />
        <Gauge label="Win Probability" value={winPct} suffix="%" rationale={raw.mandate_win_rationale} />
      </div>
      <div className="flex items-center gap-2 flex-wrap text-[12px]">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold" style={{ background: `${momColor}1f`, color: momColor, border: `1px solid ${momColor}40` }}>
          Momentum: {raw.ai_momentum ? raw.ai_momentum : 'Unknown'}
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold"
          style={{ background: strike ? `${PALETTE.gold}22` : 'rgba(255,255,255,0.04)', color: strike ? PALETTE.gold : PALETTE.textFaint, border: `1px solid ${strike ? PALETTE.gold + '55' : 'rgba(255,255,255,0.08)'}` }}>
          <Zap className="w-3.5 h-3.5" style={{ fill: strike ? PALETTE.gold : 'none' }} /> Strike {strike ? 'now' : 'off'}
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(255,255,255,0.04)', color: PALETTE.gold, border: '1px solid rgba(255,255,255,0.08)' }}>
          Est. commission {raw.estimated_commission_aed ? fmtAED(raw.estimated_commission_aed) : '—'}
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(255,255,255,0.04)', color: PALETTE.textDim, border: '1px solid rgba(255,255,255,0.08)' }}>
          Days in stage: {raw.days_in_stage != null ? Math.round(raw.days_in_stage) : '—'}
        </span>
      </div>
    </div>
  );
}