import React from 'react';
import EruditePage from '@/components/erudite/EruditePage';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeSection from '@/components/erudite/EruditeSection';
import EruditeStat from '@/components/erudite/EruditeStat';
import EruditeBadge from '@/components/erudite/EruditeBadge';
import EruditeButton from '@/components/erudite/EruditeButton';
import EruditeEmptyState from '@/components/erudite/EruditeEmptyState';
import { Megaphone, Mail, TrendingUp, Users } from 'lucide-react';

export default function Broadcasts() {
  return (
    <EruditePage
      title="Broadcasts"
      subtitle="Bulk messaging and campaign management"
      actions={
        <EruditeButton icon={Megaphone}>New Campaign</EruditeButton>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Total Campaigns" value="24" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Sent This Month" value="8,456" trend="up" trendValue="+18%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Avg. Open Rate" value="72%" trend="up" trendValue="+5%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Avg. CTR" value="24%" trend="up" trendValue="+3%" />
          </div>
        </EruditeCard>
      </div>

      <EruditeSection title="Campaign Library" subtitle="Broadcasts" icon={Mail}>
        <EruditeEmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create your first broadcast campaign to engage your audience"
          action={<EruditeButton variant="primary">Create Campaign</EruditeButton>}
        />
      </EruditeSection>

      <EruditeSection title="Audience Reach" subtitle="Analytics" icon={Users}>
        <EruditeCard>
          <div className="p-6">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Campaign reach and engagement analytics will appear here
            </p>
          </div>
        </EruditeCard>
      </EruditeSection>
    </EruditePage>
  );
}