import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function MarketIntelligencePanel({ landlordProperty, unitReference, projectName }) {
  const lp = landlordProperty;

  // Find the most recent transaction for this exact unit
  const { data: exactUnitSale } = useQuery({
    queryKey: ['market-tx-unit', projectName, unitReference],
    queryFn: async () => {
      if (!projectName || !unitReference) return null;
      const txs = await base44.entities.MarketTransaction.filter({ project_name: projectName });
      if (!txs?.length) return null;
      // Match unit number case-insensitively, strip leading zeros for comparison
      const norm = (s) => String(s || '').toLowerCase().replace(/^0+/, '').trim();
      const unitNorm = norm(unitReference);
      const matches = txs.filter(t => norm(t.unit_number) === unitNorm && !t.is_outlier);
      if (!matches.length) return null;
      // Return most recent
      return matches.sort((a, b) => (b.transaction_date || '').localeCompare(a.transaction_date || ''))[0];
    },
    enabled: !!projectName && !!unitReference,
    staleTime: 5 * 60 * 1000,
  });
  if (!lp?.ai_estimated_value_aed) return null;

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

      {/* Exact-unit last sale — highlighted anchor for the call */}
      {exactUnitSale && (
        <div className="mb-3 rounded-lg px-3 py-2.5 flex items-center gap-3 flex-wrap" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)', boxShadow: '0 0 12px rgba(52,211,153,0.06)' }}>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(52,211,153,0.6)' }}>
              Unit {unitReference} last sold
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-extrabold tabular-nums" style={{ color: '#34d399' }}>
              AED {(exactUnitSale.price_aed / 1e6).toFixed(2)}M
            </span>
            {exactUnitSale.price_per_sqft && (
              <span className="text-xs font-semibold tabular-nums" style={{ color: 'rgba(52,211,153,0.75)' }}>
                {exactUnitSale.price_per_sqft.toLocaleString()} /sqft
              </span>
            )}
            {exactUnitSale.area_sqft && (
              <span className="text-xs" style={{ color: 'rgba(52,211,153,0.5)' }}>
                {Math.round(exactUnitSale.area_sqft).toLocaleString()} sqft
              </span>
            )}
            {exactUnitSale.transaction_date && (
              <span className="text-[10px]" style={{ color: 'rgba(52,211,153,0.45)' }}>
                {new Date(exactUnitSale.transaction_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
              </span>
            )}
            {exactUnitSale.sale_status && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: exactUnitSale.sale_status === 'ready' ? 'rgba(52,211,153,0.15)' : 'rgba(250,180,40,0.15)', color: exactUnitSale.sale_status === 'ready' ? '#34d399' : 'hsl(38 92% 60%)' }}>
                {exactUnitSale.sale_status}
              </span>
            )}
          </div>
        </div>
      )}

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