import React, { useState } from 'react';
import EruditePage from '@/components/erudite/EruditePage';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeSection from '@/components/erudite/EruditeSection';
import EruditeStat from '@/components/erudite/EruditeStat';
import EruditeBadge from '@/components/erudite/EruditeBadge';
import EruditeButton from '@/components/erudite/EruditeButton';
import EruditeEmptyState from '@/components/erudite/EruditeEmptyState';
import EruditeTable from '@/components/erudite/EruditeTable';
import { Building, Search, TrendingUp, MapPin, DollarSign, Home } from 'lucide-react';

export default function PropertyIntel() {
  const stats = {
    tracked: 1248,
    priceChanges: 34,
    newListings: 156,
    avgPriceSqft: 1850,
  };

  const tableColumns = [
    { header: 'Property', accessor: 'title' },
    { header: 'Location', accessor: 'location' },
    { header: 'Type', accessor: 'type' },
    { header: 'Price', accessor: (row) => `AED ${row.price?.toLocaleString()}` },
    { header: 'Price/Sqft', accessor: (row) => `AED ${row.price_sqft?.toLocaleString()}` },
    { header: 'Change', accessor: (row) => row.change },
  ];

  return (
    <EruditePage
      title="Property Intel"
      subtitle="Research and discovery engine"
      actions={
        <EruditeButton icon={Search}>New Search</EruditeButton>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Properties Tracked" value={stats.tracked.toLocaleString()} />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Price Changes" value={stats.priceChanges.toString()} trend="up" trendValue="+12%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="New Listings" value={stats.newListings.toString()} trend="up" trendValue="+8%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Avg. Price/Sqft" value={`AED ${stats.avgPriceSqft.toLocaleString()}`} trend="up" trendValue="+2%" />
          </div>
        </EruditeCard>
      </div>

      {/* Main Content */}
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