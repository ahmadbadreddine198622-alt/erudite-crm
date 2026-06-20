import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Lock, CheckCircle2, ChevronRight, Loader2, Zap, AlertCircle, MapPin, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const TODAY = new Date().toISOString().slice(0, 10);

export default function MyLeadsToday() {
  const navigate = useNavigate();
  const { user, isLoading: userLoading } = useCurrentUser();
  const queryClient = useQueryClient();

  // Fetch today's allocation
  const { data: allocation, isLoading: allocLoading } = useQuery({
    queryKey: ['daily-allocation', user?.email, TODAY],
    queryFn: async () => {
      const rows = await base44.entities.DailyLeadAllocation.filter({ agent_email: user.email, allocation_date: TODAY });
      return rows?.[0] ?? null;
    },
    enabled: !!user?.email,
    refetchInterval: 15000,
  });

  // Fetch landlord details for the queue IDs
  const queue = allocation?.lead_queue || [];
  const { data: queueLandlords = [], isLoading: landlordLoading } = useQuery({
    queryKey: ['queue-landlords', queue.join(','), TODAY],
    queryFn: async () => {
      if (!queue.length) return [];
      const all = await base44.entities.Landlord.list('-updated_date', 200);
      return queue.map(id => all.find(l => l.id === id)).filter(Boolean);
    },
    enabled: queue.length > 0,
  });

  // Fetch today's outreach checklist records for this agent
  const { data: checklists = [] } = useQuery({
    queryKey: ['agent-checklists-today', user?.email, TODAY],
    queryFn: () => base44.entities.OutreachChecklist.filter({ agent_email: user.email, outreach_date: TODAY }),
    enabled: !!user?.email,
    refetchInterval: 10000,
  });

  // Unlock mutation
  const unlockMutation = useMutation({
    mutationFn: async (newUnlockedCount) => {
      if (!allocation) return;
      await base44.entities.DailyLeadAllocation.update(allocation.id, {
        leads_unlocked_count: newUnlockedCount,
        current_unlocked_index: newUnlockedCount - 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-allocation', user?.email, TODAY] });
      toast.success('Next lead unlocked! Keep going! 🎉');
    },
  });

  if (userLoading || allocLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading your leads...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to view your leads.</p>
      </div>
    );
  }

  if (!allocation || queue.length === 0) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-display font-bold mb-2" style={{ color: 'rgba(255,255,255,0.95)' }}>My Leads Today</h1>
          <p className="text-sm text-muted-foreground mb-8">Finish one to unlock the next</p>
          
          <div className="rounded-xl p-8 text-center space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto" />
            <div>
              <p className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>No lead queue assigned for today</p>
              <p className="text-sm text-muted-foreground mt-2">Ask your manager to assign your daily outreach queue.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sequential = allocation.sequential_unlock_enabled ?? true;
  const unlockedCount = sequential ? (allocation.leads_unlocked_count ?? 1) : queue.length;
  const totalLeads = queue.length;
  const completedLeads = queueLandlords.filter((_, idx) => {
    const checklist = checklists.find(c => c.landlord_id === queue[idx]);
    return (checklist?.sequence_complete ?? false) && (checklist?.qualification_logged ?? false);
  }).length;

  // Map checklist by landlord_id
  const checklistByLandlord = {};
  checklists.forEach(c => { checklistByLandlord[c.landlord_id] = c; });

  return (
    <div className="min-h-screen p-6" style={{ background: 'hsl(222 47% 9%)' }}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold mb-2" style={{ color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.02em' }}>
            My Leads Today
          </h1>
          <p className="text-lg" style={{ color: 'hsl(38 92% 55%)' }}>
            Finish one to unlock the next
          </p>
          
          {/* Progress bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {completedLeads} of {totalLeads} completed
              </span>
              <span className="text-sm font-semibold" style={{ color: 'hsl(38 92% 55%)' }}>
                {unlockedCount} unlocked
              </span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div 
                className="h-full transition-all duration-500"
                style={{ 
                  width: `${(completedLeads / totalLeads) * 100}%`,
                  background: 'linear-gradient(90deg, hsl(38 92% 50%), hsl(152 69% 40%))'
                }}
              />
            </div>
          </div>
        </div>

        {/* Lead cards */}
        <div className="space-y-4">
          {queue.map((landlordId, idx) => {
            const landlord = queueLandlords.find(l => l.id === landlordId);
            const checklist = checklistByLandlord[landlordId];
            
            const isComplete = (checklist?.sequence_complete ?? false) && (checklist?.qualification_logged ?? false);
            const stepsCompleted = checklist?.steps_completed ?? 0;
            const hasQualification = checklist?.qualification_logged ?? false;
            
            const isUnlocked = idx < unlockedCount;
            const isCurrent = sequential && idx === unlockedCount - 1 && !isComplete;
            const isLocked = !isUnlocked;
            const canUnlockNext = sequential && isComplete && idx === unlockedCount - 1 && unlockedCount < queue.length;

            return (
              <div key={landlordId}>
                <div
                  className={`rounded-xl p-6 transition-all ${isLocked ? 'opacity-60' : 'hover:scale-[1.02]'} ${isComplete ? 'border-emerald-500/30' : ''}`}
                  style={{
                    background: isComplete
                      ? 'rgba(16,185,129,0.08)'
                      : isCurrent
                      ? 'rgba(245,158,11,0.1)'
                      : isLocked
                      ? 'rgba(255,255,255,0.02)'
                      : 'rgba(255,255,255,0.05)',
                    border: isComplete
                      ? '2px solid rgba(16,185,129,0.3)'
                      : isCurrent
                      ? '2px solid rgba(245,158,11,0.4)'
                      : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div className="flex items-start gap-4">
                    {/* Position number */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${
                      isComplete ? 'bg-emerald-500/20 text-emerald-400' :
                      isCurrent ? 'bg-amber-500/20 text-amber-400' :
                      isLocked ? 'bg-white/5 text-muted-foreground' : 'bg-white/10 text-foreground'
                    }`}>
                      {isComplete ? <CheckCircle2 className="w-6 h-6" /> : idx + 1}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Name */}
                      <h2 className={`text-2xl font-bold mb-1 truncate ${
                        isLocked ? 'text-muted-foreground' : isComplete ? 'text-emerald-300' : 'text-foreground'
                      }`}>
                        {landlord ? (landlord.full_name_en || landlord.full_name || 'Unknown') : landlordLoading ? '…' : `Lead ${idx + 1}`}
                      </h2>

                      {/* Property info */}
                      {landlord?.project_name && (
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                            {landlord.unit_reference ? `Unit ${landlord.unit_reference}` : ''}
                            {landlord.unit_reference && ' · '}
                            {landlord.project_name}
                          </span>
                        </div>
                      )}

                      {/* Contact info */}
                      {landlord && (
                        <div className="flex items-center gap-4 mb-3">
                          {landlord.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{landlord.phone}</span>
                            </div>
                          )}
                          {landlord.email && (
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{landlord.email}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Status badges */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {isComplete ? (
                          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                            <CheckCircle2 className="w-5 h-5" />
                            COMPLETED ✓
                          </span>
                        ) : isLocked ? (
                          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <Lock className="w-5 h-5" />
                            LOCKED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                            <Zap className="w-5 h-5" />
                            OPEN
                          </span>
                        )}

                        {/* Step progress dots */}
                        {isUnlocked && !isComplete && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">{stepsCompleted}/6 steps</span>
                            <div className="flex gap-1">
                              {[...Array(6)].map((_, i) => (
                                <div 
                                  key={i} 
                                  className={`w-3 h-3 rounded-full ${i < stepsCompleted ? 'bg-emerald-500' : 'bg-white/10'}`}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Qualification badge */}
                        {hasQualification && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold" style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' }}>
                            <CheckCircle2 className="w-4 h-4" />
                            QUALIFIED
                          </span>
                        )}
                      </div>

                      {/* Locked message */}
                      {isLocked && (
                        <div className="mt-4 p-4 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)' }}>
                          <div className="flex items-center gap-3">
                            <Lock className="w-6 h-6 text-muted-foreground" />
                            <p className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                              LOCKED — finish the lead above first
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Unlock button */}
                      {canUnlockNext && (
                        <button
                          onClick={() => unlockMutation.mutate(unlockedCount + 1)}
                          disabled={unlockMutation.isPending}
                          className="mt-4 inline-flex items-center gap-2 px-6 py-3 rounded-lg text-base font-bold transition-all hover:scale-105"
                          style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}
                        >
                          <Zap className="w-5 h-5" />
                          {unlockMutation.isPending ? 'Unlocking…' : 'Unlock Next Lead →'}
                        </button>
                      )}

                      {/* Open button */}
                      {isUnlocked && !isComplete && (
                        <button
                          onClick={() => navigate(`/landlords?open=${landlordId}`)}
                          className="mt-4 inline-flex items-center gap-2 px-6 py-3 rounded-lg text-base font-bold transition-all hover:scale-105"
                          style={{ background: 'hsl(38 92% 50%)', color: 'hsl(222 47% 11%)' }}
                        >
                          Open Lead
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        {sequential && (
          <div className="mt-8 text-center">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.5rem' }}>
              Complete the full 6-step outreach sequence + log a qualification to unlock each lead
            </p>
          </div>
        )}
      </div>
    </div>
  );
}