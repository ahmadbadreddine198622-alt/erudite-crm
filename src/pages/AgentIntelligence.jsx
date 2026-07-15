import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Loader2, AlertCircle, TrendingUp, Users, CheckCircle2, Target, Brain, XCircle, Zap, Building2 } from 'lucide-react';
import ReadAloudButton from '@/components/shared/ReadAloudButton';

const TODAY = new Date().toISOString().slice(0, 10);

// Exact design tokens from Landlord Pipeline
const DESIGN_TOKENS = {
  bg: 'radial-gradient(ellipse at 20% 20%, #1a2a4a 0%, #0F1419 45%, #121821 100%)',
  cardBg: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.1)',
  gold: 'hsl(38 92% 50%)',
  goldBg: 'rgba(245,158,11,0.15)',
  goldBorder: 'rgba(245,158,11,0.4)',
  emerald: 'rgba(16,185,129,0.15)',
  emeraldBorder: 'rgba(16,185,129,0.5)',
  emeraldText: '#34d399',
  red: 'rgba(244,63,94,0.15)',
  redBorder: 'rgba(244,63,94,0.5)',
  redText: '#f87171',
  purple: 'rgba(139,92,246,0.1)',
  purpleBorder: 'rgba(139,92,246,0.3)',
  purpleText: 'rgb(167,139,250)',
};

