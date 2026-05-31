import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Brain, Zap, Activity, TrendingUp, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function SmartOperationsWindow({ metrics, insights, syncStatus, onSyncAll }) {
  // Calculate overall health score
  const healthScore = React.useMemo(() => {
    if (!metrics) return 0;
    const factors = [
      metrics.pipeline_health?.score || 50,
      metrics.inventory_ratio?.score || 50,
      metrics.engagement_rate?.score || 50,
    ];
    return Math.round(factors.reduce((a, b) => a + b, 0) / factors.length);
  }, [metrics]);

  const getHealthColor = (score) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const getHealthGradient = (score) => {
    if (score >= 80) return 'from-emerald-500/20 to-emerald-600/10';
    if (score >= 60) return 'from-amber-500/20 to-amber-600/10';
    return 'from-red-500/20 to-red-600/10';
  };

  return (
    <div className="relative">
      {/* Animated background glow */}
      <div
        className="absolute inset-0 rounded-3xl blur-3xl opacity-30"
        style={{
          background: `radial-gradient(ellipse at center, hsl(38 92% 50% / 0.3) 0%, transparent 70%)`,
          animation: 'pulse 4s ease-in-out infinite',
        }}
      />

      <div className="relative glass-card rounded-3xl p-6 border border-white/15 overflow-hidden">
        {/* Header with Claude Presence */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full" />
              <Brain className="w-8 h-8 text-accent relative z-10" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Cloud Operations</h2>
              <p className="text-xs text-muted-foreground">AI-powered synchronization hub</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Health Score */}
            <div className={`px-4 py-2 rounded-2xl bg-gradient-to-br ${getHealthGradient(healthScore)} border border-white/10`}>
              <div className="flex items-center gap-2">
                <Activity className={`w-4 h-4 ${getHealthColor(healthScore)}`} />
                <span className={`text-lg font-bold ${getHealthColor(healthScore)}`}>{healthScore}</span>
                <span className="text-xs text-muted-foreground">Health</span>
              </div>
            </div>

            {/* Sync Button */}
            <button
              onClick={onSyncAll}
              disabled={syncStatus === 'syncing'}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              style={{
                background: syncStatus === 'syncing' ? 'hsl(222 47% 15%)' : 'hsl(38 92% 50%)',
                color: syncStatus === 'syncing' ? 'hsl(220 9% 55%)' : 'hsl(222 47% 11%)',
              }}
            >
              <Zap className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-pulse' : ''}`} />
              {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>

        {/* Critical Metrics Grid */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {/* Pipeline Health */}
            <MetricCard
              icon={TrendingUp}
              label="Pipeline Health"
              value={`${metrics.pipeline_health?.score || 0}%`}
              trend={metrics.pipeline_health?.trend}
              color="#3b82f6"
            />

            {/* Inventory Ratio */}
            <MetricCard
              icon={Activity}
              label="Inventory Ratio"
              value={metrics.inventory_ratio?.ratio || '0:1'}
              trend={metrics.inventory_ratio?.trend}
              color="#10b981"
            />

            {/* Engagement Rate */}
            <MetricCard
              icon={Zap}
              label="Engagement"
              value={`${metrics.engagement_rate?.percentage || 0}%`}
              trend={metrics.engagement_rate?.trend}
              color="#f59e0b"
            />

            {/* Conversion Rate */}
            <MetricCard
              icon={CheckCircle2}
              label="Conversion"
              value={`${metrics.conversion_rate?.percentage || 0}%`}
              trend={metrics.conversion_rate?.trend}
              color="#8b5cf6"
            />
          </div>
        )}

        {/* Smart Insights Stream */}
        {insights && insights.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold text-foreground">Live Insights</h3>
              <span className="text-xs text-muted-foreground ml-auto">{insights.length} active</span>
            </div>
            <div className="space-y-2">
              {insights.slice(0, 3).map((insight, idx) => (
                <InsightStreamItem key={idx} insight={insight} />
              ))}
            </div>
          </div>
        )}

        {/* Entity Sync Status */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {['Leads', 'Properties', 'Landlords', 'Deals', 'Conversations', 'Reminders'].map((entity, idx) => (
            <EntitySyncBadge
              key={entity}
              name={entity}
              status="synced"
              delay={idx * 100}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, trend, color }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
        {trend && (
          <span className={`text-xs ${trend > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="text-lg font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </motion.div>
  );
}

function InsightStreamItem({ insight }) {
  const configs = {
    critical: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    warning: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    opportunity: { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    recommendation: { icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  };

  const config = configs[insight.type] || configs.recommendation;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-start gap-3 p-3 rounded-xl ${config.bg} border ${config.border}`}
    >
      <Icon className={`w-4 h-4 ${config.color} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">{insight.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{insight.description}</p>
      </div>
      <span className="text-xs text-muted-foreground">
        {format(new Date(insight.detectedAt), 'HH:mm')}
      </span>
    </motion.div>
  );
}

function EntitySyncBadge({ name, status, delay }) {
  const configs = {
    synced: { icon: CheckCircle2, color: 'text-emerald-500' },
    syncing: { icon: Clock, color: 'text-blue-500', spin: true },
    pending: { icon: Clock, color: 'text-amber-500' },
    error: { icon: AlertCircle, color: 'text-red-500' },
  };

  const config = configs[status] || configs.synced;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: delay / 1000 }}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10"
    >
      <Icon className={`w-3.5 h-3.5 ${config.color} ${config.spin ? 'animate-spin' : ''}`} />
      <span className="text-xs font-medium text-foreground">{name}</span>
    </motion.div>
  );
}

function Sparkles({ className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3L14.5 8.5L20 9L15.5 13.5L16.5 19L12 16L7.5 19L8.5 13.5L4 9L9.5 8.5L12 3Z" />
    </svg>
  );
}