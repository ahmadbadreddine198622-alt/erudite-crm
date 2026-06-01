import React, { useState } from 'react';
import EruditePage from '@/components/erudite/EruditePage';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeSection from '@/components/erudite/EruditeSection';
import EruditeStat from '@/components/erudite/EruditeStat';
import EruditeBadge from '@/components/erudite/EruditeBadge';
import EruditeButton from '@/components/erudite/EruditeButton';
import EruditeEmptyState from '@/components/erudite/EruditeEmptyState';
import EruditeTable from '@/components/erudite/EruditeTable';
import { CheckCircle, TrendingUp, Clock, DollarSign, Brain, Target } from 'lucide-react';

export default function ClosingAI() {
  const stats = {
    dealsInClosing: 14,
    closeRate: 76,
    avgTimeToClose: 18,
    totalValueClosed: 89000000,
  };

  const tableColumns = [
    { header: 'Deal', accessor: 'deal_name' },
    { header: 'Lead', accessor: 'lead_name' },
    { header: 'Value', accessor: (row) => `AED ${row.value?.toLocaleString()}` },
    { header: 'Stage', accessor: 'stage' },
    { header: 'AI Recommendation', accessor: 'recommendation' },
    { header: 'Confidence', accessor: (row) => `${row.confidence}%` },
  ];

  return (
    <EruditePage
      title="Closing AI"
      subtitle="Deal-closing assistant and guidance"
      actions={
        <EruditeButton icon={Brain}>New Deal Review</EruditeButton>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Deals in Closing" value={stats.dealsInClosing.toString()} />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Close Rate" value={`${stats.closeRate}%`} trend="up" trendValue="+8%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Avg. Time to Close" value={`${stats.avgTimeToClose} days`} trend="down" trendValue="-3 days" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Total Value Closed" value={`AED ${(stats.totalValueClosed / 1000000).toFixed(1)}M`} trend="up" trendValue="+15%" />
          </div>
        </EruditeCard>
      </div>

      {/* Main Content */}
      <EruditeSection title="Active Closings" subtitle="Pipeline" icon={Clock}>
        <EruditeEmptyState
          icon={CheckCircle}
          title="No deals in closing"
          description="AI will guide you through the closing process once deals reach this stage"
          action={<EruditeButton variant="primary">Review Deals</EruditeButton>}
        />
      </EruditeSection>

      <EruditeSection title="Closing Performance" subtitle="Analytics" icon={TrendingUp}>
        <EruditeCard>
          <div className="p-6">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Deal closing analytics and AI recommendations will appear here
            </p>
          </div>
        </EruditeCard>
      </EruditeSection>
    </EruditePage>
  );
}