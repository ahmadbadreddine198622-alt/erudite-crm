import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { CheckCircle2, AlertTriangle, Trophy, Loader2, Gift, Target, Zap, TrendingUp, Lock, Unlock } from 'lucide-react';

const TODAY = new Date().toISOString().slice(0, 10);

function getInitials(name = '', email = '') {
  if (name) return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return email.split('@')[0].slice(0, 2).toUpperCase();
}

function getRankStyle(idx) {
  if (idx === 0) return { ring: 'rgba(245,158,11,0.5)', bg: 'rgba(245,158,11,0.08)', badge: '#f59e0b', label: '🥇' };
  if (idx === 1) return { ring: 'rgba(148,163,184,0.4)', bg: 'rgba(148,163,184,0.06)', badge: '#94a3b8', label: '🥈' };
  if (idx === 2) return { ring: 'rgba(180,83,9,0.4)', bg: 'rgba(180,83,9,0.06)', badge: '#b45309', label: '🥉' };
  return { ring: 'rgba(255,255,255,0.08)', bg: 'rgba(255,255,255,0.02)', badge: 'rgba(255,255,255,0.3)', label: `#${idx + 1}` };
}

export default function OutreachLeaderboard() {
  const { user } = useCurrentUser();

  const { data: allocations = [], isLoading } = useQuery({
    queryKey: ['outreach-leaderboard-alloc', TODAY],
    queryFn: () => base44.entities.DailyLeadAllocation.filter({ allocation_date: TODAY }),
    enabled: user?.role === 'admin',
    refetchInterval: 60000,
  });

  if (!user) return null;
  if (user.role !== 'admin') {
    return (
      <div className="page-root flex items-center justify-center min-h-[40vh]">
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  // Sort: completed first, then by sequences desc, then leads_worked desc
  const sorted = [...allocations].sort((a, b) => {
    if (a.earned_more_leads && !b.earned_more_leads) return -1;
    if (!a.earned_more_leads && b.earned_more_leads) return 1;
    if ((b.sequences_completed || 0) !== (a.sequences_completed || 0))
      return (b.sequences_completed || 0) - (a.sequences_completed || 0);
    return (b.leads_worked || 0) - (a.leads_worked || 0);
  });

  const totalAgents = sorted.length;
  const completedCount = sorted.filter(a => a.status === 'completed' || a.earned_more_leads).length;
  const underperformingCount = sorted.filter(a => a.status === 'underperforming').length;
  const totalQuals = sorted.reduce((s, a) => s + (a.qualifications_logged || 0), 0);

  return (
    <div className="page-root space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Trophy className="w-6 h-6 text-amber-400 shrink-0" />
        <div>
          <h1 className="page-title text-2xl">Daily Outreach Command</h1>
          <p className="page-subtitle">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Team summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Agents', value: totalAgents, icon: TrendingUp, color: 'text-blue-400', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)' },
          { label: 'Allocation Complete', value: completedCount, icon: CheckCircle2, color: 'text-emerald-400', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' },
          { label: 'Underperforming', value: underperformingCount, icon: AlertTriangle, color: 'text-red-400', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)' },
          { label: 'Qualifications', value: totalQuals, icon: Target, color: 'text-purple-400', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.25)' },
        ].map(({ label, value, icon: Icon, color, bg, border }) => (
          <div key={label} className="glass-card p-4 text-center" style={{ background: bg, border: `1px solid ${border}` }}>
            <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
            <p className="text-2xl font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.95)' }}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && sorted.length === 0 && (
        <div className="glass-card p-10 text-center">
          <p className="text-muted-foreground">No allocations for today yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Records are created when agents log outreach.</p>
        </div>
      )}

      {/* Agent cards */}
      {sorted.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.68rem' }}>Agent Rankings</p>
          {sorted.map((alloc, idx) => {
            const style = getRankStyle(idx);
            const base = alloc.base_allocation ?? 10;
            const worked = alloc.leads_worked ?? 0;
            const pct = Math.min(100, Math.round((worked / base) * 100));
            const isComplete = alloc.earned_more_leads || alloc.status === 'completed';
            const isUnder = alloc.status === 'underperforming';

            return (
              <div key={alloc.id} className="rounded-xl p-4 space-y-3"
                style={{ background: style.bg, border: `1px solid ${style.ring}` }}>
                <div className="flex items-center gap-3">
                  {/* Rank badge */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-base" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${style.ring}` }}>
                    <span>{style.label}</span>
                  </div>

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent shrink-0 border border-accent/30">
                    {getInitials(alloc.agent_name, alloc.agent_email)}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
                      {alloc.agent_name || alloc.agent_email?.split('@')[0]}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{alloc.agent_email}</p>
                  </div>

                  {/* Status chip */}
                  {isComplete ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg shrink-0" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
                      <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-semibold text-emerald-400">
                        {alloc.bonus_earned > 0 ? `+${alloc.bonus_earned} bonus` : 'Complete'}
                      </span>
                    </div>
                  ) : isUnder ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg shrink-0" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-xs font-semibold text-red-400">Underperforming</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg shrink-0" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{Math.max(0, base - worked)} to go</span>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>{worked}/{base} sequences</span>
                    <span className="font-semibold" style={{ color: isComplete ? '#34d399' : isUnder ? '#f87171' : 'rgba(255,255,255,0.5)' }}>{pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-2 rounded-full transition-all duration-500" style={{
                      width: `${pct}%`,
                      background: isComplete ? 'linear-gradient(90deg,hsl(152 69% 40%),hsl(152 69% 55%))' : isUnder ? 'rgba(239,68,68,0.7)' : 'linear-gradient(90deg,hsl(38 92% 45%),hsl(38 92% 60%))',
                    }} />
                  </div>
                </div>

                {/* Key metrics */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Total Leads', value: alloc.total_available ?? base, icon: Gift, color: 'text-amber-400' },
                    { label: 'Sequences', value: alloc.sequences_completed ?? 0, icon: Zap, color: 'text-blue-400' },
                    { label: 'Qualified', value: alloc.qualifications_logged ?? 0, icon: Target, color: 'text-purple-400' },
                    { label: 'Score', value: alloc.daily_score ?? 0, icon: Trophy, color: 'text-emerald-400' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="rounded-md p-2 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <Icon className={`w-3 h-3 mx-auto mb-0.5 ${color}`} />
                      <p className="text-sm font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.85)' }}>{value}</p>
                      <p className="text-[9px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Manager note */}
                {alloc.notes && (
                  <p className="text-[10px] px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)' }}>
                    📝 {alloc.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}