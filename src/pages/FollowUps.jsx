import React from 'react';
import EruditePage from '@/components/erudite/EruditePage';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeSection from '@/components/erudite/EruditeSection';
import EruditeStat from '@/components/erudite/EruditeStat';
import EruditeBadge from '@/components/erudite/EruditeBadge';
import EruditeButton from '@/components/erudite/EruditeButton';
import EruditeEmptyState from '@/components/erudite/EruditeEmptyState';
import { Repeat, Clock, CheckCircle, TrendingUp } from 'lucide-react';

export default function FollowUps() {
  return (
    <EruditePage
      title="Follow Ups"
      subtitle="Activity-driven follow-up engine"
      actions={
        <EruditeButton icon={Repeat}>Schedule Follow Up</EruditeButton>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Pending Follow Ups" value="24" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Completed Today" value="18" trend="up" trendValue="+8" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Avg. Response Time" value="2.4h" trend="down" trendValue="-0.5h" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Conversion Rate" value="42%" trend="up" trendValue="+6%" />
          </div>
        </EruditeCard>
      </div>

      <EruditeSection title="Follow Ups" subtitle="Pending & Scheduled" icon={Clock}>
        <EruditeEmptyState
          icon={Repeat}
          title="No follow ups scheduled"
          description="Schedule your first follow up to stay on top of lead conversations"
          action={<EruditeButton variant="primary">Schedule First Follow Up</EruditeButton>}
        />
      </EruditeSection>

      <EruditeSection title="Performance" subtitle="Tracking" icon={TrendingUp}>
        <EruditeCard>
          <div className="p-6">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Follow-up performance metrics and trends will appear here
            </p>
          </div>
        </EruditeCard>
      </EruditeSection>
    </EruditePage>
  );
}