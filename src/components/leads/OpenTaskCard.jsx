import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckSquare, CalendarCheck, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow, isPast, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

function getDueLabel(dueAt) {
  if (!dueAt) return null;
  const date = parseISO(dueAt);
  const overdue = isPast(date);
  const label = formatDistanceToNow(date, { addSuffix: true });
  return { label, overdue };
}

export default function OpenTaskCard({ activity, leadId }) {
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState('');
  const queryClient = useQueryClient();

  const completeMutation = useMutation({
    mutationFn: () =>
      base44.entities.LeadActivity.update(activity.id, {
        completed: true,
        completed_at: new Date().toISOString(),
        result: result.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-activities', leadId] });
    },
  });

  const isBooking = activity.activity_type === 'booking';
  const due = activity.due_at ? getDueLabel(activity.due_at) : null;

  const cardColor = isBooking
    ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800'
    : 'border-pink-300 bg-pink-50 dark:bg-pink-950/30 dark:border-pink-800';

  const Icon = isBooking ? CalendarCheck : CheckSquare;
  const iconColor = isBooking ? 'text-blue-500' : 'text-pink-500';

  return (
    <div className={cn('rounded-xl border p-3 space-y-2', cardColor)}>
      <div className="flex items-start gap-2">
        <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', iconColor)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{activity.title}</p>
          {activity.body && (
            <p className="text-xs text-muted-foreground mt-0.5">{activity.body}</p>
          )}
          {activity.assigned_to && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Assigned to: {activity.assigned_to}
            </p>
          )}
        </div>
        {due && (
          <div className={cn(
            'flex items-center gap-1 text-[10px] font-semibold shrink-0 px-2 py-0.5 rounded-full',
            due.overdue
              ? 'bg-red-100 text-red-600 dark:bg-red-900/40'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40'
          )}>
            {due.overdue ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            {due.label}
          </div>
        )}
      </div>

      {!showResult ? (
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[10px] border-current"
          onClick={() => setShowResult(true)}
        >
          Add result
        </Button>
      ) : (
        <div className="space-y-2">
          <Textarea
            value={result}
            onChange={(e) => setResult(e.target.value)}
            placeholder="What was the outcome?"
            rows={2}
            className="text-xs resize-none"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={completeMutation.isPending}
              onClick={() => completeMutation.mutate()}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Mark Complete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setShowResult(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}