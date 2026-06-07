import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Clock, Calendar as CalendarIcon, RotateCcw, Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_STYLE = {
  pending: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  done: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  missed: 'bg-red-500/10 text-red-600 border-red-500/30',
  cancelled: 'bg-slate-500/10 text-slate-600 border-slate-500/30',
};

const STATUS_ICONS = {
  pending: <Clock className="w-3.5 h-3.5" />,
  done: <CheckCircle2 className="w-3.5 h-3.5" />,
  missed: <XCircle className="w-3.5 h-3.5" />,
  cancelled: <XCircle className="w-3.5 h-3.5" />,
};

const TYPE_ICONS = {
  callback: <CalendarIcon className="w-3.5 h-3.5" />,
  appointment: <CalendarIcon className="w-3.5 h-3.5" />,
  task: <CheckCircle2 className="w-3.5 h-3.5" />,
};

export default function FollowUpsPanel({ landlordId }) {
  const queryClient = useQueryClient();
  const [expandedDone, setExpandedDone] = useState(false);
  const [reschedulingId, setReschedulingId] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState(null);

  const { data: followUps = [], isLoading } = useQuery({
    queryKey: ['landlord-followups', landlordId],
    queryFn: async () => {
      const all = await base44.entities.FollowUp.filter({ landlord_id: landlordId });
      return (all || []).sort((a, b) => new Date(a.data.scheduled_at) - new Date(b.data.scheduled_at));
    },
    enabled: !!landlordId,
  });

  const markDoneMutation = useMutation({
    mutationFn: async (followUpId) => {
      await base44.entities.FollowUp.update(followUpId, { status: 'done' });
      try {
        await base44.functions.invoke('syncFollowUpCalendar', { follow_up_id: followUpId, action: 'update' });
      } catch (e) {
        console.warn('Calendar sync failed:', e.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landlord-followups', landlordId] });
      toast.success('Follow-up marked as done');
    },
    onError: (e) => toast.error('Failed to mark as done: ' + e.message),
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ followUpId, newDate }) => {
      await base44.entities.FollowUp.update(followUpId, {
        scheduled_at: newDate.toISOString(),
        reminder_sent: false,
      });
      try {
        await base44.functions.invoke('syncFollowUpCalendar', { follow_up_id: followUpId, action: 'update' });
      } catch (e) {
        console.warn('Calendar sync failed:', e.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landlord-followups', landlordId] });
      setReschedulingId(null);
      setRescheduleDate(null);
      toast.success('Follow-up rescheduled');
    },
    onError: (e) => toast.error('Failed to reschedule: ' + e.message),
  });

  const pendingFollowUps = followUps.filter(f => f.data.status === 'pending');
  const completedFollowUps = followUps.filter(f => ['done', 'cancelled', 'missed'].includes(f.data.status));

  const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    return format(date, 'dd MMM yyyy, h:mm a');
  };

  const handleRescheduleSave = (followUpId) => {
    if (!rescheduleDate) return;
    rescheduleMutation.mutate({ followUpId, newDate: rescheduleDate });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Pending Follow-ups */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
            Upcoming Follow-ups ({pendingFollowUps.length})
          </h3>
        </div>
        
        {pendingFollowUps.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No pending follow-ups</p>
        ) : (
          <div className="space-y-2">
            {pendingFollowUps.map((followUp) => (
              <div
                key={followUp.id}
                className="rounded-lg border p-3"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={STATUS_STYLE[followUp.data.status]}>
                        {STATUS_ICONS[followUp.data.status]}
                        <span className="ml-1 capitalize">{followUp.data.status}</span>
                      </Badge>
                      <Badge variant="outline" className="text-xs border-white/20 text-white/70">
                        {TYPE_ICONS[followUp.data.type]}
                        <span className="ml-1 capitalize">{followUp.data.type}</span>
                      </Badge>
                      {followUp.data.created_source === 'auto_rule' && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 border-purple-500/30 text-purple-400 bg-purple-500/10">
                          Auto-created
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                      <CalendarIcon className="w-3 h-3" />
                      {formatDateTime(followUp.data.scheduled_at)}
                    </p>
                    {followUp.data.notes && (
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)', lineHeight: '1.5' }}>
                        {followUp.data.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markDoneMutation.mutate(followUp.id)}
                      disabled={markDoneMutation.isPending}
                      className="gap-1.5 text-xs h-7"
                    >
                      {markDoneMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Mark Done
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setReschedulingId(reschedulingId === followUp.id ? null : followUp.id)}
                      className="gap-1.5 text-xs h-7"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reschedule
                    </Button>
                  </div>
                </div>

                {/* Reschedule Picker */}
                {reschedulingId === followUp.id && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label className="text-[10px] text-muted-foreground mb-1.5 block">New Date & Time</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal h-8 text-xs">
                              <CalendarIcon className="mr-2 h-3 w-3" />
                              {rescheduleDate ? format(rescheduleDate, 'dd MMM yyyy, h:mm a') : 'Pick a date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={rescheduleDate || new Date(followUp.data.scheduled_at)}
                              onSelect={(date) => {
                                if (date) {
                                  const current = new Date(followUp.data.scheduled_at);
                                  date.setHours(current.getHours(), current.getMinutes());
                                  setRescheduleDate(date);
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setReschedulingId(null);
                            setRescheduleDate(null);
                          }}
                          className="text-xs h-8"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleRescheduleSave(followUp.id)}
                          disabled={!rescheduleDate || rescheduleMutation.isPending}
                          className="text-xs h-8"
                        >
                          {rescheduleMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Follow-ups */}
      {completedFollowUps.length > 0 && (
        <div>
          <button
            onClick={() => setExpandedDone(!expandedDone)}
            className="flex items-center gap-2 w-full mb-2 text-left"
          >
            <h3 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Completed ({completedFollowUps.length})
            </h3>
            {expandedDone ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {expandedDone && (
            <div className="space-y-2 opacity-60">
              {completedFollowUps.map((followUp) => (
                <div
                  key={followUp.id}
                  className="rounded-lg border p-3"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={STATUS_STYLE[followUp.data.status]}>
                          {STATUS_ICONS[followUp.data.status]}
                          <span className="ml-1 capitalize">{followUp.data.status}</span>
                        </Badge>
                        <Badge variant="outline" className="text-xs border-white/20 text-white/70">
                          {TYPE_ICONS[followUp.data.type]}
                          <span className="ml-1 capitalize">{followUp.data.type}</span>
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <CalendarIcon className="w-3 h-3" />
                        {formatDateTime(followUp.data.scheduled_at)}
                      </p>
                      {followUp.data.notes && (
                        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: '1.5' }}>
                          {followUp.data.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}