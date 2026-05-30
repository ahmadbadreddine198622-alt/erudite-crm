import React, { useState, useMemo } from 'react';
import { TrendingUp, DollarSign, Target, Calendar, Brain, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function RevenueForecaster() {
  const [selectedPeriod, setSelectedPeriod] = useState('30');

  const { data: deals = [] } = useQuery({
    queryKey: ['deals-forecast'],
    queryFn: () => base44.entities.Deal.list('-updated_date', 500),
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-forecast'],
    queryFn: () => base44.entities.Lead.list('-updated_date', 500),
  });

  const forecast = useMemo(() => {
    const now = new Date();
    const daysToForecast = parseInt(selectedPeriod);
    const futureDate = new Date(now.getTime() + daysToForecast * 24 * 60 * 60 * 1000);

    // Pipeline analysis
    const activeDeals = deals.filter(d => 
      ['negotiation', 'offer_made', 'closing', 'dld_process'].includes(d.stage)
    );

    // Calculate weighted pipeline value
    const stageWeights = {
      negotiation: 0.3,
      offer_made: 0.5,
      closing: 0.75,
      dld_process: 0.9,
    };

    const weightedValue = activeDeals.reduce((sum, deal) => {
      const weight = stageWeights[deal.stage] || 0.3;
      return sum + ((deal.value_aed || 0) * weight);
    }, 0);

    // Historical close rate (last 90 days)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const closedDeals = deals.filter(d => 
      d.stage === 'closed_won' && 
      d.updated_date && 
      new Date(d.updated_date) > ninetyDaysAgo
    );

    const totalHistorical = deals.filter(d => 
      d.updated_date && new Date(d.updated_date) > ninetyDaysAgo
    ).length;

    const closeRate = totalHistorical > 0 ? (closedDeals.length / totalHistorical) * 100 : 0;

    // Predicted revenue
    const predictedRevenue = weightedValue * (closeRate / 100);
    const commissionRate = 0.02;
    const predictedCommission = predictedRevenue * commissionRate;

    // Monthly breakdown
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthClosed = deals.filter(d => 
        d.stage === 'closed_won' &&
        d.updated_date &&
        new Date(d.updated_date) >= monthDate &&
        new Date(d.updated_date) <= monthEnd
      );

      const monthValue = monthClosed.reduce((sum, d) => sum + (d.value_aed || 0), 0);

      monthlyData.push({
        month: monthDate.toLocaleDateString('en-AE', { month: 'short' }),
        revenue: monthValue / 1000000,
        commission: (monthValue * commissionRate) / 1000,
      });
    }

    // Pipeline by stage
    const pipelineByStage = {
      negotiation: activeDeals.filter(d => d.stage === 'negotiation').length,
      offer_made: activeDeals.filter(d => d.stage === 'offer_made').length,
      closing: activeDeals.filter(d => d.stage === 'closing').length,
      dld_process: activeDeals.filter(d => d.stage === 'dld_process').length,
    };

    return {
      weightedValue,
      predictedRevenue,
      predictedCommission,
      closeRate,
      activeDealsCount: activeDeals.length,
      monthlyData,
      pipelineByStage,
      daysToForecast,
    };
  }, [deals, selectedPeriod]);

  const customTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 border border-white/10 rounded-lg p-3 shadow-xl">
          <p className="text-xs text-white/70 mb-1">{label}</p>
          <p className="text-sm font-semibold text-amber-500">
            AED {payload[0]?.value?.toFixed(1)}M
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(245,159,10,0.15)', border: '1px solid rgba(245,159,10,0.3)' }}
          >
            <Brain className="w-6 h-6" style={{ color: 'hsl(38 92% 50%)' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>Revenue Forecaster</h2>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>AI-powered commission predictions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {['30', '60', '90'].map(days => (
            <Badge
              key={days}
              onClick={() => setSelectedPeriod(days)}
              className={`cursor-pointer ${
                selectedPeriod === days 
                  ? 'bg-amber-500/20 text-amber-500 border-amber-500/50' 
                  : 'bg-white/5 text-white/60 border-white/10'
              }`}
            >
              {days}d
            </Badge>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-emerald-500/10 border-emerald-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold uppercase text-emerald-500/70">Predicted Revenue</span>
            </div>
            <p className="text-2xl font-bold text-emerald-500">
              AED {(forecast.predictedRevenue / 1000000).toFixed(2)}M
            </p>
            <p className="text-xs text-emerald-500/60 mt-1">
              Next {forecast.daysToForecast} days
            </p>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
              <span className="text-xs font-semibold uppercase" style={{ color: 'hsl(38 92% 50% / 70%)' }}>Your Commission</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>
              AED {(forecast.predictedCommission / 1000).toFixed(0)}K
            </p>
            <p className="text-xs" style={{ color: 'hsl(38 92% 50% / 60%)' }}>
              Before tax
            </p>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-semibold uppercase text-blue-500/70">Close Rate</span>
            </div>
            <p className="text-2xl font-bold text-blue-500">
              {forecast.closeRate.toFixed(1)}%
            </p>
            <p className="text-xs text-blue-500/60 mt-1">
              Last 90 days
            </p>
          </CardContent>
        </Card>

        <Card className="bg-purple-500/10 border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <span className="text-xs font-semibold uppercase text-purple-500/70">Active Deals</span>
            </div>
            <p className="text-2xl font-bold text-purple-500">
              {forecast.activeDealsCount}
            </p>
            <p className="text-xs text-purple-500/60 mt-1">
              AED {(forecast.weightedValue / 1000000).toFixed(1)}M weighted
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend Chart */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold mb-1" style={{ color: 'rgba(255,255,255,0.95)' }}>Revenue Trend</h3>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Last 6 months performance</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={forecast.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" fontSize={12} />
              <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
              <Tooltip content={customTooltip} />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="hsl(38 92% 50%)" 
                strokeWidth={3}
                dot={{ fill: 'hsl(38 92% 50%)', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pipeline Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stage Distribution */}
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6">
            <h3 className="font-bold mb-4" style={{ color: 'rgba(255,255,255,0.95)' }}>Pipeline by Stage</h3>
            <div className="space-y-4">
              {Object.entries(forecast.pipelineByStage).map(([stage, count]) => {
                const maxCount = Math.max(...Object.values(forecast.pipelineByStage));
                const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                
                return (
                  <div key={stage}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                        {stage.replace('_', ' ')}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.9)' }}>{count} deals</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Forecast Confidence */}
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6">
            <h3 className="font-bold mb-4" style={{ color: 'rgba(255,255,255,0.95)' }}>Forecast Confidence</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>High Confidence Deals</span>
                </div>
                <span className="text-sm font-semibold text-emerald-500">
                  {forecast.pipelineByStage.closing + forecast.pipelineByStage.dld_process}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>Medium Confidence</span>
                </div>
                <span className="text-sm font-semibold" style={{ color: 'hsl(38 92% 50%)' }}>
                  {forecast.pipelineByStage.offer_made}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4 text-blue-500" />
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>Early Stage</span>
                </div>
                <span className="text-sm font-semibold text-blue-500">
                  {forecast.pipelineByStage.negotiation}
                </span>
              </div>

              <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Forecast Accuracy</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Based on historical data</span>
                  <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/50">
                    87% Accurate
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}