import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import {
  Users, TrendingUp, Activity, DollarSign, Bell, ArrowRight, Eye, Phone, Calendar, Target
} from 'lucide-react';
import { formatAED } from '@/lib/constants';
import AgentGoalCard from '@/components/dashboard/AgentGoalCard';
import DailyStandup from '@/components/dashboard/DailyStandup';
import { useAuth } from '@/lib/AuthContext';

export default function MyDashboard() {
  const { user } = useAuth();
  const currentMonth = format(startOfMonth(new Date()), 'yyyy-MM');
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const { data: allLeads = [] } = useQuery({
    queryKey: ['my_leads', user?.email],
    queryFn: () => base44.entities.Lead.filter({ assigned_agent: user?.email }, '-created_date', 500),
    enabled: !!user?.email,
  });

  const { data: allActivities = [] } = useQuery({
    queryKey: ['my_activities', user?.email],
    queryFn: () => base44.entities.Activity.filter({ agent_email: user?.email }, '-created_date', 500),
    enabled: !!user?.email,
  });

  const { data: allCommissions = [] } = useQuery({
    queryKey: ['my_commissions', user?.email],
    queryFn: () => base44.entities.Commission.filter({ agent_email: user?.email }, '-created_date', 200),
    enabled: !!user?.email,
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ['my_reminders', user?.email],
    queryFn: () => base44.entities.Reminder.filter({ assigned_to: user?.email, status: 'pending' }, '-due_date', 10),
    enabled: !!user?.email,
  });

  const { data: goals = [] } = useQuery({
    queryKey: ['agent_goals', currentMonth, user?.email],
    queryFn: () => base44.entities.AgentGoal.filter({ month: currentMonth, agent_email: user?.email }),
    enabled: !!user?.email,
  });

  const thisMonthGoal = goals[0] || null;

  // This month's stats
  const monthLeads = useMemo(() =>
    allLeads.filter(l => new Date(l.created_date) >= monthStart && new Date(l.created_date) <= monthEnd),
    [allLeads]
  );

  const monthActivities = useMemo(() =>
    allActivities.filter(a => new Date(a.created_date) >= monthStart && new Date(a.created_date) <= monthEnd),
    [allActivities]
  );

  const monthCommissions = useMemo(() =>
    allCommissions.filter(c => new Date(c.created_date) >= monthStart && new Date(c.created_date) <= monthEnd),
    [allCommissions]
  );

  const stats = useMemo(() => {
    const closedWon = allLeads.filter(l => l.stage === 'closed_won').length;
    const closedWonMonth = monthLeads.filter(l => l.stage === 'closed_won').length;
    const revenue = allCommissions.reduce((s, c) => s + (c.commission_amount_aed || 0), 0);
    const revenueMonth = monthCommissions.reduce((s, c) => s + (c.commission_amount_aed || 0), 0);
    const viewings = monthActivities.filter(a => a.type === 'viewing').length;
    return {
      totalLeads: monthLeads.length,
      closedWon: closedWonMonth,
      closedWonAll: closedWon,
      activities: monthActivities.length,
      revenue: revenueMonth,
      revenueAll: revenue,
      viewings,
      conversionRate: allLeads.length > 0 ? ((closedWon / allLeads.length) * 100).toFixed(1) : '0.0',
    };
  }, [allLeads, monthLeads, allCommissions, monthCommissions, monthActivities]);

  const recentLeads = allLeads.slice(0, 5);

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {user?.full_name?.split(' ')[0] || 'Agent'} 👋
        </h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d yyyy')} · Your personal performance dashboard</p>
      </div>

      {/* Daily Standup */}
      <DailyStandup />

      {/* This Month's Goal Progress */}
      <AgentGoalCard goal={thisMonthGoal} stats={stats} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">My Leads (This Month)</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLeads}</div>
            <p className="text-xs text-muted-foreground">{allLeads.length} total assigned</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Closed Deals</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.closedWon}</div>
            <p className="text-xs text-muted-foreground">{stats.conversionRate}% overall conversion</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Activities (This Month)</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activities}</div>
            <p className="text-xs text-muted-foreground">{stats.viewings} viewings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">My Commission</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{formatAED(stats.revenue)}</div>
            <p className="text-xs text-muted-foreground">{formatAED(stats.revenueAll)} all time</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Leads + Reminders */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">My Recent Leads</h3>
            <Link to="/leads" className="text-xs text-accent font-medium hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No leads assigned to you yet.</p>
            ) : (
              recentLeads.map(lead => (
                <Link
                  key={lead.id}
                  to={`/leads?id=${lead.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent">
                      {lead.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{lead.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{lead.stage?.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                    {lead.source?.replace(/_/g, ' ') || '—'}
                  </Badge>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">My Upcoming Reminders</h3>
            <Link to="/reminders" className="text-xs text-accent font-medium hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {reminders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No upcoming reminders.</p>
            ) : (
              reminders.map(rem => (
                <div key={rem.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    {rem.type === 'viewing' ? <Eye className="w-4 h-4 text-amber-600" /> :
                     rem.type === 'follow_up' ? <Phone className="w-4 h-4 text-amber-600" /> :
                     rem.type === 'contract_renewal' ? <Calendar className="w-4 h-4 text-amber-600" /> :
                     <Bell className="w-4 h-4 text-amber-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{rem.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {rem.due_date && format(new Date(rem.due_date), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize shrink-0">{rem.priority}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}