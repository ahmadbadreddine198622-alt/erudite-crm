import React, { useState } from 'react';
import EruditePage from '@/components/erudite/EruditePage';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeSection from '@/components/erudite/EruditeSection';
import EruditeStat from '@/components/erudite/EruditeStat';
import EruditeBadge from '@/components/erudite/EruditeBadge';
import EruditeButton from '@/components/erudite/EruditeButton';
import EruditeEmptyState from '@/components/erudite/EruditeEmptyState';
import EruditeTable from '@/components/erudite/EruditeTable';
import { UserSearch, Brain, TrendingUp, Target, Users, Sparkles } from 'lucide-react';

export default function BuyerMatchAI() {
  const stats = {
    activeMatches: 48,
    matchAccuracy: 87,
    matchToViewing: 34,
    avgScore: 78,
  };

  const tableColumns = [
    { header: 'Lead', accessor: 'lead_name' },
    { header: 'Matched Property', accessor: 'property_title' },
    { header: 'Match Score', accessor: (row) => `${row.score}%` },
    { header: 'Criteria Match', accessor: 'criteria' },
    { header: 'Status', accessor: 'status' },
  ];

  return (
    <EruditePage
      title="Buyer Match AI"
      subtitle="Intelligent lead-to-property matching"
      actions={
        <EruditeButton icon={Brain}>Run Matching</EruditeButton>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Active Matches" value={stats.activeMatches.toString()} />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Match Accuracy" value={`${stats.matchAccuracy}%`} trend="up" trendValue="+5%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Matches to Viewings" value={`${stats.matchToViewing}%`} trend="up" trendValue="+8%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Avg. Match Score" value={`${stats.avgScore}/100`} trend="up" trendValue="+4" />
          </div>
        </EruditeCard>
      </div>

      {/* Main Content */}
      <EruditeSection title="Lead-Property Matches" subtitle="Recommendations" icon={Target}>
        <EruditeEmptyState
          icon={UserSearch}
          title="No matches yet"
          description="Run AI matching to find optimal property recommendations for your leads"
          action={<EruditeButton variant="primary">Run First Match</EruditeButton>}
        />
      </EruditeSection>

      <EruditeSection title="Match Performance" subtitle="Analytics" icon={TrendingUp}>
        <EruditeCard>
          <div className="p-6">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Match quality and conversion analytics will appear here
            </p>
          </div>
        </EruditeCard>
      </EruditeSection>
    </EruditePage>
  );
}