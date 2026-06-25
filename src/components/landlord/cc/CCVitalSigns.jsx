// Vital Signs strip — 4 scores (with rationale tooltips), momentum, strike-now,
// est. commission, days in stage. Read-only.
import React from 'react';
import { Zap } from 'lucide-react';
import { GOLD, CARD_BG, scoreColor, fmtAEDFull } from './ccPrimitives';

function ScoreGauge({ label, value, suffix = '', rationale }) {
  const has = value != null && !isNaN(value);
  const pct = has ? Math.max(0, Math.min(100, value)) : 0;
  const col = scoreColor(has ? value : null);
  return (
    <div title={rationale || ''} style={{ flex: '1 1 130px', minWidth: 130, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px', cursor: rationale ? 'help' : 'default' }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: col, lineHeight: 1 }}>{has ? Math.round(value) : '—'}</span>
        {has && suffix && <span style={{ fontSize: 12, color: col, fontWeight: 600 }}>{suffix}</span>}
      </div>
      <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginTop: 7 }}>
        <div style={{ height: '100%', width: pct + '%', background: col, borderRadius: 99 }} />
      </div>
    </div>
  );
}

const MOMENTUM_META = (m) => {
  const v = String(m || '').toLowerCase();
  if (/(hot|strong|build|rising|accel)/.test(v)) return { color: '#34d399', bg: 'rgba(16,185,129,0.14)' };
  if (/(stall|cold|decay|dead|flat)/.test(v)) return { color: 'rgba(255,255,255,0.55)', bg: 'rgba(148,163,184,0.12)' };
  return { color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' };
};

export default function CCVitalSigns({ vm }) {
  const mm = MOMENTUM_META(vm.momentum);
  return (
    <div style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '12px 14px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'stretch' }}>
      <ScoreGauge label="Trust" value={vm.trustScore} rationale={vm.trustRationale} />
      <ScoreGauge label="Responsiveness" value={vm.responsivenessScore} rationale={vm.responsivenessRationale} />
      <ScoreGauge label="Urgency" value={vm.urgencyScore} rationale={vm.urgencyRationale} />
      <ScoreGauge label="Win Probability" value={vm.winProbPct} suffix="%" rationale={vm.winRationale} />

      {/* Status capsule */}
      <div style={{ flex: '1 1 200px', minWidth: 180, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, padding: '4px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Momentum</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99, color: mm.color, background: mm.bg }}>{vm.momentum ? vm.momentum : 'Unknown'}</span>
          <span title={vm.strikeNow ? 'Strike now — act immediately' : 'Strike inactive'} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: vm.strikeNow ? GOLD : 'rgba(255,255,255,0.3)' }}>
            <Zap className="w-3.5 h-3.5" style={{ fill: vm.strikeNow ? GOLD : 'none' }} /> {vm.strikeNow ? 'Strike' : 'No strike'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Est. commission</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: GOLD, marginTop: 2 }}>{vm.estCommission != null ? fmtAEDFull(vm.estCommission) : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Days in stage</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginTop: 2 }}>{vm.daysInStage != null ? `${Math.round(vm.daysInStage)}d` : '—'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}