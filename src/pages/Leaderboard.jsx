import React from 'react';
import PageHeader from '@/components/shared/PageHeader';
import Leaderboard from '@/components/team/Leaderboard';

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-[140rem] mx-auto space-y-6">
        <PageHeader
          title="Team Leaderboard"
          subtitle="Real-time performance rankings and gamification"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-500 font-semibold flex items-center gap-1">
              🏆 Team Competition
            </span>
          </div>
        </PageHeader>

        <div
          className="rounded-2xl p-6"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <Leaderboard />
        </div>
      </div>
    </div>
  );
}