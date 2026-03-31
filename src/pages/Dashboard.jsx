import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import {
  Users, Building2, DollarSign, TrendingUp, Bell, ArrowRight,
  Clock, Eye, Phone, Calendar
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import StatCard from '@/components/shared/StatCard';
import PageHeader from '@/components/shared/PageHeader';
import LeadScoreBadge from '@/components/shared/LeadScoreBadge';
import SourceBadge from '@/components/shared/SourceBadge';
import MobileDashboard from '@/components/mobile/MobileDashboard';
import DailyBriefing from '@/components/dashboard/DailyBriefing';
import DailyFocus from '@/components/dashboard/DailyFocus';
import { PIPELINE_STAGES, formatAED, SOURCE_LABELS } from '@/lib/constants';

export default function Dashboard() {
  const isMobile = useIsMobile();
  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 200),
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list('-created_date', 200),
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ['commissions'],
    queryFn: () => base44.entities.Commission.list('-created_date', 200),
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => base44.entities.Reminder.filter({ status: 'pending' }, '-due_date', 10),
  });

  // Stats
  const totalLeads = leads.length;
  const activeProperties = properties.filter(p => p.status === 'available').length;
  const closedDeals = leads.filter(l => l.stage === 'closed_won').length;
  const totalCommission = commissions
    .filter(c => c.status === 'paid' || c.status === 'approved')
    .reduce((sum, c) => sum + (c.commission_amount_aed || 0), 0);

  // Pipeline data for chart
  const pipelineData = PIPELINE_STAGES.map(stage => ({
    name: stage.label.split(' ').slice(0, 2).join(' '),
    count: leads.filter(l => l.stage === stage.id).length,
  }));

  // Source breakdown
  const sourceData = Object.entries(SOURCE_LABELS).map(([key, label]) => ({
    name: label,
    value: leads.filter(l => l.source === key).length,
  })).filter(d => d.value > 0);

  const pieColors = ['hsl(38, 92%, 50%)', 'hsl(173, 58%, 39%)', 'hsl(222, 47%, 35%)', 'hsl(12, 76%, 61%)', 'hsl(280, 65%, 60%)', 'hsl(152, 69%, 40%)', 'hsl(340, 75%, 55%)'];

  const recentLeads = leads.slice(0, 5);
  const upcomingReminders = reminders.slice(0, 5);

  if (isMobile) {
    return (
      <div className="p-4 space-y-4">
        <PageHeader title="Dashboard" subtitle={format(new Date(), 'EEE, MMM d')} />
        <MobileDashboard />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8">
      <PageHeader 
        title="Dashboard" 
        subtitle={`Welcome back · ${format(new Date(), 'EEEE, MMMM d')}`}
      >
        <Link to="/pipeline">
          <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Eye className="w-4 h-4 mr-2" />
            View Pipeline
          </Button>
        </Link>
      </PageHeader>

      {/* Daily Briefing */}
      <DailyBriefing />

      {/* Daily Focus */}
      <DailyFocus />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Leads" value={totalLeads} icon={Users} trend="+12% this month" trendUp />
        <StatCard title="Active Listings" value={activeProperties} icon={Building2} />
        <StatCard title="Closed Deals" value={closedDeals} icon={TrendingUp} trend="+3 this month" trendUp />
        <StatCard title="Commissions" value={formatAED(totalCommission)} icon={DollarSign} />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5">
          <h3 className="text-sm font-semibold mb-4">Pipeline Overview</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={pipelineData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: '1px solid hsl(220, 13%, 88%)', fontSize: 12 }}
              />
              <Bar dataKey="count" fill="hsl(38, 92%, 50%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4">Lead Sources</h3>
          {sourceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {sourceData.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid hsl(220, 13%, 88%)', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
          )}
          <div className="space-y-2 mt-2">
            {sourceData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pieColors[i % pieColors.length] }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </div>
                <span className="font-semibold">{d.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent + Reminders */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Recent Leads</h3>
            <Link to="/leads" className="text-xs text-accent font-medium hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentLeads.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No leads yet. Start adding leads to your pipeline.</p>
            )}
            {recentLeads.map(lead => (
              <Link
                key={lead.id}
                to={`/leads?id=${lead.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent">
                    {lead.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{lead.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <SourceBadge source={lead.source} />
                      <LeadScoreBadge score={lead.lead_score} />
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {lead.created_date && format(new Date(lead.created_date), 'MMM d')}
                </span>
              </Link>
            ))}
          </div>
        </Card>

        {/* Upcoming Reminders */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Upcoming Reminders</h3>
            <Link to="/reminders" className="text-xs text-accent font-medium hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {upcomingReminders.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No upcoming reminders.</p>
            )}
            {upcomingReminders.map(rem => (
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
                <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                  {rem.priority}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}