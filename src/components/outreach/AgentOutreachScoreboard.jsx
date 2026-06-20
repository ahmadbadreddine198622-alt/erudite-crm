import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { CheckCircle2, Target, Zap, Users, Loader2 } from 'lucide-react';

const TODAY = new Date().toISOString().slice(0, 10);

export default function AgentOutreachScoreboard() {
  const { user } = useCurrentUser();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['agent-outreach-score', user?.email, TODAY],
    queryFn: () => base44.entities.OutreachChecklist.filter({ agent_email: user.email, outreach_date: TODAY }),
    enabled: !!user?.email,
    refetchInterval: 30000,
  });

  if (!user) return null;

  const totalLandlords = records.length;
  const sequencesComplete = records.filter(r => r.sequence_complete).length;
  const totalSteps = records.reduce((sum, r) => sum + (r.steps_completed || 0), 0);
  const qualifications = records.filter(r => r.qualification_logged).length;
  const reached = records.filter(r => r.reached_landlord).length;

  const stats = [
    { label: 'Landlords Contacted', value: totalLandlords, icon: Users, color: 'text-blue-400', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)' },
    { label: 'Full Sequences', value: sequencesComplete, icon: CheckCircle2, color: 'text-emerald-400', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' },
    { label: 'Steps Done', value: totalSteps, icon: Zap, color: 'text-amber-400', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
    { label: 'Qualifications', value: qualifications, icon: Target, color: 'text-purple-400', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.25)' },
  ];

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem' }}>My Outreach Today</p>
          <p className="text-[10px] text-muted-foreground">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
        </div>
        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {stats.map(({ label, value, icon: Icon, color, bg, border }) => (
          <div key={label} className="rounded-lg p-3 text-center" style={{ background: bg, border: `1px solid ${border}` }}>
            <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
            <p className="text-xl font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.95)' }}>{value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {totalLandlords > 0 && (
        <div className="pt-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Sequence completion rate</span>
            <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {totalLandlords > 0 ? Math.round((sequencesComplete / totalLandlords) * 100) : 0}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: `${totalLandlords > 0 ? (sequencesComplete / totalLandlords) * 100 : 0}%`,
                background: 'linear-gradient(90deg, hsl(152 69% 40%), hsl(152 69% 55%))',
              }}
            />
          </div>
          {reached > 0 && (
            <p className="text-[10px] text-muted-foreground mt-1.5">
              <span className="text-emerald-400 font-semibold">{reached}</span> landlord{reached !== 1 ? 's' : ''} actually reached
            </p>
          )}
        </div>
      )}

      {totalLandlords === 0 && !isLoading && (
        <p className="text-xs text-muted-foreground text-center py-2">No outreach logged yet today. Open a landlord card and tick off the steps.</p>
      )}
    </div>
  );
}