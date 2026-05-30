import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Flame, TrendingUp, Award, Zap, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function PerformanceStreaks() {
  const { data: activities = [] } = useQuery({
    queryKey: ['activities-streaks'],
    queryFn: () => base44.entities.LeadActivity.list('-created_date', 500),
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-streaks'],
    queryFn: () => base44.entities.Lead.list('-created_date', 200),
  });

  const streaks = useMemo(() => {
    const now = new Date();
    const userActivities = activities;

    // Calculate daily activity for last 30 days
    const dailyActivity = {};
    userActivities.forEach(a => {
      const date = new Date(a.created_date).toISOString().split('T')[0];
      dailyActivity[date] = (dailyActivity[date] || 0) + 1;
    });

    // Calculate current streak
    let currentStreak = 0;
    for (let i = 0; i < 30; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      if (dailyActivity[date] && dailyActivity[date] > 0) {
        currentStreak++;
      } else if (i > 0) {
        break;
      }
    }

    // Calculate best streak
    let bestStreak = 0;
    let tempStreak = 0;
    for (let i = 0; i < 30; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      if (dailyActivity[date] && dailyActivity[date] > 0) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    // Deals closed this month
    const thisMonth = now.toISOString().slice(0, 7);
    const dealsClosed = leads.filter(l => 
      l.stage === 'closed_won' && 
      l.updated_date && 
      l.updated_date.startsWith(thisMonth)
    ).length;

    // Response time (avg hours between lead creation and first activity)
    const responseTimes = leads
      .filter(l => l.first_activity_at && l.created_date)
      .map(l => {
        const created = new Date(l.created_date).getTime();
        const firstActivity = new Date(l.first_activity_at).getTime();
        return (firstActivity - created) / (1000 * 60 * 60);
      });
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;

    return {
      current: currentStreak,
      best: bestStreak,
      dealsClosed,
      avgResponseTime: avgResponseTime.toFixed(1),
    };
  }, [activities, leads]);

  if (streaks.current === 0 && streaks.dealsClosed === 0) {
    return null;
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'rgba(255,255,255,0.07)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5" style={{ color: 'hsl(38 92% 50%)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'hsl(38 92% 50%)' }}>Your Performance</h3>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Current Streak */}
        <div
          className="p-3 rounded-xl"
          style={{
            background: streaks.current > 0 ? 'rgba(245,159,10,0.1)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${streaks.current > 0 ? 'rgba(245,159,10,0.3)' : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-3.5 h-3.5" style={{ color: streaks.current > 0 ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.3)' }} />
            <span className="text-[10px] font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>Streak</span>
          </div>
          <p className="text-xl font-bold" style={{ color: streaks.current > 0 ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.4)' }}>
            {streaks.current} <span className="text-xs font-normal">days</span>
          </p>
          {streaks.current > 0 && (
            <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Keep it up! 🔥</p>
          )}
        </div>

        {/* Best Streak */}
        <div
          className="p-3 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>Best</span>
          </div>
          <p className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>
            {streaks.best} <span className="text-xs font-normal">days</span>
          </p>
        </div>

        {/* Deals This Month */}
        <div
          className="p-3 rounded-xl"
          style={{
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.3)',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>Closed</span>
          </div>
          <p className="text-xl font-bold text-emerald-500">
            {streaks.dealsClosed} <span className="text-xs font-normal">deals</span>
          </p>
          <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>This month</p>
        </div>

        {/* Avg Response Time */}
        <div
          className="p-3 rounded-xl"
          style={{
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.3)',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[10px] font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>Response</span>
          </div>
          <p className="text-xl font-bold text-blue-500">
            {streaks.avgResponseTime} <span className="text-xs font-normal">hrs</span>
          </p>
          <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Avg time</p>
        </div>
      </div>
    </div>
  );
}