export default function AgentIntelligence() {
  const { user, isAdmin, isLoading: userLoading } = useCurrentUser();

  // Fetch all allocations for today
  const { data: allocations = [], isLoading } = useQuery({
    queryKey: ['daily-allocations-all', TODAY],
    queryFn: async () => {
      const rows = await base44.entities.DailyLeadAllocation.filter({ allocation_date: TODAY });
      return (rows || []).sort((a, b) => (b.daily_score || 0) - (a.daily_score || 0));
    },
    enabled: !!isAdmin,
  });

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-muted-foreground">Loading Agent Intelligence...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-xl p-8 text-center" style={{ background: DESIGN_TOKENS.red, border: `1px solid ${DESIGN_TOKENS.redBorder}` }}>
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h1>
            <p className="text-muted-foreground">This page is only visible to admin users.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-[100dvh] w-full flex flex-col overflow-hidden"
      style={{ background: DESIGN_TOKENS.bg }}
    >
      {/* Header — single slim sticky toolbar row, matching Landlord Pipeline */}
      <div className="shrink-0 sticky top-0 z-20 pt-3 pb-2" style={{ paddingLeft: '4rem', paddingRight: '0.5rem' }}>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Title + icon */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.08))', border: '1px solid rgba(245,158,11,0.3)' }}>
              <Building2 className="w-4 h-4" style={{ color: DESIGN_TOKENS.gold }} />
            </div>
            <h1 className="text-lg font-bold page-title whitespace-nowrap">Agent Intelligence</h1>
          </div>

          {/* Inline stat — icon + value, no card */}
          <div className="flex items-center gap-1.5 shrink-0 px-2.5 h-9 rounded-md"
            style={{ background: DESIGN_TOKENS.goldBg, border: `1px solid ${DESIGN_TOKENS.goldBorder.replace('0.4', '0.22')}` }}>
            <TrendingUp className="w-3.5 h-3.5" style={{ color: DESIGN_TOKENS.gold }} />
            <span className="text-sm font-bold tabular-nums" style={{ color: DESIGN_TOKENS.gold }}>
              {allocations.length} agent{allocations.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Date pill */}
          <div className="flex items-center gap-1.5 shrink-0 px-2.5 h-9 rounded-md text-xs font-semibold"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)' }}>
            <Brain className="w-3.5 h-3.5" />
            {TODAY}
          </div>
        </div>

        {/* Curved "valley" divider */}
        <div className="w-full mt-3 -mb-1 pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 1200 24" preserveAspectRatio="none" className="w-full h-3 block">
            <defs>
              <linearGradient id="valley-fade" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={DESIGN_TOKENS.gold} stopOpacity="0" />
                <stop offset="50%" stopColor={DESIGN_TOKENS.gold} stopOpacity="0.55" />
                <stop offset="100%" stopColor={DESIGN_TOKENS.gold} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 4 Q 600 28 1200 4" fill="none" stroke="url(#valley-fade)" strokeWidth="1.5" />
          </svg>
        </div>
      </div>

      {/* Content — fills remaining height, scrolls freely in both directions */}
      <div className="flex-1 min-h-0 overflow-auto pb-4" style={{ paddingLeft: '4rem', paddingRight: '0.5rem' }}>
        <style>{`
          .intelligence-scroll { 
            scrollbar-width: thin; 
            scrollbar-color: hsl(38 92% 50% / 0.5) transparent; 
            scroll-behavior: smooth; 
          }
          .intelligence-scroll::-webkit-scrollbar { 
            width: 10px; 
            height: 10px; 
          }
          .intelligence-scroll::-webkit-scrollbar-track { 
            background: rgba(255,255,255,0.04); 
            border-radius: 99px; 
          }
          .intelligence-scroll::-webkit-scrollbar-thumb { 
            background: hsl(38 92% 50% / 0.45); 
            border-radius: 99px; 
          }
          .intelligence-scroll::-webkit-scrollbar-thumb:hover { 
            background: hsl(38 92% 50% / 0.7); 
          }
        `}</style>

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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 intelligence-scroll">
            {allocations.map((alloc) => {
              const agentName = alloc.agent_name || alloc.agent_email?.split('@')[0] || 'Unknown';
              const showSlacking = alloc.ai_slacking_flag === true;
              const showEarned = alloc.ai_earned_more_leads_verdict === true;
              
              const TARGET_STYLE = {
                on_track: { bg: DESIGN_TOKENS.emerald, border: DESIGN_TOKENS.emeraldBorder, text: DESIGN_TOKENS.emeraldText, label: 'On Track' },
                at_risk: { bg: DESIGN_TOKENS.goldBg, border: DESIGN_TOKENS.goldBorder, text: DESIGN_TOKENS.gold, label: 'At Risk' },
                will_miss: { bg: DESIGN_TOKENS.red, border: DESIGN_TOKENS.redBorder, text: DESIGN_TOKENS.redText, label: 'Will Miss' },
              };
              const targetStyle = TARGET_STYLE[alloc.ai_hit_target_prediction] || TARGET_STYLE.at_risk;

              return (
                <div
                  key={alloc.id}
                  className="rounded-2xl p-6 transition-all hover:shadow-lg"
                  style={{
                    background: DESIGN_TOKENS.cardBg,
                    border: showSlacking ? `3px solid ${DESIGN_TOKENS.redBorder}` : showEarned ? `3px solid ${DESIGN_TOKENS.emeraldBorder}` : `2px solid ${DESIGN_TOKENS.cardBorder}`,
                    boxShadow: showSlacking ? `0 0 40px ${DESIGN_TOKENS.red.replace('0.15', '0.1')}` : showEarned ? `0 0 40px ${DESIGN_TOKENS.emerald.replace('0.15', '0.1')}` : 'none',
                  }}
                >
                  {/* Header: Agent name + score + verdict badges */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0" style={{ background: DESIGN_TOKENS.goldBg, color: DESIGN_TOKENS.gold }}>
                        {agentName[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h2 className="text-xl font-display font-bold truncate" style={{ color: 'rgba(255,255,255,0.95)' }}>
                            {agentName}
                          </h2>
                          {/* Daily Score badge — exact Landlord Pipeline style */}
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md shrink-0" style={{ background: DESIGN_TOKENS.goldBg, border: `2px solid ${DESIGN_TOKENS.goldBorder}` }}>
                            <TrendingUp className="w-4 h-4" style={{ color: DESIGN_TOKENS.gold }} />
                            <span className="text-lg font-bold" style={{ color: DESIGN_TOKENS.gold }}>
                              {alloc.daily_score || 0}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>{alloc.agent_email}</p>
                      </div>
                    </div>
                    
                    {/* Verdict Badges — stacked vertically */}
                    <div className="flex flex-col gap-2 shrink-0">
                      {showSlacking && (
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold" style={{ background: DESIGN_TOKENS.red, border: `3px solid ${DESIGN_TOKENS.redBorder.replace('0.5', '0.6')}`, color: DESIGN_TOKENS.redText }}>
                          <XCircle className="w-5 h-5" />
                          ⚠ SLACKING
                        </span>
                      )}
                      {showEarned && (
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold" style={{ background: DESIGN_TOKENS.emerald, border: `3px solid ${DESIGN_TOKENS.emeraldBorder.replace('0.5', '0.6')}`, color: DESIGN_TOKENS.emeraldText }}>
                          <CheckCircle2 className="w-5 h-5" />
                          ✓ EARNED
                        </span>
                      )}
                      {alloc.ai_hit_target_prediction && (
                        <span
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
                          style={{ background: targetStyle.bg, border: `3px solid ${targetStyle.border}`, color: targetStyle.text }}
                        >
                          <Target className="w-5 h-5" />
                          {targetStyle.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* AI Intelligence Section — 2 columns */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {/* Left: Why + Coaching */}
                    <div className="space-y-2">
                      {alloc.ai_slacking_reason && (
                        <div className="p-3 rounded-xl" style={{ background: DESIGN_TOKENS.red, border: `2px solid ${DESIGN_TOKENS.redBorder.replace('0.5', '0.3')}` }}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: DESIGN_TOKENS.redText }}>
                              ⚠ Why
                            </p>
                            <ReadAloudButton text={alloc.ai_slacking_reason} title={`Why: ${agentName}`} size={12} />
                          </div>
                          <p className="text-sm leading-tight" style={{ color: 'rgba(255,255,255,0.9)' }}>
                            {alloc.ai_slacking_reason}
                          </p>
                        </div>
                      )}
                      
                      {alloc.ai_coaching_note && (
                        <div className="p-3 rounded-xl" style={{ background: DESIGN_TOKENS.goldBg, border: `2px solid ${DESIGN_TOKENS.goldBorder.replace('0.4', '0.3')}` }}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: DESIGN_TOKENS.gold }}>
                              📋 Coaching
                            </p>
                            <ReadAloudButton text={alloc.ai_coaching_note} title={`Coaching: ${agentName}`} size={12} />
                          </div>
                          <p className="text-sm font-medium leading-tight" style={{ color: 'rgba(255,255,255,0.9)' }}>
                            {alloc.ai_coaching_note}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right: Target + Summary */}
                    <div className="space-y-2">
                      {alloc.ai_hit_target_prediction && (
                        <div className="p-3 rounded-xl" style={{ background: targetStyle.bg, border: `2px solid ${targetStyle.border.replace('0.5', '0.3')}` }}>
                          <p className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: targetStyle.text }}>
                            🎯 Target
                          </p>
                          <p className="text-lg font-bold" style={{ color: targetStyle.text }}>
                            {targetStyle.label}
                          </p>
                          {alloc.ai_target_reasoning && (
                            <div className="flex items-start gap-2 mt-1">
                              <p className="text-xs leading-tight flex-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
                                {alloc.ai_target_reasoning}
                              </p>
                              <ReadAloudButton text={alloc.ai_target_reasoning} title={`Target: ${agentName}`} size={11} />
                            </div>
                          )}
                        </div>
                      )}
                      
                      {alloc.ai_agent_rolling_summary && (
                        <div className="p-3 rounded-xl" style={{ background: DESIGN_TOKENS.purple, border: `2px solid ${DESIGN_TOKENS.purpleBorder}` }}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: DESIGN_TOKENS.purpleText }}>
                              📊 Summary
                            </p>
                            <ReadAloudButton text={alloc.ai_agent_rolling_summary} title={`Summary: ${agentName}`} size={12} />
                          </div>
                          <p className="text-sm leading-tight" style={{ color: 'rgba(255,255,255,0.9)' }}>
                            {alloc.ai_agent_rolling_summary}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Performance Numbers — 3 columns with icons */}
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Users className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
                        <p className="text-[8px] uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Leads</p>
                      </div>
                      <p className="text-2xl font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.95)' }}>{alloc.leads_worked || 0}</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <CheckCircle2 className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
                        <p className="text-[8px] uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Seq</p>
                      </div>
                      <p className="text-2xl font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.95)' }}>{alloc.sequences_completed || 0}</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Target className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
                        <p className="text-[8px] uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Qual</p>
                      </div>
                      <p className="text-2xl font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.95)' }}>{alloc.qualifications_logged || 0}</p>
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