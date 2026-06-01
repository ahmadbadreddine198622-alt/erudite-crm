import React from 'react';
import EruditePage from '@/components/erudite/EruditePage';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeSection from '@/components/erudite/EruditeSection';
import EruditeStat from '@/components/erudite/EruditeStat';
import EruditeBadge from '@/components/erudite/EruditeBadge';
import EruditeButton from '@/components/erudite/EruditeButton';
import EruditeEmptyState from '@/components/erudite/EruditeEmptyState';
import { LineChart, TrendingUp, MapPin, DollarSign } from 'lucide-react';

export default function MarketIntelligence() {
  return (
    <EruditePage
      title="Market Intelligence"
      subtitle="Dubai real estate analytics and insights"
      actions={
        <EruditeButton icon={LineChart}>New Report</EruditeButton>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Market Index" value="142.8" trend="up" trendValue="+3.2%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Avg. ROI" value="6.8%" trend="up" trendValue="+0.4%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Total Transactions" value="2,847" trend="up" trendValue="+12%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Price Growth (YoY)" value="8.4%" trend="up" trendValue="+1.2%" />
          </div>
        </EruditeCard>
      </div>

      <EruditeSection title="Market Reports" subtitle="Analytics" icon={LineChart}>
        <EruditeEmptyState
          icon={LineChart}
          title="No reports generated"
          description="Generate your first market intelligence report"
          action={<EruditeButton variant="primary">Generate Report</EruditeButton>}
        />
      </EruditeSection>

      <EruditeSection title="Area Performance" subtitle="Comparison" icon={MapPin}>
        <EruditeCard>
          <div className="p-6">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Community-level market performance and comparisons will appear here
            </p>
          </div>
        </EruditeCard>
      </EruditeSection>
    </EruditePage>
  );
}