import React, { useState } from 'react';
import EruditePage from '@/components/erudite/EruditePage';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeSection from '@/components/erudite/EruditeSection';
import EruditeStat from '@/components/erudite/EruditeStat';
import EruditeBadge from '@/components/erudite/EruditeBadge';
import EruditeButton from '@/components/erudite/EruditeButton';
import EruditeEmptyState from '@/components/erudite/EruditeEmptyState';
import EruditeTable from '@/components/erudite/EruditeTable';
import { Megaphone, Plus, Mail, TrendingUp, Users, BarChart3 } from 'lucide-react';

export default function Broadcasts() {
  const stats = {
    total: 24,
    sentThisMonth: 8456,
    avgOpenRate: 72,
    avgCtr: 24,
  };

  const tableColumns = [
    { header: 'Campaign Name', accessor: 'name' },
    { header: 'Type', accessor: 'type' },
    { header: 'Sent Date', accessor: 'sent_date' },
    { header: 'Recipients', accessor: (row) => row.recipients?.toLocaleString() },
    { header: 'Open Rate', accessor: (row) => `${row.open_rate}%` },
    { header: 'CTR', accessor: (row) => `${row.ctr}%` },
  ];

  return (
    <EruditePage
      title="Broadcasts"
      subtitle="Bulk messaging and campaign management"
      actions={
        <EruditeButton icon={Plus}>New Campaign</EruditeButton>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Total Campaigns" value={stats.total.toString()} />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Sent This Month" value={stats.sentThisMonth.toLocaleString()} trend="up" trendValue="+18%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Avg. Open Rate" value={`${stats.avgOpenRate}%`} trend="up" trendValue="+5%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Avg. CTR" value={`${stats.avgCtr}%`} trend="up" trendValue="+3%" />
          </div>
        </EruditeCard>
      </div>

      {/* Main Content */}
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