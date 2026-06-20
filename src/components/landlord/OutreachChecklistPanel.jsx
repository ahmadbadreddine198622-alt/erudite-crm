import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { CheckCircle2, Circle, Phone, MessageCircle, Mail, MessageSquare, ClipboardCheck, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

const TODAY = new Date().toISOString().slice(0, 10);

const STEPS = [
  { key: 'email_sent', label: 'Email', icon: Mail, color: 'text-blue-400', description: 'Send an introductory or follow-up email' },
  { key: 'whatsapp_sent', label: 'WhatsApp', icon: MessageCircle, color: 'text-green-400', description: 'Send a WhatsApp message' },
  { key: 'imessage_sent', label: 'iMessage', icon: MessageSquare, color: 'text-indigo-400', description: 'Send an iMessage' },
  { key: 'sms_sent', label: 'SMS', icon: MessageSquare, color: 'text-purple-400', description: 'Send an SMS' },
  { key: 'called', label: 'Call', icon: Phone, color: 'text-amber-400', description: 'Call the landlord', hasMethod: true },
  { key: 'qualification_logged', label: 'Qualification', icon: ClipboardCheck, color: 'text-emerald-400', description: 'Log a call qualification' },
];

const CALL_METHODS = [
  { value: 'phone', label: 'Phone Call' },
  { value: 'whatsapp_call', label: 'WhatsApp Call' },
  { value: 'facetime', label: 'FaceTime' },
];

export default function OutreachChecklistPanel({ landlord }) {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [callMethodOpen, setCallMethodOpen] = useState(false);

  const { data: checklist, isLoading } = useQuery({
    queryKey: ['outreach-checklist', landlord.id, TODAY],
    queryFn: async () => {
      const rows = await base44.entities.OutreachChecklist.filter({
        landlord_id: landlord.id,
        outreach_date: TODAY,
      });
      return rows?.[0] ?? null;
    },
    enabled: !!landlord.id && !!user,
  });

  const updateMutation = useMutation({
    mutationFn: async (patch) => {
      const merged = { ...(checklist || {}), ...patch };
      const stepKeys = ['email_sent', 'whatsapp_sent', 'imessage_sent', 'sms_sent', 'called', 'qualification_logged'];
      const steps_completed = stepKeys.filter(k => merged[k]).length;
      const sequence_complete = ['email_sent', 'whatsapp_sent', 'imessage_sent', 'sms_sent', 'called'].every(k => merged[k]);

      let updatedChecklist;
      if (checklist) {
        updatedChecklist = await base44.entities.OutreachChecklist.update(checklist.id, {
          ...patch,
          steps_completed,
          sequence_complete,
        });
      } else {
        updatedChecklist = await base44.entities.OutreachChecklist.create({
          landlord_id: landlord.id,
          landlord_name: landlord.full_name_en || landlord.full_name,
          agent_email: user.email,
          outreach_date: TODAY,
          ...patch,
          steps_completed,
          sequence_complete,
        });
      }

      // Sync DailyLeadAllocation
      const allChecks = await base44.entities.OutreachChecklist.filter({ agent_email: user.email, outreach_date: TODAY });
      const leads_worked = allChecks.filter(r => r.sequence_complete).length;
      const qualifications_logged = allChecks.filter(r => r.qualification_logged).length;
      const sequences_completed = leads_worked;
      const base_allocation = 10;
      const completion_rate = Math.round((leads_worked / base_allocation) * 100);
      const earned_more_leads = leads_worked >= base_allocation;
      const bonus_earned = earned_more_leads ? 5 : 0;
      const total_available = base_allocation + bonus_earned;
      const status = earned_more_leads ? 'completed' : leads_worked === 0 ? 'active' : leads_worked < 5 ? 'underperforming' : 'active';
      const daily_score = leads_worked * 10 + qualifications_logged * 15 + bonus_earned * 5;

      const allocRows = await base44.entities.DailyLeadAllocation.filter({ agent_email: user.email, allocation_date: TODAY });
      const existingAlloc = allocRows[0];
      const allocPatch = { leads_worked, sequences_completed, qualifications_logged, completion_rate, earned_more_leads, bonus_earned, total_available, status, daily_score };

      // Sequential unlock: if this landlord just became sequence_complete, advance the unlock pointer
      if (sequence_complete && existingAlloc?.sequential_unlock_enabled && existingAlloc?.lead_queue?.length) {
        const queue = existingAlloc.lead_queue;
        const landlordIdx = queue.indexOf(landlord.id);
        const currentUnlocked = existingAlloc.leads_unlocked_count ?? 1;
        // Unlock next if this landlord is the current last unlocked
        if (landlordIdx === currentUnlocked - 1 && currentUnlocked < queue.length) {
          allocPatch.leads_unlocked_count = currentUnlocked + 1;
          allocPatch.current_unlocked_index = currentUnlocked;
        }
      }

      if (existingAlloc) {
        await base44.entities.DailyLeadAllocation.update(existingAlloc.id, allocPatch);
      } else {
        await base44.entities.DailyLeadAllocation.create({
          agent_email: user.email,
          agent_name: user.full_name,
          allocation_date: TODAY,
          base_allocation,
          leads_unlocked_count: 1,
          current_unlocked_index: 0,
          sequential_unlock_enabled: true,
          ...allocPatch,
        });
      }

      return updatedChecklist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-checklist', landlord.id, TODAY] });
      queryClient.invalidateQueries({ queryKey: ['daily-allocation', user?.email, TODAY] });
    },
    onError: (e) => toast.error('Failed to update: ' + e.message),
  });

  const toggleStep = (stepKey, extra = {}) => {
    const currentVal = checklist?.[stepKey] ?? false;
    const newVal = !currentVal;
    const now = new Date().toISOString();
    const tsKey = stepKey + '_at';
    const patch = { [stepKey]: newVal, [tsKey]: newVal ? now : null, ...extra };
    updateMutation.mutate(patch);
  };

  const handleCallTick = () => {
    if (checklist?.called) {
      // untick
      updateMutation.mutate({ called: false, called_at: null, call_method: 'not_called' });
    } else {
      setCallMethodOpen(true);
    }
  };

  const selectCallMethod = (method) => {
    const now = new Date().toISOString();
    updateMutation.mutate({ called: true, called_at: now, call_method: method });
    setCallMethodOpen(false);
  };

  const stepsCompleted = checklist?.steps_completed ?? 0;
  const sequenceComplete = checklist?.sequence_complete ?? false;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem' }}>
            Today's Outreach Sequence
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Email → WhatsApp → iMessage → SMS → Call → Qualify</p>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold tabular-nums" style={{ color: sequenceComplete ? 'hsl(152 69% 40%)' : 'hsl(38 92% 55%)' }}>
            {stepsCompleted}/6
          </span>
          {sequenceComplete && (
            <p className="text-[10px] text-emerald-400 font-semibold">Sequence complete ✓</p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-1.5 rounded-full transition-all duration-500"
          style={{
            width: `${(stepsCompleted / 6) * 100}%`,
            background: sequenceComplete
              ? 'hsl(152 69% 40%)'
              : 'linear-gradient(90deg, hsl(38 92% 50%), hsl(38 92% 65%))',
          }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-1.5">
        {STEPS.map((step, idx) => {
          const done = checklist?.[step.key] ?? false;
          const isCall = step.hasMethod;
          const callMethod = checklist?.call_method;

          return (
            <div key={step.key}>
              <button
                onClick={isCall ? handleCallTick : () => toggleStep(step.key)}
                disabled={updateMutation.isPending}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left"
                style={{
                  background: done ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
                  border: done ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {/* Step number */}
                <span className="text-[10px] font-bold w-4 shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {idx + 1}
                </span>

                {/* Check icon */}
                {done
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  : <Circle className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }} />
                }

                {/* Icon + label */}
                <step.icon className={`w-3.5 h-3.5 shrink-0 ${done ? 'text-emerald-400' : step.color}`} />
                <div className="flex-1 min-w-0">
                  <span className={`text-xs font-medium ${done ? 'text-emerald-300' : 'text-foreground'}`}>
                    {step.label}
                  </span>
                  {isCall && done && callMethod && callMethod !== 'not_called' && (
                    <span className="text-[10px] text-muted-foreground ml-1.5">
                      via {CALL_METHODS.find(m => m.value === callMethod)?.label || callMethod}
                    </span>
                  )}
                </div>

                {/* Timestamp */}
                {done && checklist?.[step.key + '_at'] && (
                  <span className="text-[10px] tabular-nums shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {new Date(checklist[step.key + '_at']).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </button>

              {/* Call method picker */}
              {isCall && callMethodOpen && (
                <div className="mt-1 ml-10 p-2 rounded-lg space-y-1" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <p className="text-[10px] text-muted-foreground mb-1.5">How did you call?</p>
                  {CALL_METHODS.map(m => (
                    <button
                      key={m.value}
                      onClick={() => selectCallMethod(m.value)}
                      className="w-full text-left text-xs px-2.5 py-1.5 rounded-md hover:bg-white/10 transition-colors"
                      style={{ color: 'rgba(255,255,255,0.8)' }}
                    >
                      {m.label}
                    </button>
                  ))}
                  <button
                    onClick={() => setCallMethodOpen(false)}
                    className="w-full text-left text-[10px] px-2.5 py-1 text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reached landlord toggle */}
      <div className="pt-2 border-t border-white/8">
        <button
          onClick={() => updateMutation.mutate({ reached_landlord: !(checklist?.reached_landlord ?? false) })}
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 text-xs"
          style={{ color: checklist?.reached_landlord ? 'hsl(152 69% 50%)' : 'rgba(255,255,255,0.4)' }}
        >
          {checklist?.reached_landlord
            ? <CheckCircle2 className="w-3.5 h-3.5" />
            : <Circle className="w-3.5 h-3.5" />}
          Reached landlord (connected)
        </button>
      </div>
    </div>
  );
}