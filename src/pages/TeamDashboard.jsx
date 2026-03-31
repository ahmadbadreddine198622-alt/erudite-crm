import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import GoalSetterPanel from '@/components/teamDashboard/GoalSetterPanel';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Users, TrendingUp, Award, Target, Activity, DollarSign, AlertCircle, CheckCircle2
} from 'lucide-react';
import { formatAED } from '@/lib/constants';

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

const STAGE_LABELS = {
  new_lead: 'New Lead',
  contacted: 'Contacted',
  viewing_scheduled: 'Viewing Scheduled',
  viewing_done: 'Viewing Done',
  negotiation: 'Negotiation',
  offer_made: 'Offer Made',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

export default function TeamDashboard() {
  const [period, setPeriod] = useState('all');

  const { data: leads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Lead.list('-created_date', 1000),
  });

  const { data: activities = [], isLoading: loadingActivities } = useQuery({
    queryKey: ['activities'],
    queryFn: () => base44.entities.Activity.list('-created_date', 1000),
  });

  const { data: commissions = [], isLoading: loadingComm } = useQuery({
    queryKey: ['commissions'],
    queryFn: () => base44.entities.Commission.list('-created_date', 500),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const periodDays = { '7d': 7, '30d': 30, '90d': 90, 'all': null };

  const filteredLeads = useMemo(() => {
    const days = periodDays[period];
    if (!days) return leads;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return leads.filter(l => new Date(l.created_date) >= cutoff);
  }, [leads, period]);

  const filteredActivities = useMemo(() => {
    const days = periodDays[period];
    if (!days) return activities;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return activities.filter(a => new Date(a.created_date) >= cutoff);
  }, [activities, period]);

  const filteredCommissions = useMemo(() => {
    const days = periodDays[period];
    if (!days) return commissions;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return commissions.filter(c => new Date(c.created_date) >= cutoff);
  }, [commissions, period]);

  // Build per-agent stats from real lead/activity/commission data
  const agentStats = useMemo(() => {
    const stats = {};

    filteredLeads.forEach(l => {
      const key = l.assigned_agent || 'Unassigned';
      const name = l.assigned_agent_name || (l.assigned_agent ? l.assigned_agent.split('@')[0] : 'Unassigned');
      if (!stats[key]) stats[key] = { email: key, name, totalLeads: 0, closedWon: 0, closedLost: 0, activities: 0, revenue: 0 };
      stats[key].totalLeads++;
      if (l.stage === 'closed_won') stats[key].closedWon++;
      if (l.stage === 'closed_lost') stats[key].closedLost++;
    });

    filteredActivities.forEach(a => {
      const key = a.agent_email;
      if (!key || !stats[key]) return;
      stats[key].activities++;
    });

    filteredCommissions.forEach(c => {
      const key = c.agent_email;
      if (!key || !stats[key]) return;
      stats[key].revenue += c.commission_amount_aed || 0;
    });

    return Object.values(stats)
      .filter(s => s.email !== 'Unassigned' || s.totalLeads > 0)
      .map(s => ({
        ...s,
        conversionRate: s.totalLeads > 0 ? ((s.closedWon / s.totalLeads) * 100).toFixed(1) : '0.0',
      }))
      .sort((a, b) => parseFloat(b.conversionRate) - parseFloat(a.conversionRate));
  }, [filteredLeads, filteredActivities, filteredCommissions]);

  // Pipeline stage distribution
  const stageData = useMemo(() => {
    const counts = {};
    filteredLeads.forEach(l => {
      counts[l.stage] = (counts[l.stage] || 0) + 1;
    });
    return Object.entries(counts).map(([stage, count]) => ({
      name: STAGE_LABELS[stage] || stage,
      value: count,
    }));
  }, [filteredLeads]);

  // Activity breakdown by type
  const activityTypeData = useMemo(() => {
    const counts = {};
    filteredActivities.forEach(a => {
      counts[a.type] = (counts[a.type] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ name: type, count }));
  }, [filteredActivities]);

  // Lead source breakdown
  const sourceData = useMemo(() => {
    const counts = {};
    filteredLeads.forEach(l => {
      if (l.source) counts[l.source] = (counts[l.source] || 0) + 1;
    });
    return Object.entries(counts).map(([source, value]) => ({ name: source.replace(/_/g, ' '), value }));
  }, [filteredLeads]);

  const totalRevenue = filteredCommissions.reduce((s, c) => s + (c.commission_amount_aed || 0), 0);
  const totalClosed = filteredLeads.filter(l => l.stage === 'closed_won').length;
  const overallConv = filteredLeads.length > 0 ? ((totalClosed / filteredLeads.length) * 100).toFixed(1) : '0.0';
  const totalActivities = filteredActivities.length;

  const isLoading = loadingLeads || loadingActivities || loadingComm;

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Performance Dashboard</h1>
          <p className="text-sm text-muted-foreground">Real-time agent analytics · Lead pipeline · Revenue tracking</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredLeads.length}</div>
                <p className="text-xs text-muted-foreground">{agentStats.filter(a => a.email !== 'Unassigned').length} agents active</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                <Target className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-accent">{overallConv}%</div>
                <p className="text-xs text-muted-foreground">{totalClosed} deals closed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
                <Activity className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalActivities}</div>
                <p className="text-xs text-muted-foreground">calls, viewings, notes</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Commission Revenue</CardTitle>
                <DollarSign className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">{formatAED(totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">{filteredCommissions.length} commissions</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pipeline Stage Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Pipeline Stage Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {stageData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={stageData} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground text-sm py-12">No lead data</p>
                )}
              </CardContent>
            </Card>

            {/* Lead Sources */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Lead Sources</CardTitle>
              </CardHeader>
              <CardContent>
                {sourceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground text-sm py-12">No source data</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Agent Leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Agent Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              {agentStats.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-12">No agent data found. Assign leads to agents to see performance.</p>
              ) : (
                <div className="space-y-3">
                  {agentStats.map((agent, i) => {
                    const isTop = i === 0;
                    const conv = parseFloat(agent.conversionRate);
                    return (
                      <div key={agent.email} className={`p-4 rounded-xl border flex flex-wrap gap-4 items-center justify-between ${isTop ? 'border-amber-500/30 bg-amber-500/5' : 'border-border'}`}>
                        <div className="flex items-center gap-3">
                          <span className={`text-lg font-bold w-6 text-center ${isTop ? 'text-amber-500' : 'text-muted-foreground'}`}>#{i + 1}</span>
                          {isTop && <Award className="w-4 h-4 text-amber-500" />}
                          <div>
                            <p className="font-semibold text-sm">{agent.name}</p>
                            <p className="text-xs text-muted-foreground">{agent.email}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-6">
                          <div className="text-center">
                            <p className="text-lg font-bold">{agent.totalLeads}</p>
                            <p className="text-[10px] text-muted-foreground">Leads</p>
                          </div>
                          <div className="text-center">
                            <p className={`text-lg font-bold ${conv >= 30 ? 'text-emerald-600' : conv >= 15 ? 'text-amber-600' : 'text-red-500'}`}>
                              {agent.conversionRate}%
                            </p>
                            <p className="text-[10px] text-muted-foreground">Conversion</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-emerald-600">{agent.closedWon}</p>
                            <p className="text-[10px] text-muted-foreground">Closed Won</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold">{agent.activities}</p>
                            <p className="text-[10px] text-muted-foreground">Activities</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-accent">{formatAED(agent.revenue)}</p>
                            <p className="text-[10px] text-muted-foreground">Commission</p>
                          </div>
                        </div>

                        <Badge variant={conv >= 20 ? 'default' : 'outline'} className={conv >= 20 ? 'bg-emerald-500/10 text-emerald-700' : ''}>
                          {conv >= 30 ? '🔥 Top Performer' : conv >= 15 ? '✓ On Track' : '⚠ Needs Support'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Goal Setter (admin only) */}
          <GoalSetterPanel />

          {/* Activity Breakdown */}
          {activityTypeData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Activity Breakdown by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={activityTypeData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}