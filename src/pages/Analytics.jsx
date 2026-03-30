import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, Target, Activity } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';

export default function Analytics() {
  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 500),
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['wa_conversations'],
    queryFn: () => base44.entities.WhatsAppConversation.list('-created_date', 500),
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities'],
    queryFn: () => base44.entities.Activity.list('-created_date', 1000),
  });

  const { data: leadScores = [] } = useQuery({
    queryKey: ['lead_scores'],
    queryFn: () => base44.entities.LeadScore.list('-calculated_at', 500),
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalLeads = leads.length;
    const activeLeads = leads.filter(l => l.stage !== 'closed_lost' && l.stage !== 'closed_won').length;
    const conversions = leads.filter(l => l.stage === 'closed_won').length;
    const conversionRate = totalLeads > 0 ? ((conversions / totalLeads) * 100).toFixed(1) : 0;

    const avgScore = leadScores.length > 0 
      ? (leadScores.reduce((sum, s) => sum + (s.overall_score || 0), 0) / leadScores.length).toFixed(1)
      : 0;

    const stageBreakdown = {};
    leads.forEach(l => {
      stageBreakdown[l.stage] = (stageBreakdown[l.stage] || 0) + 1;
    });

    const agentPerformance = {};
    activities.forEach(a => {
      if (a.agent_email) {
        if (!agentPerformance[a.agent_email]) {
          agentPerformance[a.agent_email] = { email: a.agent_email, name: a.agent_name || a.agent_email, activities: 0 };
        }
        agentPerformance[a.agent_email].activities++;
      }
    });

    return {
      totalLeads,
      activeLeads,
      conversions,
      conversionRate,
      avgScore,
      stageBreakdown,
      agentPerformance: Object.values(agentPerformance).sort((a, b) => b.activities - a.activities),
    };
  }, [leads, leadScores, activities]);

  // Conversion by stage
  const stageChartData = useMemo(() => {
    return Object.entries(metrics.stageBreakdown)
      .map(([stage, count]) => ({
        name: stage.replace(/_/g, ' ').toUpperCase(),
        value: count,
      }))
      .sort((a, b) => b.value - a.value);
  }, [metrics.stageBreakdown]);

  const COLORS = ['#1f2937', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444'];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader title="Analytics" subtitle="Real-time CRM insights and performance metrics" />

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalLeads}</div>
              <p className="text-xs text-muted-foreground">{metrics.activeLeads} active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Target className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.conversionRate}%</div>
              <p className="text-xs text-muted-foreground">{metrics.conversions} closed deals</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Lead Score</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.avgScore}/100</div>
              <p className="text-xs text-muted-foreground">Lead quality</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
              <Activity className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activities.length}</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lead Pipeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lead Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              {stageChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stageChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {stageChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  No data yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Agent Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agent Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.agentPerformance.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.agentPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={12} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="activities" fill="#3b82f6" name="Activities" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  No agent data yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lead Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lead Quality Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {leadScores.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={leadScores.slice(0, 20).map((s, i) => ({
                  name: s.lead_id?.substring(0, 8) || `Lead ${i}`,
                  score: s.overall_score,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="score" fill="#10b981" name="Score" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No scoring data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}