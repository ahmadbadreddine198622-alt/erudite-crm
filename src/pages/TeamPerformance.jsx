import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Loader2, AlertCircle, TrendingUp, Users, CheckCircle2, Zap, Target } from 'lucide-react';

const TODAY = new Date().toISOString().slice(0, 10);

export default function TeamPerformance() {
  const { user, isAdmin, isLoading: userLoading } = useCurrentUser();

  // Fetch all allocations for today
  const { data: allocations = [], isLoading } = useQuery({
    queryKey: ['daily-allocations-all', TODAY],
    queryFn: async () => {
      const rows = await base44.entities.DailyLeadAllocation.filter({ allocation_date: TODAY });
      // Sort by daily_score descending
      return (rows || []).sort((a, b) => (b.daily_score || 0) - (a.daily_score || 0));
    },
    enabled: !!isAdmin,
  });

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-xl p-8 text-center" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)' }}>
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h1>
            <p className="text-muted-foreground">This page is only visible to admin users.</p>
          </div>
        </div>
      </div>
    );
  }

  const STATUS_STYLE = {
    completed: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', text: '#34d399', label: 'Completed' },
    active: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: 'hsl(38 92% 55%)', label: 'Active' },
    underperforming: { bg: 'rgba(244,63,94,0.1)', border: 'rgba(244,63,94,0.3)', text: '#f87171', label: 'Underperforming' },
  };

  return (
    <div className="min-h-screen p-6" style={{ background: 'hsl(222 47% 9%)' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold mb-2" style={{ color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.02em' }}>
            Team Performance — Today
          </h1>
          <p className="text-lg" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {allocations.length} agents · {TODAY}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : allocations.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg" style={{ color: 'rgba(255,255,255,0.6)' }}>No allocations recorded for today</p>
            <p className="text-sm text-muted-foreground mt-2">Daily allocations will appear once agents start their outreach.</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {/* Table header */}
            <div className="grid grid-cols-7 gap-4 px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
              <div className="col-span-2">Agent</div>
              <div className="text-center">Leads Worked</div>
              <div className="text-center">Sequences</div>
              <div className="text-center">Qualifications</div>
              <div className="text-center">Daily Score</div>
              <div className="text-center">Leads Unlocked</div>
              <div className="text-center">Status</div>
            </div>

            {/* Table body */}
            <div className="divide-y divide-white/5">
              {allocations.map((alloc, idx) => {
                const status = alloc.status || 'active';
                const style = STATUS_STYLE[status] || STATUS_STYLE.active;
                const totalLeads = alloc.total_available || alloc.base_allocation || 0;
                const unlocked = alloc.leads_unlocked_count || 0;

                return (
                  <div
                    key={alloc.id}
                    className="grid grid-cols-7 gap-4 px-6 py-5 items-center hover:bg-white/5 transition-colors"
                    style={idx % 2 === 0 ? {} : { background: 'rgba(255,255,255,0.02)' }}
                  >
                    {/* Agent name */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: 'hsl(38 92% 55%)' }}>
                          {(alloc.agent_name || alloc.agent_email || '?')[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                            {alloc.agent_name || alloc.agent_email?.split('@')[0] || 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground">{alloc.agent_email}</p>
                        </div>
                      </div>
                    </div>

                    {/* Leads worked */}
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-lg font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.85)' }}>
                          {alloc.leads_worked || 0}
                        </span>
                      </div>
                    </div>

                    {/* Sequences completed */}
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-lg font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.85)' }}>
                          {alloc.sequences_completed || 0}
                        </span>
                      </div>
                    </div>

                    {/* Qualifications logged */}
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Target className="w-4 h-4 text-muted-foreground" />
                        <span className="text-lg font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.85)' }}>
                          {alloc.qualifications_logged || 0}
                        </span>
                      </div>
                    </div>

                    {/* Daily score */}
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <TrendingUp className="w-4 h-4" style={{ color: 'hsl(38 92% 55%)' }} />
                        <span className="text-xl font-bold tabular-nums" style={{ color: 'hsl(38 92% 55%)' }}>
                          {alloc.daily_score || 0}
                        </span>
                      </div>
                    </div>

                    {/* Leads unlocked */}
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Zap className="w-4 h-4 text-muted-foreground" />
                        <span className="text-lg font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.85)' }}>
                          {unlocked} <span className="text-sm text-muted-foreground">/ {totalLeads}</span>
                        </span>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="text-center">
                      <span
                        className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-bold"
                        style={{
                          background: style.bg,
                          border: `1px solid ${style.border}`,
                          color: style.text,
                        }}
                      >
                        {style.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer summary */}
        {allocations.length > 0 && (
          <div className="mt-8 grid grid-cols-4 gap-4">
            {[
              { label: 'Total Agents', value: allocations.length, icon: Users },
              { label: 'Avg Daily Score', value: Math.round(allocations.reduce((sum, a) => sum + (a.daily_score || 0), 0) / allocations.length), icon: TrendingUp },
              { label: 'Total Sequences', value: allocations.reduce((sum, a) => sum + (a.sequences_completed || 0), 0), icon: CheckCircle2 },
              { label: 'Total Qualifications', value: allocations.reduce((sum, a) => sum + (a.qualifications_logged || 0), 0), icon: Target },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-3 mb-2">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
                </div>
                <p className="text-3xl font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}