import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import SalesCycleDurationChart from '@/components/analytics/SalesCycleDurationChart';
import RevenueVsTargetChart from '@/components/analytics/RevenueVsTargetChart';
import ConversionRateChart from '@/components/analytics/ConversionRateChart';
import { TrendingUp, Target, BarChart3, DollarSign } from 'lucide-react';

export default function SalesAnalytics() {
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Fetch all leads
  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list()
  });

  // Fetch all commissions
  const { data: commissions = [] } = useQuery({
    queryKey: ['commissions'],
    queryFn: () => base44.entities.Commission.list()
  });

  // Fetch all users for agent names
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list()
  });

  // Fetch agent goals
  const { data: goals = [] } = useQuery({
    queryKey: ['agentGoals'],
    queryFn: () => base44.entities.AgentGoal.filter({ month: currentMonth })
  });

  // Calculate sales cycle duration by agent
  const salesCycleData = useMemo(() => {
    const closedDeals = leads.filter(l => l.stage === 'closed_won');
    const agentCycles = {};

    closedDeals.forEach(deal => {
      const agent = deal.assigned_agent || 'Unassigned';
      const createdDate = new Date(deal.created_date);
      const closedDate = new Date(deal.updated_date);
      const daysToClose = Math.floor((closedDate - createdDate) / (1000 * 60 * 60 * 24));

      if (!agentCycles[agent]) {
        agentCycles[agent] = { deals: [], totalDays: 0 };
      }
      agentCycles[agent].deals.push(daysToClose);
      agentCycles[agent].totalDays += daysToClose;
    });

    return Object.entries(agentCycles).map(([agent, data]) => ({
      agent: agent.split('@')[0] || 'Unassigned',
      avgDays: Math.round(data.totalDays / data.deals.length),
      deals: data.deals.length
    }));
  }, [leads]);

  // Calculate monthly revenue vs target
  const revenueData = useMemo(() => {
    const monthCommissions = commissions.filter(c => {
      const commissionMonth = new Date(c.closing_date || c.created_date).toISOString().slice(0, 7);
      return commissionMonth === currentMonth && c.status !== 'cancelled';
    });

    const totalRevenue = monthCommissions.reduce((sum, c) => sum + (c.commission_amount_aed || 0), 0);

    const agentGoals = goals.reduce((acc, goal) => {
      acc[goal.agent_email] = goal.target_revenue_aed || 0;
      return acc;
    }, {});

    const revenueByAgent = {};
    monthCommissions.forEach(c => {
      const agent = c.agent_email || 'Unassigned';
      revenueByAgent[agent] = (revenueByAgent[agent] || 0) + (c.commission_amount_aed || 0);
    });

    return {
      total: totalRevenue,
      byAgent: Object.entries(revenueByAgent).map(([agent, revenue]) => ({
        agent: agent.split('@')[0] || 'Unassigned',
        actual: revenue,
        target: agentGoals[agent] || 0
      }))
    };
  }, [commissions, goals]);

  // Calculate conversion rate by source
  const conversionData = useMemo(() => {
    const sourceMetrics = {};

    leads.forEach(lead => {
      const source = lead.source || 'other';
      if (!sourceMetrics[source]) {
        sourceMetrics[source] = { total: 0, closed: 0 };
      }
      sourceMetrics[source].total++;
      if (lead.stage === 'closed_won') {
        sourceMetrics[source].closed++;
      }
    });

    return Object.entries(sourceMetrics).map(([source, data]) => ({
      source: source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      total: data.total,
      closed: data.closed,
      rate: data.total > 0 ? Math.round((data.closed / data.total) * 100) : 0
    })).sort((a, b) => b.total - a.total);
  }, [leads]);
  
  // Summary metrics
  const totalClosed = leads.filter(l => l.stage === 'closed_won').length;
  const overallRate = leads.length > 0 ? Math.round((totalClosed / leads.length) * 100) : 0;
  const totalRevenue = commissions.filter(c => c.status !== 'cancelled').reduce((s, c) => s + (c.commission_amount_aed || 0), 0);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Sales Analytics"
        subtitle="Performance intelligence and revenue tracking"
      />

      {/* Management Intelligence Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div
          className="rounded-xl p-4"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Total Closed</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>{totalClosed}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Deals won</p>
        </div>
        
        <div
          className="rounded-xl p-4"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Conversion</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{overallRate}%</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Lead to deal</p>
        </div>
        
        <div
          className="rounded-xl p-4"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Revenue</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{revenueData.total >= 1_000_000 ? `AED ${(revenueData.total / 1_000_000).toFixed(1)}M` : revenueData.total >= 1_000 ? `AED ${(revenueData.total / 1_000).toFixed(0)}K` : 'AED 0'}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>This month</p>
        </div>
        
        <div
          className="rounded-xl p-4"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Agents</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{salesCycleData.length}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Active sellers</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Sales Cycle Duration */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <h2 className="text-base font-semibold mb-4" style={{ color: 'hsl(38 92% 50%)' }}>Average Sales Cycle by Agent</h2>
          <SalesCycleDurationChart data={salesCycleData} />
        </div>

        {/* Revenue vs Target */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <h2 className="text-base font-semibold mb-4" style={{ color: 'hsl(38 92% 50%)' }}>Monthly Revenue vs Target</h2>
          <RevenueVsTargetChart data={revenueData} />
        </div>

        {/* Conversion Rate */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <h2 className="text-base font-semibold mb-4" style={{ color: 'hsl(38 92% 50%)' }}>Lead-to-Deal Conversion by Source</h2>
          <ConversionRateChart data={conversionData} />
        </div>
      </div>
    </div>
  );
}