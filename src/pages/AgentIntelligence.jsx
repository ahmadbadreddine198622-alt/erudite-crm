import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Loader2, AlertCircle, TrendingUp, Users, CheckCircle2, Target, Brain, XCircle, Zap } from 'lucide-react';

const TODAY = new Date().toISOString().slice(0, 10);

export default function AgentIntelligence() {
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

  return (
    <div className="min-h-screen p-6" style={{ background: 'hsl(222 47% 9%)' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl font-display font-bold mb-2" style={{ color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.02em' }}>
            Agent Intelligence
          </h1>
          <p className="text-xl" style={{ color: 'rgba(255,255,255,0.5)' }}>
            AI-powered performance insights · {TODAY}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : allocations.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg" style={{ color: 'rgba(255,255,255,0.6)' }}>No AI intelligence data for today</p>
            <p className="text-sm text-muted-foreground mt-2">Agent intelligence is generated daily at 2pm. Check back later.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {allocations.map((alloc) => {
              const agentName = alloc.agent_name || alloc.agent_email?.split('@')[0] || 'Unknown';
              const showSlacking = alloc.ai_slacking_flag === true;
              const showEarned = alloc.ai_earned_more_leads_verdict === true;
              
              // Target prediction colors
              const TARGET_STYLE = {
                on_track: { bg: 'rgba(16,185,129,0.2)', border: 'rgba(16,185,129,0.5)', text: '#34d399', label: 'On Track' },
                at_risk: { bg: 'rgba(245,158,11,0.2)', border: 'rgba(245,158,11,0.5)', text: 'hsl(38 92% 55%)', label: 'At Risk' },
                will_miss: { bg: 'rgba(244,63,94,0.2)', border: 'rgba(244,63,94,0.5)', text: '#f87171', label: 'Will Miss' },
              };
              const targetStyle = TARGET_STYLE[alloc.ai_hit_target_prediction] || TARGET_STYLE.at_risk;

              return (
                <div
                  key={alloc.id}
                  className="rounded-2xl p-8 transition-all hover:scale-[1.01]"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: showSlacking ? '3px solid rgba(244,63,94,0.5)' : showEarned ? '3px solid rgba(16,185,129,0.5)' : '2px solid rgba(255,255,255,0.1)',
                    boxShadow: showSlacking ? '0 0 40px rgba(244,63,94,0.2)' : showEarned ? '0 0 40px rgba(16,185,129,0.2)' : 'none',
                  }}
                >
                  {/* Header: Agent name + score + verdict badges */}
                  <div className="flex items-start justify-between gap-6 mb-6">
                    <div className="flex items-center gap-5 flex-1">
                      <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: 'hsl(38 92% 55%)' }}>
                        {agentName[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-4 flex-wrap mb-2">
                          <h2 className="text-4xl font-display font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>
                            {agentName}
                          </h2>
                          {/* Daily Score */}
                          <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.15)', border: '2px solid rgba(245,158,11,0.4)' }}>
                            <TrendingUp className="w-6 h-6" style={{ color: 'hsl(38 92% 55%)' }} />
                            <span className="text-2xl font-bold" style={{ color: 'hsl(38 92% 55%)' }}>
                              {alloc.daily_score || 0}
                            </span>
                          </div>
                        </div>
                        <p className="text-base" style={{ color: 'rgba(255,255,255,0.5)' }}>{alloc.agent_email}</p>
                      </div>
                    </div>
                    
                    {/* Verdict Badges */}
                    <div className="flex flex-col gap-3 shrink-0">
                      {showSlacking && (
                        <span className="inline-flex items-center gap-3 px-6 py-3 rounded-xl text-lg font-bold" style={{ background: 'rgba(244,63,94,0.25)', border: '3px solid rgba(244,63,94,0.6)', color: '#f87171' }}>
                          <XCircle className="w-7 h-7" />
                          ⚠ SLACKING
                        </span>
                      )}
                      {showEarned && (
                        <span className="inline-flex items-center gap-3 px-6 py-3 rounded-xl text-lg font-bold" style={{ background: 'rgba(16,185,129,0.25)', border: '3px solid rgba(16,185,129,0.6)', color: '#34d399' }}>
                          <CheckCircle2 className="w-7 h-7" />
                          ✓ EARNED MORE LEADS
                        </span>
                      )}
                      {alloc.ai_hit_target_prediction && (
                        <span
                          className="inline-flex items-center gap-3 px-6 py-3 rounded-xl text-lg font-bold"
                          style={{ background: targetStyle.bg, border: `3px solid ${targetStyle.border}`, color: targetStyle.text }}
                        >
                          <Target className="w-7 h-7" />
                          {targetStyle.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* AI Intelligence Section */}
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    {/* Left column: Why + Coaching */}
                    <div className="space-y-4">
                      {/* Why - Slacking Reason */}
                      {alloc.ai_slacking_reason && (
                        <div className="p-5 rounded-xl" style={{ background: 'rgba(244,63,94,0.1)', border: '2px solid rgba(244,63,94,0.3)' }}>
                          <p className="text-sm uppercase tracking-wider font-semibold mb-2" style={{ color: '#f87171' }}>
                            ⚠ Why
                          </p>
                          <p className="text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.9)' }}>
                            {alloc.ai_slacking_reason}
                          </p>
                        </div>
                      )}
                      
                      {/* Coaching */}
                      {alloc.ai_coaching_note && (
                        <div className="p-5 rounded-xl" style={{ background: 'rgba(245,158,11,0.1)', border: '2px solid rgba(245,158,11,0.3)' }}>
                          <p className="text-sm uppercase tracking-wider font-semibold mb-2" style={{ color: 'hsl(38 92% 55%)' }}>
                            📋 Coaching
                          </p>
                          <p className="text-lg font-medium leading-relaxed" style={{ color: 'rgba(255,255,255,0.9)' }}>
                            {alloc.ai_coaching_note}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right column: Target + Summary */}
                    <div className="space-y-4">
                      {/* Target Prediction */}
                      {alloc.ai_hit_target_prediction && (
                        <div className="p-5 rounded-xl" style={{ background: targetStyle.bg, border: `2px solid ${targetStyle.border}` }}>
                          <p className="text-sm uppercase tracking-wider font-semibold mb-2" style={{ color: targetStyle.text }}>
                            🎯 Target
                          </p>
                          <p className="text-2xl font-bold" style={{ color: targetStyle.text }}>
                            {targetStyle.label.toUpperCase()}
                          </p>
                          {alloc.ai_target_reasoning && (
                            <p className="text-base mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
                              {alloc.ai_target_reasoning}
                            </p>
                          )}
                        </div>
                      )}
                      
                      {/* Summary */}
                      {alloc.ai_agent_rolling_summary && (
                        <div className="p-5 rounded-xl" style={{ background: 'rgba(139,92,246,0.1)', border: '2px solid rgba(139,92,246,0.3)' }}>
                          <p className="text-sm uppercase tracking-wider font-semibold mb-2" style={{ color: 'rgb(167,139,250)' }}>
                            📊 Summary
                          </p>
                          <p className="text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.9)' }}>
                            {alloc.ai_agent_rolling_summary}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Performance Numbers */}
                  <div className="grid grid-cols-3 gap-6 pt-6 border-t-2" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Users className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.5)' }} />
                        <p className="text-sm uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Leads Worked</p>
                      </div>
                      <p className="text-4xl font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.95)' }}>{alloc.leads_worked || 0}</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <CheckCircle2 className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.5)' }} />
                        <p className="text-sm uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Sequences</p>
                      </div>
                      <p className="text-4xl font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.95)' }}>{alloc.sequences_completed || 0}</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Target className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.5)' }} />
                        <p className="text-sm uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Qualifications</p>
                      </div>
                      <p className="text-4xl font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.95)' }}>{alloc.qualifications_logged || 0}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}