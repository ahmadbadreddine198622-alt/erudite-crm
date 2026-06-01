import React from 'react';
import EruditePage from '@/components/erudite/EruditePage';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeSection from '@/components/erudite/EruditeSection';
import EruditeStat from '@/components/erudite/EruditeStat';
import EruditeBadge from '@/components/erudite/EruditeBadge';
import EruditeButton from '@/components/erudite/EruditeButton';
import EruditeEmptyState from '@/components/erudite/EruditeEmptyState';
import { FileBox, Mail, Clock, TrendingUp } from 'lucide-react';

export default function EmailTemplates() {
  return (
    <EruditePage
      title="Email Templates"
      subtitle="Pre-built email templates for common scenarios"
      actions={
        <EruditeButton icon={FileBox}>Create Template</EruditeButton>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Total Templates" value="24" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Used This Week" value="156" trend="up" trendValue="+23%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Avg. Open Rate" value="68%" trend="up" trendValue="+4%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Avg. Reply Rate" value="34%" trend="up" trendValue="+2%" />
          </div>
        </EruditeCard>
      </div>

      <EruditeSection title="Template Library" subtitle="Collection" icon={Mail}>
        <EruditeEmptyState
          icon={FileBox}
          title="No templates yet"
          description="Create your first email template to save time on common communications"
          action={<EruditeButton variant="primary">Create First Template</EruditeButton>}
        />
      </EruditeSection>

      <EruditeSection title="Performance" subtitle="Analytics" icon={TrendingUp}>
        <EruditeCard>
          <div className="p-6">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Template performance and engagement metrics will appear here
            </p>
          </div>
        </EruditeCard>
      </EruditeSection>
    </EruditePage>
  );
}