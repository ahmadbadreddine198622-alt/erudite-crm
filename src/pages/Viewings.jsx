import React from 'react';
import EruditePage from '@/components/erudite/EruditePage';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeSection from '@/components/erudite/EruditeSection';
import EruditeStat from '@/components/erudite/EruditeStat';
import EruditeBadge from '@/components/erudite/EruditeBadge';
import EruditeButton from '@/components/erudite/EruditeButton';
import EruditeEmptyState from '@/components/erudite/EruditeEmptyState';
import { Eye, Calendar, Clock, TrendingUp } from 'lucide-react';

export default function Viewings() {
  return (
    <EruditePage
      title="Viewings"
      subtitle="Property viewing management and scheduling"
      actions={
        <EruditeButton icon={Eye}>Schedule Viewing</EruditeButton>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Today's Viewings" value="6" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="This Week" value="28" trend="up" trendValue="+12%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Show-to-Deal Rate" value="22%" trend="up" trendValue="+4%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Avg. Response Time" value="1.2h" trend="down" trendValue="-0.3h" />
          </div>
        </EruditeCard>
      </div>

      <EruditeSection title="Scheduled Viewings" subtitle="Upcoming" icon={Calendar}>
        <EruditeEmptyState
          icon={Eye}
          title="No viewings scheduled"
          description="Schedule your first property viewing to track appointments"
          action={<EruditeButton variant="primary">Schedule First Viewing</EruditeButton>}
        />
      </EruditeSection>

      <EruditeSection title="Performance" subtitle="Analytics" icon={TrendingUp}>
        <EruditeCard>
          <div className="p-6">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Viewing analytics and conversion tracking will appear here
            </p>
          </div>
        </EruditeCard>
      </EruditeSection>
    </EruditePage>
  );
}