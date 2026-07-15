// Aurora Pulse — the live heartbeat of the brain, computed client-side from the
// landlord records already loaded on the Landlords page (no new backend calls).
// STRIKE / LAW-14 / HOT are click-to-filter quick toggles; EXPECTED is a stat only.
import { useMemo } from 'react';
import { Zap, Scale, Flame } from 'lucide-react';
import { PB, champagneInk } from '@/lib/pbTokens';
import { STAGE_ORDER } from '@/lib/landlordStageGuide';

// Stages where the 14-Day Law still bites (everything before the unit is live / sold).
const ACTIVE_STAGES = STAGE_ORDER.filter((s) => s !== 'listing_publication' && s !== 'deal_closed');

export default function AuroraPulseChips({ landlords, activePulse, onPulseFilter }) {
  const m = useMemo(() => {
    let strike = 0;
    let law14 = 0;
    let hot = 0;
    let expected = 0;
    for (const l of landlords || []) {
      if (l.ai_strike_now) strike += 1;
      if (l.days_in_stage != null && l.days_in_stage >= 14 && ACTIVE_STAGES.includes(l.stage)) law14 += 1;
      const wp = l.mandate_win_probability;
      if (wp != null) {
        expected += wp * (l.estimated_commission_aed || 0);
        if (wp >= 0.7) hot += 1;
      }
    }
    return { strike, law14, hot, expected };
  }, [landlords]);

  const renderChip = (key, label, Icon, hue, count) => {
    const active = activePulse === key;
    const zero = count === 0;
    const isClaret = hue === 'claret';
    const textActive = isClaret ? PB.CLARET_TEXT : PB.GOLD;
    const line = isClaret ? 'rgba(180,70,63,0.30)' : 'rgba(198,161,91,0.30)';
    const lineStrong = isClaret ? 'rgba(180,70,63,0.45)' : 'rgba(198,161,91,0.45)';
    const tint = isClaret ? 'rgba(180,70,63,0.08)' : 'rgba(198,161,91,0.08)';

    const style = {
      height: 28,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '0 9px',
      borderRadius: 10,
      fontSize: 10.5,
      fontWeight: 600,
      letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
      flex: 'none',
      fontVariantNumeric: 'tabular-nums',
      transition: 'border-color 150ms ease, color 150ms ease, background 150ms ease, opacity 150ms ease',
    };

    if (zero) {
      // 35% opacity, never claret — quiet slate ghost.
      Object.assign(style, {
        background: 'transparent',
        border: `1px solid ${PB.HAIR2}`,
        color: PB.SLATE,
        opacity: 0.35,
        cursor: 'default',
      });
    } else if (active) {
      Object.assign(style, {
        background: tint,
        border: `1px solid ${lineStrong}`,
        color: textActive,
        cursor: 'pointer',
      });
    } else {
      Object.assign(style, {
        background: 'transparent',
        border: `1px solid ${line}`,
        color: textActive,
        cursor: 'pointer',
      });
    }

    return (
      <button
        type="button"
        key={key}
        disabled={zero}
        onClick={() => { if (!zero) onPulseFilter(active ? null : key); }}
        style={style}
        title={zero ? `${label}: 0` : active ? `${label}: ${count} — click to clear filter` : `${label}: ${count} — click to filter the board`}
      >
        <Icon style={{ width: 13, height: 13, strokeWidth: 1.5, flex: 'none' }} />
        {label}
        <span style={{ fontWeight: 700 }}>{count}</span>
      </button>
    );
  };

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      <style>{`.aurora-scroll::-webkit-scrollbar{display:none}`}</style>
      {renderChip('strike', 'STRIKE', Zap, 'claret', m.strike)}
      {renderChip('law14', 'LAW-14', Scale, 'claret', m.law14)}
      <span
        title="Probability-weighted commission"
        className="flex items-center gap-1.5 px-2.5 rounded-md shrink-0"
        style={{ height: 28, border: `1px solid ${PB.HAIR2}`, background: 'transparent' }}
      >
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', color: PB.SLATE }}>EXPECTED</span>
        <span style={{ ...champagneInk, fontSize: 11.5, fontWeight: 700 }}>
          AED {(m.expected / 1_000_000).toFixed(1)}M
        </span>
      </span>
      {renderChip('hot', 'HOT', Flame, 'gold', m.hot)}
    </div>
  );
}