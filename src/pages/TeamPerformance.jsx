import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Loader2, AlertCircle, TrendingUp, Users, CheckCircle2, Zap, Target, Brain, XCircle } from 'lucide-react';

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
            {/* Agent cards with AI intelligence */}
            <div className="space-y-4">
              {allocations.map((alloc, idx) => {
                const status = alloc.status || 'active';
                const style = STATUS_STYLE[status] || STATUS_STYLE.active;
                const agentName = alloc.agent_name || alloc.agent_email?.split('@')[0] || 'Unknown';
                
                // AI verdict badges
                const showSlacking = alloc.ai_slacking_flag === true;
                const showEarned = alloc.ai_earned_more_leads_verdict === true;
                
                // Target prediction colors
                const TARGET_STYLE = {
                  on_track: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', text: '#34d399', label: 'On Track' },
                  at_risk: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', text: 'hsl(38 92% 55%)', label: 'At Risk' },
                  will_miss: { bg: 'rgba(244,63,94,0.15)', border: 'rgba(244,63,94,0.3)', text: '#f87171', label: 'Will Miss' },
                };
                const targetStyle = TARGET_STYLE[alloc.ai_hit_target_prediction] || TARGET_STYLE.at_risk;

                return (
                  <div
                    key={alloc.id}
                    className="rounded-xl p-6 transition-all hover:scale-[1.01]"
                    style={{
                      background: idx % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.04)',
                      border: showSlacking ? '2px solid rgba(244,63,94,0.4)' : showEarned ? '2px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    {/* Header: Agent name + AI verdict badges */}
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: 'hsl(38 92% 55%)' }}>
                          {agentName[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 flex-wrap mb-1">
                            <h3 className="text-2xl font-display font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>
                              {agentName}
                            </h3>
                            {/* AI Verdict Badges */}
                            {showSlacking && (
                              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-base font-bold" style={{ background: 'rgba(244,63,94,0.2)', border: '2px solid rgba(244,63,94,0.5)', color: '#f87171' }}>
                                <XCircle className="w-5 h-5" />
                                ⚠ SLACKING
                              </span>
                            )}
                            {showEarned && (
                              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-base font-bold" style={{ background: 'rgba(16,185,129,0.2)', border: '2px solid rgba(16,185,129,0.5)', color: '#34d399' }}>
                                <CheckCircle2 className="w-5 h-5" />
                                ✓ EARNED MORE LEADS
                              </span>
                            )}
                            {/* Target Prediction */}
                            {alloc.ai_hit_target_prediction && (
                              <span
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-base font-bold"
                                style={{ background: targetStyle.bg, border: `2px solid ${targetStyle.border}`, color: targetStyle.text }}
                              >
                                <Target className="w-5 h-5" />
                                {targetStyle.label}
                              </span>
                            )}
                          </div>
                          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{alloc.agent_email}</p>
                        </div>
                      </div>
                      
                      {/* Status badge */}
                      <span
                        className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-bold shrink-0"
                        style={{
                          background: style.bg,
                          border: `1px solid ${style.border}`,
                          color: style.text,
                        }}
                      >
                        {style.label}
                      </span>
                    </div>

                    {/* AI Intelligence Section */}
                    {alloc.ai_slacking_reason || alloc.ai_coaching_note || alloc.ai_agent_rolling_summary ? (
                      <div className="mt-4 p-5 rounded-xl" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)' }}>
                        <div className="flex items-center gap-2 mb-3">
                          <Brain className="w-5 h-5" style={{ color: 'rgb(167,139,250)' }} />
                          <h4 className="text-lg font-semibold" style={{ color: 'rgb(167,139,250)' }}>AI Intelligence</h4>
                        </div>
                        
                        <div className="space-y-3">
                          {/* Slacking Reason */}
                          {alloc.ai_slacking_reason && (
                            <div>
                              <p className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                {showSlacking ? '⚠ Issue Detected' : 'Performance Note'}
                              </p>
                              <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
                                {alloc.ai_slacking_reason}
                              </p>
                            </div>
                          )}
                          
                          {/* Coaching Note */}
                          {alloc.ai_coaching_note && (
                            <div>
                              <p className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                📋 Coaching
                              </p>
                              <p className="text-base font-medium leading-relaxed" style={{ color: 'hsl(38 92% 60%)' }}>
                                {alloc.ai_coaching_note}
                              </p>
                            </div>
                          )}
                          
                          {/* Rolling Summary */}
                          {alloc.ai_agent_rolling_summary && (
                            <div>
                              <p className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                📊 Performance Summary
                              </p>
                              <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
                                {alloc.ai_agent_rolling_summary}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 p-4 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          No AI intelligence generated yet. Run the daily automation or wait for 2pm processing.
                        </p>
                      </div>
                    )}

                    {/* Performance Metrics Row */}
                    <div className="mt-4 grid grid-cols-4 gap-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      <div className="text-center">
                        <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Leads Worked</p>
                        <p className="text-2xl font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.9)' }}>{alloc.leads_worked || 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Sequences</p>
                        <p className="text-2xl font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.9)' }}>{alloc.sequences_completed || 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Qualifications</p>
                        <p className="text-2xl font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.9)' }}>{alloc.qualifications_logged || 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Daily Score</p>
                        <p className="text-2xl font-bold tabular-nums" style={{ color: 'hsl(38 92% 55%)' }}>{alloc.daily_score || 0}</p>
                      </div>
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