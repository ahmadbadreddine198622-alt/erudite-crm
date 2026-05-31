import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MessageCircle, Clock, TrendingUp, TrendingDown, AlertCircle, Users, Phone, BarChart3, Calendar } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, eachDayOfInterval, isToday } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

// Stat card component
function StatCard({ icon: Icon, label, value, subtext, color, gradient }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`} style={{ background: gradient }}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

// Agent performance row
function AgentRow({ agent, conversations, avgResponse, slaBreaches, sentiment }) {
  const responseTimeMins = Math.round(avgResponse / 60);
  
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors">
      <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-accent shrink-0">
        {agent.name[0]?.toUpperCase() || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">{agent.name}</p>
            <p className="text-xs text-muted-foreground">{agent.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-foreground">{conversations}</p>
              <p className="text-xs text-muted-foreground">Conversations</p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${responseTimeMins < 30 ? 'text-emerald-500' : responseTimeMins < 60 ? 'text-amber-500' : 'text-red-500'}`}>
                {responseTimeMins}m
              </p>
              <p className="text-xs text-muted-foreground">Avg Response</p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${slaBreaches > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {slaBreaches}
              </p>
              <p className="text-xs text-muted-foreground">SLA Breaches</p>
            </div>
            <div className="w-20">
              <div className="flex items-center gap-1 justify-end">
                {sentiment === 'positive' && <TrendingUp className="w-4 h-4 text-emerald-500" />}
                {sentiment === 'neutral' && <BarChart3 className="w-4 h-4 text-amber-500" />}
                {sentiment === 'negative' && <TrendingDown className="w-4 h-4 text-red-500" />}
              </div>
              <p className="text-xs text-muted-foreground text-right mt-0.5">Sentiment</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Bottleneck alert card
function BottleneckAlert({ type, count, agents }) {
  const configs = {
    slow_response: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Slow Response Times' },
    sla_breach: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'SLA Breaches' },
    negative_sentiment: { icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Negative Sentiment' },
    high_volume: { icon: MessageCircle, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'High Volume' },
  };
  
  const config = configs[type];
  const Icon = config.icon;

  return (
    <div className={`rounded-xl p-4 ${config.bg} border border-white/10`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${config.color} shrink-0`} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">{config.label}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {count} {count === 1 ? 'conversation' : 'conversations'} across {agents.length} {agents.length === 1 ? 'agent' : 'agents'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Agents: {agents.join(', ')}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function WhatsAppAnalytics() {
  const [timeRange, setTimeRange] = useState('7d'); // 7d, 30d, 90d

  // Fetch WhatsApp conversations
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['whatsapp-conversations-analytics', timeRange],
    queryFn: () => base44.entities.WhatsAppConversation.list('-last_message_at', 1000),
  });

  // Fetch users for agent names
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  // Calculate date range
  const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
  const startDate = startOfDay(subDays(new Date(), daysAgo));
  const endDate = endOfDay(new Date());

  // Filter conversations by date range
  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      if (!c.last_message_at) return false;
      const msgDate = new Date(c.last_message_at);
      return msgDate >= startDate && msgDate <= endDate;
    });
  }, [conversations, startDate, endDate]);

  // Group by agent
  const agentStats = useMemo(() => {
    const stats = {};
    
    filteredConversations.forEach(c => {
      const agentEmail = c.assigned_agent_email || 'Unassigned';
      if (!stats[agentEmail]) {
        stats[agentEmail] = {
          email: agentEmail,
          name: users.find(u => u.email === agentEmail)?.full_name || agentEmail.split('@')[0],
          conversations: 0,
          totalResponseTime: 0,
          responseCount: 0,
          slaBreaches: 0,
          sentiments: { positive: 0, neutral: 0, negative: 0, unknown: 0 },
        };
      }
      
      stats[agentEmail].conversations++;
      if (c.avg_response_seconds) {
        stats[agentEmail].totalResponseTime += c.avg_response_seconds;
        stats[agentEmail].responseCount++;
      }
      if (c.sla_breached) stats[agentEmail].slaBreaches++;
      stats[agentEmail].sentiments[c.ai_sentiment || 'unknown']++;
    });

    return Object.values(stats).sort((a, b) => b.conversations - a.conversations);
  }, [filteredConversations, users]);

  // Calculate overall metrics
  const metrics = useMemo(() => {
    const totalConversations = filteredConversations.length;
    const avgResponseTime = filteredConversations.reduce((sum, c) => sum + (c.avg_response_seconds || 0), 0) / 
                           filteredConversations.filter(c => c.avg_response_seconds).length || 0;
    const slaBreaches = filteredConversations.filter(c => c.sla_breached).length;
    const openConversations = filteredConversations.filter(c => c.status === 'open' || c.status === 'new').length;
    
    const sentimentDistribution = {
      positive: filteredConversations.filter(c => c.ai_sentiment === 'positive').length,
      neutral: filteredConversations.filter(c => c.ai_sentiment === 'neutral').length,
      negative: filteredConversations.filter(c => c.ai_sentiment === 'negative').length,
    };

    return {
      totalConversations,
      avgResponseTime: Math.round(avgResponseTime / 60), // in minutes
      slaBreaches,
      openConversations,
      sentimentDistribution,
    };
  }, [filteredConversations]);

  // Identify bottlenecks
  const bottlenecks = useMemo(() => {
    const issues = [];
    
    // Slow response agents (>60 min avg)
    const slowAgents = agentStats.filter(a => a.responseCount > 0 && (a.totalResponseTime / a.responseCount) > 3600);
    if (slowAgents.length > 0) {
      issues.push({
        type: 'slow_response',
        count: slowAgents.reduce((sum, a) => sum + a.conversations, 0),
        agents: slowAgents.map(a => a.name),
      });
    }

    // SLA breach agents
    const slaAgents = agentStats.filter(a => a.slaBreaches > 0);
    if (slaAgents.length > 0) {
      issues.push({
        type: 'sla_breach',
        count: slaAgents.reduce((sum, a) => sum + a.slaBreaches, 0),
        agents: slaAgents.map(a => a.name),
      });
    }

    // Negative sentiment conversations
    const negativeConvos = filteredConversations.filter(c => c.ai_sentiment === 'negative');
    if (negativeConvos.length > 0) {
      const negAgents = [...new Set(negativeConvos.map(c => c.assigned_agent_email || 'Unassigned'))];
      issues.push({
        type: 'negative_sentiment',
        count: negativeConvos.length,
        agents: negAgents.map(email => users.find(u => u.email === email)?.full_name || email.split('@')[0]),
      });
    }

    // High volume agents (>20 conversations)
    const highVolumeAgents = agentStats.filter(a => a.conversations > 20);
    if (highVolumeAgents.length > 0) {
      issues.push({
        type: 'high_volume',
        count: highVolumeAgents.reduce((sum, a) => sum + a.conversations, 0),
        agents: highVolumeAgents.map(a => a.name),
      });
    }

    return issues;
  }, [agentStats, filteredConversations, users]);

  // Daily trend data
  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    return days.map(day => {
      const dayConversations = filteredConversations.filter(c => {
        if (!c.last_message_at) return false;
        return isToday(new Date(c.last_message_at)) ? isToday(day) : format(new Date(c.last_message_at), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
      });
      
      return {
        date: format(day, 'MMM d'),
        conversations: dayConversations.length,
        avgResponse: Math.round(dayConversations.reduce((sum, c) => sum + (c.avg_response_seconds || 0), 0) / 
                               dayConversations.filter(c => c.avg_response_seconds).length / 60) || 0,
      };
    });
  }, [filteredConversations, startDate, endDate]);

  // Sentiment pie chart data
  const sentimentData = [
    { name: 'Positive', value: metrics.sentimentDistribution.positive, color: '#10b981' },
    { name: 'Neutral', value: metrics.sentimentDistribution.neutral, color: '#f59e0b' },
    { name: 'Negative', value: metrics.sentimentDistribution.negative, color: '#ef4444' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen page-root flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-accent/30 border-t-accent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-muted-foreground font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-root pb-24">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title text-3xl">WhatsApp Analytics</h1>
            <p className="page-subtitle mt-1">Team performance & conversation insights</p>
          </div>
          <div className="flex gap-2">
            {['7d', '30d', '90d'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  timeRange === range
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                }`}
              >
                {range === '7d' ? 'Last 7 days' : range === '30d' ? 'Last 30 days' : 'Last 90 days'}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={MessageCircle}
            label="Total Conversations"
            value={metrics.totalConversations}
            subtext={`${timeRange} period`}
            color="bg-blue-500"
            gradient="linear-gradient(135deg, rgba(59,130,246,0.8) 0%, rgba(30,60,120,0.6) 100%)"
          />
          <StatCard
            icon={Clock}
            label="Avg Response Time"
            value={`${metrics.avgResponseTime}m`}
            subtext={metrics.avgResponseTime < 30 ? 'Excellent' : metrics.avgResponseTime < 60 ? 'Good' : 'Needs improvement'}
            color="bg-amber-500"
            gradient="linear-gradient(135deg, rgba(245,158,11,0.8) 0%, rgba(180,100,0,0.6) 100%)"
          />
          <StatCard
            icon={AlertCircle}
            label="SLA Breaches"
            value={metrics.slaBreaches}
            subtext={metrics.slaBreaches === 0 ? 'Perfect compliance' : 'Action required'}
            color="bg-red-500"
            gradient="linear-gradient(135deg, rgba(239,68,68,0.8) 0%, rgba(180,40,40,0.6) 100%)"
          />
          <StatCard
            icon={Users}
            label="Active Agents"
            value={agentStats.length}
            subtext={agentStats.length > 0 ? `${Math.round((agentStats.filter(a => a.conversations > 5).length / agentStats.length) * 100)}% highly active`}
            color="bg-emerald-500"
            gradient="linear-gradient(135deg, rgba(16,185,129,0.8) 0%, rgba(10,80,60,0.6) 100%)"
          />
        </div>

        {/* Bottleneck Alerts */}
        {bottlenecks.length > 0 && (
          <div className="glass-card rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Performance Bottlenecks
            </h2>
            <div className="space-y-3">
              {bottlenecks.map((bottleneck, idx) => (
                <BottleneckAlert key={idx} {...bottleneck} />
              ))}
            </div>
          </div>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Trend */}
          <div className="glass-card rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Daily Conversation Volume
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: 'rgba(20,28,48,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  labelStyle={{ color: 'rgba(255,255,255,0.9)' }}
                />
                <Bar dataKey="conversations" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Sentiment Distribution */}
          <div className="glass-card rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-500" />
              Sentiment Distribution
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {sentimentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'rgba(20,28,48,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Agent Performance Table */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="text-lg font-semibold text-foreground">Agent Performance</h2>
          </div>
          <div className="divide-y divide-white/5">
            {agentStats.map(agent => (
              <AgentRow
                key={agent.email}
                agent={agent}
                conversations={agent.conversations}
                avgResponse={agent.responseCount > 0 ? agent.totalResponseTime / agent.responseCount : 0}
                slaBreaches={agent.slaBreaches}
                sentiment={
                  agent.sentiments.positive > agent.sentiments.negative ? 'positive' :
                  agent.sentiments.negative > agent.sentiments.positive ? 'negative' : 'neutral'
                }
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}