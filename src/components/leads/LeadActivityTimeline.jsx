import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import AddNotePanel from './AddNotePanel';
import AddTaskPanel from './AddTaskPanel';
import OpenTaskCard from './OpenTaskCard';
import {
  StickyNote, CheckSquare, CalendarCheck, ArrowRightLeft, UserCheck,
  Settings, MessageSquare, Clock, CheckCircle2
} from 'lucide-react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { cn } from '@/lib/utils';

const TYPE_CONFIG = {
  note:              { icon: StickyNote,      color: 'text-amber-500',   bg: 'bg-amber-500/10',   label: 'Note' },
  task:              { icon: CheckSquare,     color: 'text-purple-500',  bg: 'bg-purple-500/10',  label: 'Task' },
  booking:           { icon: CalendarCheck,   color: 'text-blue-500',    bg: 'bg-blue-500/10',    label: 'Booking' },
  stage_change:      { icon: ArrowRightLeft,  color: 'text-emerald-600', bg: 'bg-emerald-500/10', label: 'Stage' },
  field_change:      { icon: Settings,        color: 'text-slate-500',   bg: 'bg-slate-500/10',   label: 'Change' },
  assignment_change: { icon: UserCheck,       color: 'text-sky-500',     bg: 'bg-sky-500/10',     label: 'Assignment' },
  whatsapp:          { icon: MessageSquare,   color: 'text-green-600',   bg: 'bg-green-500/10',   label: 'WhatsApp' },
  system:            { icon: Clock,           color: 'text-muted-foreground', bg: 'bg-muted',     label: 'System' },
};

function TimelineItem({ activity }) {
  const cfg = TYPE_CONFIG[activity.activity_type] || TYPE_CONFIG.system;
  const Icon = cfg.icon;
  const ts = activity.created_date ? parseISO(activity.created_date) : null;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', cfg.bg)}>
          <Icon className={cn('w-3.5 h-3.5', cfg.color)} />
        </div>
        <div className="w-px flex-1 bg-border mt-1" />
      </div>
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight">{activity.title}</p>
          <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
            {ts ? formatDistanceToNow(ts, { addSuffix: true }) : ''}
          </span>
        </div>
        {activity.body && (
          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{activity.body}</p>
        )}
        {activity.result && (
          <div className="mt-1.5 text-xs px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <span className="font-semibold">Result: </span>{activity.result}
          </div>
        )}
        {activity.completed && activity.completed_at && (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-600">
            <CheckCircle2 className="w-3 h-3" />
            Completed {formatDistanceToNow(parseISO(activity.completed_at), { addSuffix: true })}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1">
          {activity.created_by && (
            <span className="text-[10px] text-muted-foreground">{activity.created_by}</span>
          )}
          {ts && (
            <span className="text-[10px] text-muted-foreground">
              {format(ts, 'MMM d, h:mm a')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LeadActivityTimeline({ lead, agentName }) {
  const [mode, setMode] = useState(null); // null | 'note' | 'task' | 'booking'

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['lead-activities', lead.id],
    queryFn: () => base44.entities.LeadActivity.filter({ lead_id: lead.id }, '-created_date', 100),
    enabled: !!lead.id,
  });

  // Open (incomplete) tasks and bookings — pinned at top
  const openTasks = activities.filter(
    (a) => (a.activity_type === 'task' || a.activity_type === 'booking') && !a.completed
  );

  // Everything else for the feed (including completed tasks)
  const feedItems = activities.filter(
    (a) => !(a.activity_type === 'task' || a.activity_type === 'booking') || a.completed
  );

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          variant={mode === 'note' ? 'default' : 'outline'}
          className="h-7 text-xs gap-1.5"
          onClick={() => setMode(mode === 'note' ? null : 'note')}
        >
          <StickyNote className="w-3.5 h-3.5" /> Note
        </Button>
        <Button
          size="sm"
          variant={mode === 'task' ? 'default' : 'outline'}
          className="h-7 text-xs gap-1.5"
          onClick={() => setMode(mode === 'task' ? null : 'task')}
        >
          <CheckSquare className="w-3.5 h-3.5" /> Task
        </Button>
        <Button
          size="sm"
          variant={mode === 'booking' ? 'default' : 'outline'}
          className="h-7 text-xs gap-1.5"
          onClick={() => setMode(mode === 'booking' ? null : 'booking')}
        >
          <CalendarCheck className="w-3.5 h-3.5" /> Booking
        </Button>
      </div>

      {/* Inline panels */}
      {mode === 'note' && (
        <AddNotePanel leadId={lead.id} agentName={agentName} />
      )}
      {(mode === 'task' || mode === 'booking') && (
        <AddTaskPanel
          leadId={lead.id}
          agentName={agentName}
          type={mode}
          onClose={() => setMode(null)}
        />
      )}

      {/* Pinned open tasks / bookings */}
      {openTasks.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Open ({openTasks.length})
          </p>
          {openTasks.map((t) => (
            <OpenTaskCard key={t.id} activity={t} leadId={lead.id} />
          ))}
        </div>
      )}

      {/* Timeline feed */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Loading activity...</p>
      ) : feedItems.length === 0 && openTasks.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">
          No activity yet. Add a note, task, or booking above.
        </p>
      ) : (
        <div className="mt-2">
          {feedItems.length > 0 && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              History
            </p>
          )}
          <div>
            {feedItems.map((a) => (
              <TimelineItem key={a.id} activity={a} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}