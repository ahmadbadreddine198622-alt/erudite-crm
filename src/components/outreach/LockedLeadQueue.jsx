import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Lock, CheckCircle2, ChevronRight, Loader2, Zap, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const TODAY = new Date().toISOString().slice(0, 10);

export default function LockedLeadQueue({ onSelectLandlord }) {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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
    queryKey: ['queue-landlords', queue.join(',')],
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

  // Unlock mutation - increments leads_unlocked_count when current lead completes
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
      toast.success('Next lead unlocked!');
    },
  });

  if (!user) return null;
  if (allocLoading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;

  if (!allocation || queue.length === 0) {
    return (
      <div className="rounded-xl p-5 text-center space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <AlertCircle className="w-5 h-5 text-muted-foreground mx-auto" />
        <p className="text-xs text-muted-foreground">No lead queue set for today.</p>
        <p className="text-[10px] text-muted-foreground">Ask your manager to assign your daily queue.</p>
      </div>
    );
  }

  const sequential = allocation.sequential_unlock_enabled ?? true;
  const unlockedCount = sequential ? (allocation.leads_unlocked_count ?? 1) : queue.length;

  // Map checklist by landlord_id
  const checklistByLandlord = {};
  checklists.forEach(c => { checklistByLandlord[c.landlord_id] = c; });

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem' }}>Today's Lead Queue</p>
          <p className="text-[10px] text-muted-foreground">{unlockedCount} of {queue.length} unlocked{sequential ? ' — complete each to advance' : ''}</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: 'hsl(38 92% 55%)' }}>
          <Zap className="w-3 h-3" />
          {allocation.sequences_completed ?? 0} / {allocation.base_allocation ?? 10} done
        </div>
      </div>

      {/* Queue rows */}
      <div className="space-y-1.5">
        {queue.map((landlordId, idx) => {
          const landlord = queueLandlords.find(l => l.id === landlordId);
          const checklist = checklistByLandlord[landlordId];
          
          // A lead is "complete" only when BOTH sequence_complete AND qualification_logged are true
          const isComplete = (checklist?.sequence_complete ?? false) && (checklist?.qualification_logged ?? false);
          const stepsCompleted = checklist?.steps_completed ?? 0;
          const hasQualification = checklist?.qualification_logged ?? false;
          
          const isUnlocked = idx < unlockedCount;
          const isCurrent = sequential && idx === unlockedCount - 1 && !isComplete;
          const isLocked = !isUnlocked;

          // Can we unlock next? Current lead must be complete (sequence + qualification)
          const canUnlockNext = sequential && isComplete && idx === unlockedCount - 1 && unlockedCount < queue.length;

          return (
            <div key={landlordId}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isLocked ? 'opacity-50' : ''}`}
                style={{
                  background: isComplete
                    ? 'rgba(16,185,129,0.07)'
                    : isCurrent
                    ? 'rgba(245,158,11,0.08)'
                    : isLocked
                    ? 'rgba(255,255,255,0.02)'
                    : 'rgba(255,255,255,0.04)',
                  border: isComplete
                    ? '1px solid rgba(16,185,129,0.2)'
                    : isCurrent
                    ? '1px solid rgba(245,158,11,0.3)'
                    : '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {/* Position */}
                <span className="text-[10px] font-bold w-5 shrink-0 text-center tabular-nums" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {idx + 1}
                </span>

                {/* Status icon */}
                {isComplete ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : isLocked ? (
                  <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${isCurrent ? 'border-amber-400' : 'border-white/20'}`} />
                )}

                {/* Name + progress */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${isLocked ? 'text-muted-foreground' : isComplete ? 'text-emerald-300' : 'text-foreground'}`}>
                    {landlord ? (landlord.full_name_en || landlord.full_name || 'Unknown') : landlordLoading ? '…' : `Lead ${idx + 1}`}
                  </p>
                  {landlord?.project_name && (
                    <p className="text-[10px] text-muted-foreground truncate">{landlord.unit_reference ? `Unit ${landlord.unit_reference} · ` : ''}{landlord.project_name}</p>
                  )}
                  {/* Mini step dots */}
                  {isUnlocked && stepsCompleted > 0 && (
                    <div className="flex gap-0.5 mt-1">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i < stepsCompleted ? 'hsl(152 69% 40%)' : 'rgba(255,255,255,0.1)' }} />
                      ))}
                    </div>
                  )}
                  {/* Qualification badge */}
                  {hasQualification && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md mt-1 inline-block" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                      Qualified ✓
                    </span>
                  )}
                </div>

                {/* Action */}
                {isLocked ? (
                  <span className="text-[9px] text-muted-foreground shrink-0">Complete current to unlock</span>
                ) : isComplete ? (
                  <span className="text-[9px] text-emerald-400 font-semibold shrink-0">Done ✓</span>
                ) : (
                  <button
                    onClick={() => landlord && navigate(`/landlord/${landlord.id}`)}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md shrink-0 transition-colors hover:bg-white/10"
                    style={{ color: isCurrent ? 'hsl(38 92% 55%)' : 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)' }}
                  >
                    Open <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Unlock next button - appears when current lead is fully complete */}
              {canUnlockNext && (
                <button
                  onClick={() => unlockMutation.mutate(unlockedCount + 1)}
                  disabled={unlockMutation.isPending}
                  className="ml-8 mt-1 flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-md transition-colors"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }}
                >
                  <Zap className="w-3 h-3" />
                  {unlockMutation.isPending ? 'Unlocking…' : 'Unlock next lead →'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: unlock hint */}
      {sequential && (
        <p className="text-[10px] text-muted-foreground text-center pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          Complete full sequence + log qualification to unlock next lead
        </p>
      )}
    </div>
  );
}