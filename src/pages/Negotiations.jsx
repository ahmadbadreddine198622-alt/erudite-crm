import React from 'react';
import EruditePage from '@/components/erudite/EruditePage';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeSection from '@/components/erudite/EruditeSection';
import EruditeStat from '@/components/erudite/EruditeStat';
import EruditeBadge from '@/components/erudite/EruditeBadge';
import EruditeButton from '@/components/erudite/EruditeButton';
import EruditeEmptyState from '@/components/erudite/EruditeEmptyState';
import { Handshake, TrendingUp, DollarSign, Clock } from 'lucide-react';

export default function Negotiations() {
  return (
    <EruditePage
      title="Negotiations"
      subtitle="Offer and counteroffer orchestration engine"
      actions={
        <EruditeButton icon={Handshake}>New Offer</EruditeButton>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Active Negotiations" value="8" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Avg. Deal Value" value="AED 2.4M" trend="up" trendValue="+12%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Win Rate" value="68%" trend="up" trendValue="+5%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Avg. Time to Close" value="14 days" trend="down" trendValue="-2 days" />
          </div>
        </EruditeCard>
      </div>

      <EruditeSection title="Active Deals" subtitle="In Progress" icon={Handshake}>
        <EruditeEmptyState
          icon={Handshake}
          title="No active negotiations"
          description="Start your first offer to begin tracking deal negotiations"
          action={<EruditeButton variant="primary">Create First Offer</EruditeButton>}
        />
      </EruditeSection>

      <EruditeSection title="Performance" subtitle="Analytics" icon={TrendingUp}>
        <EruditeCard>
          <div className="p-6">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Negotiation analytics and deal timeline will appear here
            </p>
          </div>
        </EruditeCard>
      </EruditeSection>
    </EruditePage>
  );
}