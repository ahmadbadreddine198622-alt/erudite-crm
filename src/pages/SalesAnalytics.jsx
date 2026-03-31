import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import SalesCycleDurationChart from '@/components/analytics/SalesCycleDurationChart';
import RevenueVsTargetChart from '@/components/analytics/RevenueVsTargetChart';
import ConversionRateChart from '@/components/analytics/ConversionRateChart';
import { Card } from '@/components/ui/card';

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

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Sales Analytics"
        subtitle="Track cycle time, revenue, and conversion metrics"
      />

      <div className="grid grid-cols-1 gap-6">
        {/* Sales Cycle Duration */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Average Sales Cycle by Agent</h2>
          <SalesCycleDurationChart data={salesCycleData} />
        </Card>

        {/* Revenue vs Target */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Monthly Revenue vs Target</h2>
          <RevenueVsTargetChart data={revenueData} />
        </Card>

        {/* Conversion Rate */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Lead-to-Deal Conversion by Source</h2>
          <ConversionRateChart data={conversionData} />
        </Card>
      </div>
    </div>
  );
}