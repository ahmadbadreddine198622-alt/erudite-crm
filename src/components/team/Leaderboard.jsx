import React, { useState, useMemo } from 'react';
import { Trophy, TrendingUp, DollarSign, Target, Users, Crown, Medal, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Leaderboard() {
  const { data: deals = [] } = useQuery({
    queryKey: ['deals-leaderboard'],
    queryFn: () => base44.entities.Deal.list('-updated_date', 500),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-leaderboard'],
    queryFn: () => base44.entities.User.list(),
  });

  const leaderboard = useMemo(() => {
    const agentStats = {};

    // Initialize all users
    users.forEach(user => {
      agentStats[user.email] = {
        email: user.email,
        name: user.full_name || user.email,
        dealsClosed: 0,
        totalValue: 0,
        commission: 0,
        activeDeals: 0,
        avgDealSize: 0,
        conversionRate: 0,
        points: 0,
      };
    });

    // Calculate stats from deals
    deals.forEach(deal => {
      const agentEmail = deal.agent_email;
      if (!agentStats[agentEmail]) return;

      if (deal.stage === 'closed_won') {
        agentStats[agentEmail].dealsClosed++;
        agentStats[agentEmail].totalValue += deal.value_aed || 0;
        agentStats[agentEmail].commission += (deal.value_aed || 0) * 0.02;
      } else if (['negotiation', 'offer_made', 'closing'].includes(deal.stage)) {
        agentStats[agentEmail].activeDeals++;
      }
    });

    // Calculate averages and points
    Object.values(agentStats).forEach(agent => {
      agent.avgDealSize = agent.dealsClosed > 0 ? agent.totalValue / agent.dealsClosed : 0;
      
      // Points calculation (gamification)
      agent.points = 
        (agent.dealsClosed * 100) +
        (agent.totalValue / 1000000 * 10) +
        (agent.activeDeals * 20) +
        (agent.commission / 10000);
    });

    // Sort by points
    return Object.values(agentStats)
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);
  }, [deals, users]);

  const topPerformer = leaderboard[0];
  const teamTotal = leaderboard.reduce((sum, a) => sum + a.totalValue, 0);
  const teamDeals = leaderboard.reduce((sum, a) => sum + a.dealsClosed, 0);

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return <Crown className="w-6 h-6 text-amber-400" />;
      case 2: return <Medal className="w-6 h-6 text-slate-400" />;
      case 3: return <Medal className="w-6 h-6 text-amber-600" />;
      default: return <span className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>#{rank}</span>;
    }
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
            <Trophy className="w-6 h-6" style={{ color: 'hsl(38 92% 50%)' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>Team Leaderboard</h2>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Real-time performance rankings</p>
          </div>
        </div>
        <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/50">
          {leaderboard.length} Agents
        </Badge>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
            <span className="text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>Team Revenue</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>AED {(teamTotal / 1000000).toFixed(1)}M</p>
        </div>
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>Deals Closed</span>
          </div>
          <p className="text-2xl font-bold text-emerald-500">{teamDeals}</p>
        </div>
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>Active Agents</span>
          </div>
          <p className="text-2xl font-bold text-blue-500">{leaderboard.filter(a => a.activeDeals > 0 || a.dealsClosed > 0).length}</p>
        </div>
      </div>

      {/* Top Performer Spotlight */}
      {topPerformer && (
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'rgba(245,159,10,0.1)',
            border: '2px solid rgba(245,159,10,0.4)',
          }}
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-amber-500/20">
              <Crown className="w-8 h-8" style={{ color: 'hsl(38 92% 50%)' }} />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>
                🏆 Top Performer: {topPerformer.name}
              </h3>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Leading with {topPerformer.dealsClosed} deals closed • AED {(topPerformer.totalValue / 1000000).toFixed(1)}M volume
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>{Math.round(topPerformer.points)}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Points</p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-4 text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>Rank</th>
                <th className="text-left p-4 text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>Agent</th>
                <th className="text-right p-4 text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>Deals</th>
                <th className="text-right p-4 text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>Volume</th>
                <th className="text-right p-4 text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>Commission</th>
                <th className="text-right p-4 text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>Active</th>
                <th className="text-right p-4 text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>Points</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((agent, i) => (
                <tr key={agent.email} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4 w-16">{getRankIcon(i + 1)}</td>
                  <td className="p-4">
                    <div>
                      <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>{agent.name}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{agent.email}</p>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{agent.dealsClosed}</p>
                  </td>
                  <td className="p-4 text-right">
                    <p className="font-semibold" style={{ color: 'hsl(38 92% 50%)' }}>AED {(agent.totalValue / 1000000).toFixed(1)}M</p>
                  </td>
                  <td className="p-4 text-right">
                    <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>AED {(agent.commission / 1000).toFixed(0)}K</p>
                  </td>
                  <td className="p-4 text-right">
                    <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/50">{agent.activeDeals}</Badge>
                  </td>
                  <td className="p-4 text-right">
                    <p className="font-bold" style={{ color: 'hsl(38 92% 50%)' }}>{Math.round(agent.points)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}