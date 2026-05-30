import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, Target, Activity, DollarSign, Clock, CheckCircle, BarChart3 } from 'lucide-react';
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
    const totalValue = leads.reduce((sum, l) => sum + (l.deal_value_aed || 0), 0);
    const avgDealSize = conversions > 0 ? totalValue / conversions : 0;

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
          agentPerformance[a.agent_email] = { email: a.agent_email, name: a.agent_name || a.agent_email, activities: 0, value: 0 };
        }
        agentPerformance[a.agent_email].activities++;
      }
    });
    
    leads.forEach(l => {
      if (l.assigned_agent_email && agentPerformance[l.assigned_agent_email]) {
        agentPerformance[l.assigned_agent_email].value += (l.deal_value_aed || 0);
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
      totalValue,
      avgDealSize,
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
        <PageHeader title="Analytics" subtitle="Performance intelligence and CRM insights" />

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
              <Users className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Total Pipeline</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>{metrics.totalLeads}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{metrics.activeLeads} active</p>
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
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Conversion Rate</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{metrics.conversionRate}%</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{metrics.conversions} closed</p>
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
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Avg Deal Size</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>
              {metrics.avgDealSize >= 1_000_000 ? `AED ${(metrics.avgDealSize / 1_000_000).toFixed(1)}M` : metrics.avgDealSize >= 1_000 ? `AED ${(metrics.avgDealSize / 1_000).toFixed(0)}K` : 'AED 0'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Per closed deal</p>
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
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Lead Quality</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{metrics.avgScore}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Average score</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lead Pipeline */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: 'rgba(255,255,255,0.07)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'hsl(38 92% 50%)' }}>Lead Pipeline Distribution</h3>
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
              <div className="h-80 flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
                No pipeline data yet
              </div>
            )}
          </div>

          {/* Agent Performance */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: 'rgba(255,255,255,0.07)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'hsl(38 92% 50%)' }}>Agent Activity</h3>
            {metrics.agentPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.agentPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={12} stroke="rgba(255,255,255,0.5)" />
                  <YAxis stroke="rgba(255,255,255,0.5)" />
                  <Tooltip 
                    contentStyle={{
                      background: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'rgba(255,255,255,0.95)',
                    }}
                  />
                  <Bar dataKey="activities" fill="hsl(38 92% 50%)" name="Activities" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
                No agent data yet
              </div>
            )}
          </div>
        </div>

        {/* Lead Score Distribution */}
        <div
          className="rounded-2xl p-5"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'hsl(38 92% 50%)' }}>Lead Quality Distribution</h3>
          {leadScores.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={leadScores.slice(0, 20).map((s, i) => ({
                name: s.lead_id?.substring(0, 8) || `Lead ${i}`,
                score: s.overall_score,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" fontSize={12} stroke="rgba(255,255,255,0.5)" />
                <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.5)" />
                <Tooltip 
                  contentStyle={{
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: 'rgba(255,255,255,0.95)',
                  }}
                />
                <Bar dataKey="score" fill="hsl(152 69% 40%)" name="Score" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
              No scoring data yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}