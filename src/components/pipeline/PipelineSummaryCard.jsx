// Summary card for the Pipeline board — conversion rate + total potential revenue
// (hairline wells, champagne ink) + the BUYER PULSE row (client-side quick-filters).
import React, { useMemo } from 'react';
import { Percent, DollarSign, AlertTriangle, Flame, Zap, TrendingUp } from 'lucide-react';
import { PB, champagneInk, isAtRisk, isHot, hasSignals, formatAEDCompact } from '@/lib/buyerPipelineTokens';

// Pulse chip — clickable quick-filter. Active = 8% tint fill. Zero = 35% opacity.
function PulseChip({ icon: Icon, label, count, onClick, active, tone = 'gold' }) {
  const zero = !count;
  const toneColor = tone === 'claret' ? PB.CLARET_TEXT : PB.GOLD;
  const activeBg = tone === 'claret' ? PB.CLARET_BG : 'rgba(198,161,91,0.08)';
  const activeBorder = tone === 'claret' ? PB.CLARET_BORDER : 'rgba(198,161,91,0.35)';

  return (
    <button
      type="button"
      onClick={zero ? undefined : onClick}
      disabled={zero}
      title={label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 999,
        background: active ? activeBg : 'transparent',
        border: `1px solid ${active ? activeBorder : PB.HAIR2}`,
        color: active ? toneColor : zero ? PB.SLATE : toneColor,
        fontSize: 10, fontWeight: 600,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        whiteSpace: 'nowrap', cursor: zero ? 'default' : 'pointer',
        opacity: zero ? 0.35 : 1,
        transition: 'border-color 150ms ease, color 150ms ease, background 150ms ease',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <Icon className="w-3 h-3" strokeWidth={1.5} style={{ flex: 'none' }} />
      {label}
      <span style={{ fontWeight: 700 }}>{count}</span>
    </button>
  );
}

export default function PipelineSummaryCard({ leads, stages, activePulse = null, onPulseFilter = () => {} }) {
  const { conversionRate, wonCount, totalCount, potentialRevenue, atRiskCount, hotCount, signalsCount, expectedRevenue } = useMemo(() => {
    const total = leads.length;
    const finalStageKey = stages.length ? stages[stages.length - 1].key : null;
    const won = leads.filter((l) => l.stage === finalStageKey).length;
    const revenue = leads.reduce((sum, l) => sum + (l.deal_value_aed || 0), 0);
    const atRisk = leads.filter(isAtRisk).length;
    const hot = leads.filter(isHot).length;
    const sig = leads.filter(hasSignals).length;
    // Expected = Σ conversion_probability × deal_value_aed (probability-weighted pipeline)
    const expected = leads.reduce((sum, l) => sum + ((l.ai_conversion_probability || 0) * (l.deal_value_aed || 0)), 0);
    return {
      conversionRate: total > 0 ? (won / total) * 100 : 0,
      wonCount: won,
      totalCount: total,
      potentialRevenue: revenue,
      atRiskCount: atRisk,
      hotCount: hot,
      signalsCount: sig,
      expectedRevenue: expected,
    };
  }, [leads, stages]);

  const toggle = (key) => onPulseFilter(activePulse === key ? null : key);

  return (
    <div className="mb-3 space-y-2">
      {/* Hairline wells — conversion + revenue */}
      <div className="grid grid-cols-2 gap-2">
        <div
          className="rounded-xl px-3 py-2.5 flex items-center gap-2.5"
          style={{ background: PB.WELL, border: `1px solid ${PB.HAIR}` }}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-none" style={{ background: 'rgba(198,161,91,0.06)', border: `1px solid rgba(198,161,91,0.2)` }}>
            <Percent className="w-3.5 h-3.5" strokeWidth={1.5} style={{ color: PB.GOLD }} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-semibold uppercase block" style={{ color: PB.SLATE, letterSpacing: '0.08em' }}>Conversion Rate</span>
            <p className="text-[15px] font-bold" style={{ ...champagneInk, fontSize: '15px' }}>
              {conversionRate.toFixed(1)}%
              <span className="text-[10px] font-medium ml-1.5" style={{ WebkitTextFillColor: PB.SLATE, color: PB.SLATE, backgroundImage: 'none' }}>
                ({wonCount}/{totalCount})
              </span>
            </p>
          </div>
        </div>
        <div
          className="rounded-xl px-3 py-2.5 flex items-center gap-2.5"
          style={{ background: PB.WELL, border: `1px solid ${PB.HAIR}` }}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-none" style={{ background: 'rgba(198,161,91,0.06)', border: `1px solid rgba(198,161,91,0.2)` }}>
            <DollarSign className="w-3.5 h-3.5" strokeWidth={1.5} style={{ color: PB.GOLD }} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-semibold uppercase block" style={{ color: PB.SLATE, letterSpacing: '0.08em' }}>Pipeline Value</span>
            <p className="text-[15px] font-bold" style={{ ...champagneInk, fontSize: '15px' }}>{formatAEDCompact(potentialRevenue)}</p>
          </div>
        </div>
      </div>

      {/* BUYER PULSE row — client-side quick-filters from the active track's leads */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[9px] font-semibold uppercase shrink-0" style={{ color: PB.SLATE, letterSpacing: '0.1em' }}>Buyer Pulse</span>
        <PulseChip
          icon={AlertTriangle}
          label="AT RISK"
          count={atRiskCount}
          onClick={() => toggle('risk')}
          active={activePulse === 'risk'}
          tone="claret"
        />
        <PulseChip
          icon={Flame}
          label="HOT"
          count={hotCount}
          onClick={() => toggle('hot')}
          active={activePulse === 'hot'}
          tone="gold"
        />
        <PulseChip
          icon={Zap}
          label="SIGNALS"
          count={signalsCount}
          onClick={() => toggle('signals')}
          active={activePulse === 'signals'}
          tone="gold"
        />
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{
            background: 'transparent',
            border: `1px solid ${PB.HAIR2}`,
            fontVariantNumeric: 'tabular-nums',
          }}
          title="Probability-weighted pipeline — Σ conversion_probability × deal value"
        >
          <TrendingUp className="w-3 h-3" strokeWidth={1.5} style={{ color: PB.GOLD, flex: 'none' }} />
          <span className="text-[10px] font-semibold" style={{ color: PB.SLATE, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Expected</span>
          <span className="text-[11px] font-bold" style={champagneInk}>{formatAEDCompact(expectedRevenue)}</span>
        </div>
      </div>
    </div>
  );
}