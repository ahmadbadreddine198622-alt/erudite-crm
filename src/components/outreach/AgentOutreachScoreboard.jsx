import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { CheckCircle2, Lock, Unlock, Zap, Target, Loader2, Trophy, Gift } from 'lucide-react';

const TODAY = new Date().toISOString().slice(0, 10);

export default function AgentOutreachScoreboard() {
  const { user } = useCurrentUser();

  const { data: allocation, isLoading } = useQuery({
    queryKey: ['daily-allocation', user?.email, TODAY],
    queryFn: async () => {
      const rows = await base44.entities.DailyLeadAllocation.filter({
        agent_email: user.email,
        allocation_date: TODAY,
      });
      return rows?.[0] ?? null;
    },
    enabled: !!user?.email,
    refetchInterval: 30000,
  });

  if (!user) return null;

  const base = allocation?.base_allocation ?? 10;
  const leadsWorked = allocation?.leads_worked ?? 0;
  const sequencesDone = allocation?.sequences_completed ?? 0;
  const bonus = allocation?.bonus_earned ?? 0;
  const total = allocation?.total_available ?? base;
  const qualifications = allocation?.qualifications_logged ?? 0;
  const earned = allocation?.earned_more_leads ?? false;
  const status = allocation?.status ?? 'active';
  const completionRate = allocation?.completion_rate ?? 0;

  const remaining = Math.max(0, base - leadsWorked);
  const pct = Math.min(100, Math.round((leadsWorked / base) * 100));

  const statusColor = status === 'completed' ? '#34d399'
    : status === 'underperforming' ? '#f87171'
    : 'hsl(38 92% 55%)';

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
      {/* Top bar */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem' }}>Today's Lead Allocation</p>
          <p className="text-[10px] text-muted-foreground">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          {!isLoading && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: status === 'completed' ? 'rgba(16,185,129,0.15)' : status === 'underperforming' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: statusColor }}>
              {status === 'completed' ? '✓ Completed' : status === 'underperforming' ? '⚠ Underperforming' : '● Active'}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
        {/* Main unlock mechanic */}
        <div>
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-3xl font-bold tabular-nums" style={{ color: statusColor }}>
                {leadsWorked}<span className="text-lg text-muted-foreground font-normal">/{base}</span>
              </p>
              <p className="text-xs text-muted-foreground">sequences completed today</p>
            </div>
            <div className="text-right">
              {earned ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <Unlock className="w-4 h-4 text-emerald-400" />
                  <div>
                    <p className="text-xs font-bold text-emerald-400">+{bonus} bonus leads</p>
                    <p className="text-[10px] text-emerald-500">Unlocked!</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{remaining} more to unlock</p>
                    <p className="text-[10px] text-muted-foreground">bonus leads</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: pct >= 100
                  ? 'linear-gradient(90deg, hsl(152 69% 40%), hsl(152 69% 55%))'
                  : 'linear-gradient(90deg, hsl(38 92% 45%), hsl(38 92% 60%))',
              }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            {pct < 100
              ? `Complete your ${base} to unlock bonus leads`
              : `All ${base} done — ${bonus > 0 ? `+${bonus} bonus leads available` : 'bonus calculation pending'}`}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total Available', value: total, icon: Gift, color: 'text-amber-400', note: `${base} base${bonus > 0 ? ` +${bonus}` : ''}` },
            { label: 'Sequences', value: sequencesDone, icon: Zap, color: 'text-blue-400', note: `of ${base}` },
            { label: 'Qualifications', value: qualifications, icon: Target, color: 'text-purple-400', note: 'logged' },
            { label: 'Completion', value: `${completionRate}%`, icon: Trophy, color: 'text-emerald-400', note: 'rate' },
          ].map(({ label, value, icon: Icon, color, note }) => (
            <div key={label} className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Icon className={`w-3.5 h-3.5 mx-auto mb-1 ${color}`} />
              <p className="text-base font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.9)' }}>{value}</p>
              <p className="text-[9px] text-muted-foreground">{label}</p>
              <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{note}</p>
            </div>
          ))}
        </div>

        {!isLoading && !allocation && (
          <p className="text-xs text-muted-foreground text-center py-1">
            No allocation set for today yet. Start outreach to generate your record.
          </p>
        )}
      </div>
    </div>
  );
}