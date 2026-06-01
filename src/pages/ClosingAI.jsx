import React from 'react';
import EruditePage from '@/components/erudite/EruditePage';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeSection from '@/components/erudite/EruditeSection';
import EruditeStat from '@/components/erudite/EruditeStat';
import EruditeBadge from '@/components/erudite/EruditeBadge';
import EruditeButton from '@/components/erudite/EruditeButton';
import EruditeEmptyState from '@/components/erudite/EruditeEmptyState';
import { CheckCircle, TrendingUp, Clock, DollarSign } from 'lucide-react';

export default function ClosingAI() {
  return (
    <EruditePage
      title="Closing AI"
      subtitle="Deal-closing assistant and guidance"
      actions={
        <EruditeButton icon={CheckCircle}>New Deal Review</EruditeButton>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Deals in Closing" value="14" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Close Rate" value="76%" trend="up" trendValue="+8%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Avg. Time to Close" value="18 days" trend="down" trendValue="-3 days" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Total Value Closed" value="AED 89M" trend="up" trendValue="+15%" />
          </div>
        </EruditeCard>
      </div>

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