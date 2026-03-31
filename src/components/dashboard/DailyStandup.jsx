import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';

export default function DailyStandup() {
  const { user } = useAuth();

  const { data: myLeads = [] } = useQuery({
    queryKey: ['my_leads_today', user?.email],
    queryFn: () => base44.entities.Lead.filter({ assigned_agent: user?.email }, '-last_contact_date', 200),
    enabled: !!user?.email,
  });

  const { data: myActivities = [] } = useQuery({
    queryKey: ['my_activities_today', user?.email],
    queryFn: () => base44.entities.Activity.filter({ agent_email: user?.email }, '-created_date', 100),
    enabled: !!user?.email,
  });

  const { data: myReminders = [] } = useQuery({
    queryKey: ['my_reminders_today', user?.email],
    queryFn: () => base44.entities.Reminder.filter({ assigned_to: user?.email, status: 'pending' }, '-due_date', 50),
    enabled: !!user?.email,
  });

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const stats = useMemo(() => {
    const todayContacted = myActivities.filter(a => {
      const actDate = new Date(a.created_date);
      return actDate >= today && (a.type === 'call' || a.type === 'whatsapp' || a.type === 'email');
    }).length;

    const viewingsScheduled = myLeads.filter(l => l.stage === 'viewing_scheduled').length;
    const pendingOffers = myLeads.filter(l => l.stage === 'offer_made').length;
    const overdueFollowups = myReminders.filter(r => r.due_date && new Date(r.due_date) < new Date()).length;
    const inactiveLeads = myLeads.filter(l => {
      if (!l.last_contact_date || l.stage === 'closed_won' || l.stage === 'closed_lost') return false;
      const days = (Date.now() - new Date(l.last_contact_date)) / 86400000;
      return days > 3;
    }).length;

    return {
      todayContacted,
      viewingsScheduled,
      pendingOffers,
      overdueFollowups,
      inactiveLeads,
      targetContacts: 15,
      targetViewings: 2,
    };
  }, [myActivities, myLeads, myReminders, today]);

  const getStatus = (actual, target) => {
    if (actual >= target) return 'on-track';
    if (actual >= target * 0.75) return 'caution';
    return 'behind';
  };

  return (
    <Card className="border-accent/20 bg-gradient-to-br from-accent/5 to-transparent">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-accent" />
          Today's Standup Checklist
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Contacts */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
          <div>
            <p className="text-sm font-medium">New Leads Contacted</p>
            <p className="text-xs text-muted-foreground">Target: {stats.targetContacts}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{stats.todayContacted}</span>
            <Badge variant={getStatus(stats.todayContacted, stats.targetContacts) === 'on-track' ? 'default' : 'outline'} className="text-[10px]">
              {getStatus(stats.todayContacted, stats.targetContacts) === 'on-track' ? '✓ On Track' : '⚠ Behind'}
            </Badge>
          </div>
        </div>

        {/* Viewings */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
          <div>
            <p className="text-sm font-medium">Viewings Scheduled</p>
            <p className="text-xs text-muted-foreground">Target: {stats.targetViewings}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{stats.viewingsScheduled}</span>
            <Badge variant={getStatus(stats.viewingsScheduled, stats.targetViewings) === 'on-track' ? 'default' : 'outline'} className="text-[10px]">
              {getStatus(stats.viewingsScheduled, stats.targetViewings) === 'on-track' ? '✓ On Track' : '⚠ Behind'}
            </Badge>
          </div>
        </div>

        {/* Pending Offers */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
          <div>
            <p className="text-sm font-medium">Pending Offers</p>
            <p className="text-xs text-muted-foreground">Awaiting client decision</p>
          </div>
          <span className="text-lg font-bold text-accent">{stats.pendingOffers}</span>
        </div>

        {/* Alerts */}
        {(stats.overdueFollowups > 0 || stats.inactiveLeads > 0) && (
          <div className="space-y-2 pt-2 border-t">
            {stats.overdueFollowups > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span><strong>{stats.overdueFollowups}</strong> overdue follow-ups — handle now</span>
              </div>
            )}
            {stats.inactiveLeads > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded text-sm text-amber-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span><strong>{stats.inactiveLeads}</strong> leads inactive >3 days — re-engage</span>
              </div>
            )}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground pt-1">
          Last updated: {format(new Date(), 'h:mm a')}
        </p>
      </CardContent>
    </Card>
  );
}