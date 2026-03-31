import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, Calendar, FileText } from 'lucide-react';
import { format, isToday, isBefore, endOfDay } from 'date-fns';

export default function DailyFocus() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => base44.entities.Reminder.filter({ status: 'pending' }, '-due_date', 100)
  });

  const { data: offers = [] } = useQuery({
    queryKey: ['offers'],
    queryFn: () => base44.entities.Offer.list()
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities'],
    queryFn: () => base44.entities.Activity.list()
  });

  const focusTasks = useMemo(() => {
    if (!user) return [];

    const now = new Date();
    const tasks = [];

    // Overdue follow-ups
    const overdueReminders = reminders.filter(r => 
      r.assigned_to === user.email && 
      isBefore(new Date(r.due_date), now) &&
      r.status === 'pending'
    );

    overdueReminders.forEach(r => {
      tasks.push({
        id: r.id,
        type: 'overdue',
        priority: 'urgent',
        title: r.title,
        subtitle: r.lead_name || 'Follow-up task',
        time: format(new Date(r.due_date), 'MMM d, h:mm a'),
        icon: AlertCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-500/10'
      });
    });

    // Today's viewings
    const todayViewings = reminders.filter(r =>
      r.assigned_to === user.email &&
      r.type === 'viewing' &&
      isToday(new Date(r.due_date)) &&
      r.status === 'pending'
    );

    todayViewings.forEach(r => {
      tasks.push({
        id: r.id,
        type: 'viewing',
        priority: 'high',
        title: `Viewing: ${r.title}`,
        subtitle: r.lead_name || 'Viewing appointment',
        time: format(new Date(r.due_date), 'h:mm a'),
        icon: Calendar,
        color: 'text-amber-600',
        bgColor: 'bg-amber-500/10'
      });
    });

    // Pending offers (submitted, not yet responded)
    const pendingOffers = offers.filter(o =>
      o.agent_email === user.email &&
      (o.status === 'submitted' || o.status === 'countered')
    );

    pendingOffers.forEach(o => {
      tasks.push({
        id: o.id,
        type: 'offer',
        priority: 'high',
        title: `Offer: AED ${o.offer_amount_aed?.toLocaleString()}`,
        subtitle: o.property_title || o.lead_name || 'Pending offer',
        time: o.status === 'countered' ? 'Counter received' : 'Awaiting response',
        icon: FileText,
        color: o.status === 'countered' ? 'text-blue-600' : 'text-emerald-600',
        bgColor: o.status === 'countered' ? 'bg-blue-500/10' : 'bg-emerald-500/10'
      });
    });

    // Sort by priority and time: urgent > high, then by due date
    return tasks.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return 0;
    });
  }, [user, reminders, offers]);

  if (!user || focusTasks.length === 0) {
    return (
      <Card className="p-5 bg-gradient-to-r from-accent/5 to-transparent">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Clock className="w-4 h-4 text-accent" />
          Daily Focus
        </h3>
        <p className="text-sm text-muted-foreground">All caught up! No pending tasks for today.</p>
      </Card>
    );
  }

  return (
    <Card className="p-5 border-l-4 border-l-accent">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4 text-accent" />
        Daily Focus ({focusTasks.length})
      </h3>
      <div className="space-y-2">
        {focusTasks.map((task) => {
          const Icon = task.icon;
          return (
            <div
              key={`${task.type}-${task.id}`}
              className={`flex items-start gap-3 p-3 rounded-lg ${task.bgColor} border border-transparent hover:border-current/20 transition-colors`}
            >
              <div className="mt-0.5">
                <Icon className={`w-4 h-4 ${task.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${task.color}`}>
                  {task.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {task.subtitle}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {task.time}
                </p>
              </div>
              {task.priority === 'urgent' && (
                <Badge className="text-[10px] shrink-0 bg-red-600 hover:bg-red-700">
                  OVERDUE
                </Badge>
              )}
              {task.priority === 'high' && task.type !== 'offer' && (
                <Badge variant="outline" className="text-[10px] shrink-0">
                  TODAY
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}