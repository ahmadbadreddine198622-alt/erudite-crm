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
  Users, TrendingUp, Award, Target, Activity, DollarSign, AlertCircle, CheckCircle2, Trophy, BarChart3, TrendingDown
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
  const avgRevenuePerAgent = agentStats.length > 0 ? totalRevenue / agentStats.length : 0;
  const topPerformer = agentStats[0];

  const isLoading = loadingLeads || loadingActivities || loadingComm;

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>Team Performance Dashboard</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>Real-time agent intelligence · Pipeline analytics · Revenue tracking</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.95)' }}>
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
          <div className="w-8 h-8 border-2" style={{ borderColor: 'rgba(245,159,10,0.3)', borderTopColor: 'hsl(38 92% 50%)', borderRadius: '50%' }} />
        </div>
      ) : (
        <>
          {/* Management Intelligence Strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div
              className="rounded-xl p-4"
              style={{
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Total Leads</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>{filteredLeads.length}</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{agentStats.length} agents</p>
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
              <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{overallConv}%</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{totalClosed} closed</p>
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
              <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{formatAED(totalRevenue)}</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{filteredCommissions.length} deals</p>
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
                <Activity className="w-4 h-4 text-amber-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Activities</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{totalActivities}</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Total actions</p>
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
                <Trophy className="w-4 h-4 text-amber-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Top Agent</span>
              </div>
              <p className="text-lg font-bold truncate" style={{ color: 'hsl(38 92% 50%)' }}>{topPerformer?.name || 'N/A'}</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{topPerformer?.conversionRate}% conv.</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pipeline Stage Distribution */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'hsl(38 92% 50%)' }}>Pipeline Stage Distribution</h3>
              {stageData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stageData} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} width={110} />
                    <Tooltip 
                      contentStyle={{
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: 'rgba(255,255,255,0.95)',
                      }}
                    />
                    <Bar dataKey="value" fill="hsl(38 92% 50%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-sm py-12" style={{ color: 'rgba(255,255,255,0.4)' }}>No pipeline data</p>
              )}
            </div>

            {/* Lead Sources */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'hsl(38 92% 50%)' }}>Lead Sources</h3>
              {sourceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                      {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: 'rgba(255,255,255,0.95)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-sm py-12" style={{ color: 'rgba(255,255,255,0.4)' }}>No source data</p>
              )}
            </div>
          </div>

          {/* Agent Leaderboard */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: 'rgba(255,255,255,0.07)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <h3 className="text-base font-semibold mb-4 flex items-center gap-2" style={{ color: 'hsl(38 92% 50%)' }}>
              <Award className="w-5 h-5" />
              Agent Leaderboard
            </h3>
            {agentStats.length === 0 ? (
              <p className="text-center text-sm py-12" style={{ color: 'rgba(255,255,255,0.4)' }}>No agent data. Assign leads to see performance.</p>
            ) : (
              <div className="space-y-3">
                {agentStats.map((agent, i) => {
                  const isTop = i === 0;
                  const conv = parseFloat(agent.conversionRate);
                  return (
                    <div
                      key={agent.email}
                      className="p-4 rounded-xl border flex flex-wrap gap-4 items-center justify-between transition-all"
                      style={{
                        background: isTop ? 'rgba(245,159,10,0.08)' : 'transparent',
                        border: isTop ? '1px solid rgba(245,159,10,0.3)' : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-bold w-6 text-center ${isTop ? 'text-amber-500' : 'text-white/50'}`}>#{i + 1}</span>
                        {isTop && <Trophy className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />}
                        <div>
                          <p className="font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.95)' }}>{agent.name}</p>
                          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{agent.email}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-6">
                        <div className="text-center">
                          <p className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{agent.totalLeads}</p>
                          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Leads</p>
                        </div>
                        <div className="text-center">
                          <p className={`text-lg font-bold ${conv >= 30 ? 'text-emerald-500' : conv >= 15 ? 'text-amber-500' : 'text-red-500'}`}>
                            {agent.conversionRate}%
                          </p>
                          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Conversion</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-emerald-500">{agent.closedWon}</p>
                          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Closed</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{agent.activities}</p>
                          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,255,0.5)' }}>Activities</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold" style={{ color: 'hsl(38 92% 50%)' }}>{formatAED(agent.revenue)}</p>
                          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Revenue</p>
                        </div>
                      </div>

                      <Badge
                        style={{
                          background: conv >= 20 ? 'rgba(16,185,129,0.15)' : 'transparent',
                          border: `1px solid ${conv >= 20 ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.15)'}`,
                          color: conv >= 20 ? 'rgba(16,185,129,0.95)' : 'rgba(255,255,255,0.7)',
                        }}
                      >
                        {conv >= 30 ? '🔥 Elite' : conv >= 15 ? '✓ Performing' : '⚠ Support'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Goal Setter (admin only) */}
          <GoalSetterPanel />

          {/* Activity Breakdown */}
          {activityTypeData.length > 0 && (
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'hsl(38 92% 50%)' }}>Activity Breakdown</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={activityTypeData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }} />
                  <Tooltip 
                    contentStyle={{
                      background: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'rgba(255,255,255,0.95)',
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}