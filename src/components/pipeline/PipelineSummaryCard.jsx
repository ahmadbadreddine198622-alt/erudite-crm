// Summary card for the Pipeline board — conversion rate + total potential revenue
// for the leads currently shown in the active track (Sale/Rent/Intake/WhatsApp).
import React, { useMemo } from 'react';
import { Percent, DollarSign } from 'lucide-react';

const fmtAED = (n) => {
  if (!n) return 'AED 0';
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`;
  return `AED ${Math.round(n)}`;
};

export default function PipelineSummaryCard({ leads, stages }) {
  const { conversionRate, wonCount, totalCount, potentialRevenue } = useMemo(() => {
    const total = leads.length;
    // "Won" = leads that have reached the final stage of this track.
    const finalStageKey = stages.length ? stages[stages.length - 1].key : null;
    const won = leads.filter((l) => l.stage === finalStageKey).length;
    const revenue = leads.reduce((sum, l) => sum + (l.deal_value_aed || 0), 0);
    return {
      conversionRate: total > 0 ? (won / total) * 100 : 0,
      wonCount: won,
      totalCount: total,
      potentialRevenue: revenue,
    };
  }, [leads, stages]);

  return (
    <div className="grid grid-cols-2 gap-3 mb-3">
      <div
        className="rounded-xl p-3 flex items-center gap-3"
        style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.10)' }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-none" style={{ background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <Percent className="w-4 h-4" style={{ color: '#34d399' }} />
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Conversion Rate</span>
          <p className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>
            {conversionRate.toFixed(1)}%
            <span className="text-[11px] font-medium ml-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>({wonCount}/{totalCount})</span>
          </p>
        </div>
      </div>
      <div
        className="rounded-xl p-3 flex items-center gap-3"
        style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.10)' }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-none" style={{ background: 'hsl(38 92% 50% / 0.14)', border: '1px solid hsl(38 92% 50% / 0.3)' }}>
          <DollarSign className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Total Potential Revenue</span>
          <p className="text-xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>{fmtAED(potentialRevenue)}</p>
        </div>
      </div>
    </div>
  );
}