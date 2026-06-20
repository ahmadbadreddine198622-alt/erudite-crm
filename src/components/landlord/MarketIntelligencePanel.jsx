export default function MarketIntelligencePanel({ landlordProperty }) {
  if (!landlordProperty?.ai_estimated_value_aed) return null;

  const lp = landlordProperty;
  const bars = ['high', 'medium', 'low'];
  const barColor = (level) => {
    if (lp.ai_valuation_confidence === 'high') return '#34d399';
    if (lp.ai_valuation_confidence === 'medium' && level !== 'high') return 'hsl(38 92% 55%)';
    if (lp.ai_valuation_confidence === 'low' && level === 'low') return 'rgba(255,255,255,0.4)';
    return 'rgba(255,255,255,0.12)';
  };
  const valueColor = lp.ai_valuation_confidence === 'high' ? '#34d399'
    : lp.ai_valuation_confidence === 'medium' ? 'hsl(38 92% 55%)'
    : 'rgba(255,255,255,0.5)';

  return (
    <div className="px-6 py-4" style={{
      background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(5,150,105,0.06) 100%)',
      borderBottom: '2px solid rgba(52,211,153,0.35)',
      borderTop: '1px solid rgba(52,211,153,0.15)',
    }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#34d399', letterSpacing: '0.1em' }}>
            Market Intelligence
          </span>
        </div>
        {lp.ai_valuation_updated_at && (
          <span className="text-[10px]" style={{ color: 'rgba(52,211,153,0.45)' }}>
            {lp.ai_valuation_updated_at}
          </span>
        )}
      </div>

      {/* Numbers */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="rounded-xl px-3 py-3 text-center" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(52,211,153,0.25)', boxShadow: '0 0 16px rgba(52,211,153,0.08)' }}>
          <p className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'rgba(52,211,153,0.55)' }}>Est. Value</p>
          <p className="text-2xl font-extrabold tabular-nums leading-none" style={{ color: '#34d399' }}>
            {(lp.ai_estimated_value_aed / 1e6).toFixed(2)}M
          </p>
          <p className="text-[9px] mt-0.5" style={{ color: 'rgba(52,211,153,0.45)' }}>AED</p>
        </div>
        <div className="rounded-xl px-3 py-3 text-center" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(52,211,153,0.25)', boxShadow: '0 0 16px rgba(52,211,153,0.08)' }}>
          <p className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'rgba(52,211,153,0.55)' }}>Price / sqft</p>
          <p className="text-2xl font-extrabold tabular-nums leading-none" style={{ color: '#34d399' }}>
            {lp.ai_estimated_price_sqft?.toLocaleString() ?? '—'}
          </p>
          <p className="text-[9px] mt-0.5" style={{ color: 'rgba(52,211,153,0.45)' }}>AED/sqft</p>
        </div>
        <div className="rounded-xl px-3 py-3 text-center" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(52,211,153,0.25)', boxShadow: '0 0 16px rgba(52,211,153,0.08)' }}>
          <p className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'rgba(52,211,153,0.55)' }}>Confidence</p>
          <p className="text-xl font-extrabold capitalize leading-none mt-1" style={{ color: valueColor }}>
            {lp.ai_valuation_confidence ?? '—'}
          </p>
          <div className="flex justify-center mt-1">
            {bars.map(level => (
              <div key={level} className="w-2 h-1.5 mx-0.5 rounded-sm" style={{ background: barColor(level) }} />
            ))}
          </div>
        </div>
      </div>

      {/* Basis — agent's call script */}
      {lp.ai_valuation_basis && (
        <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(52,211,153,0.15)' }}>
          <p className="text-[11px] leading-relaxed font-medium" style={{ color: 'rgba(52,211,153,0.8)' }}>
            {lp.ai_valuation_basis}
          </p>
        </div>
      )}
    </div>
  );
}