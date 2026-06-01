import React from 'react';
import EruditePage from '@/components/erudite/EruditePage';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeSection from '@/components/erudite/EruditeSection';
import EruditeStat from '@/components/erudite/EruditeStat';
import EruditeBadge from '@/components/erudite/EruditeBadge';
import EruditeButton from '@/components/erudite/EruditeButton';
import EruditeEmptyState from '@/components/erudite/EruditeEmptyState';
import { Building, TrendingUp, MapPin, DollarSign } from 'lucide-react';

export default function PropertyIntel() {
  return (
    <EruditePage
      title="Property Intel"
      subtitle="Research and discovery engine"
      actions={
        <EruditeButton icon={Building}>New Search</EruditeButton>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Properties Tracked" value="1,248" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Price Changes" value="34" trend="up" trendValue="+12%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="New Listings" value="156" trend="up" trendValue="+8%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Avg. Price/Sqft" value="AED 1,850" trend="up" trendValue="+2%" />
          </div>
        </EruditeCard>
      </div>

      <EruditeSection title="Property Search" subtitle="Discovery" icon={MapPin}>
        <EruditeEmptyState
          icon={Building}
          title="No saved searches"
          description="Create property searches to track market opportunities"
          action={<EruditeButton variant="primary">Create First Search</EruditeButton>}
        />
      </EruditeSection>

      <EruditeSection title="Market Trends" subtitle="Analytics" icon={TrendingUp}>
        <EruditeCard>
          <div className="p-6">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Property market trends and pricing analytics will appear here
            </p>
          </div>
        </EruditeCard>
      </EruditeSection>
    </EruditePage>
  );
}