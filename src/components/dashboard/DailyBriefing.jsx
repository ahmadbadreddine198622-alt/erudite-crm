import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import {
  Sparkles, RefreshCw, AlertTriangle, Phone, Eye, TrendingDown,
  Calendar, CheckCircle2, ArrowRight, Clock, Flame, Target, Building2
} from 'lucide-react';
import { isToday, isPast, isAfter, subDays, differenceInDays, format } from 'date-fns';

export default function DailyBriefing() {
  const [expanded, setExpanded] = useState(true);

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 500),
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders-briefing'],
    queryFn: () => base44.entities.Reminder.filter({ status: 'pending' }, 'due_date', 50),
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list('-created_date', 200),
  });

  // --- Compute insights ---
  const now = new Date();
  const sevenDaysAgo = subDays(now, 7);
  const threeDaysAgo = subDays(now, 3);

  // Overdue reminders
  const overdueReminders = reminders.filter(r =>
    r.due_date && isPast(new Date(r.due_date)) && !isToday(new Date(r.due_date))
  );

  // Due today
  const todayReminders = reminders.filter(r =>
    r.due_date && isToday(new Date(r.due_date))
  );

  // Viewings today
  const viewingsToday = reminders.filter(r =>
    r.type === 'viewing' && r.due_date && isToday(new Date(r.due_date))
  );

  // Cold leads (no contact in 7+ days, still active)
  const coldLeads = leads.filter(l => {
    if (['closed_won', 'closed_lost'].includes(l.stage)) return false;
    if (!l.last_contact_date) {
      // Never contacted and older than 3 days
      return l.created_date && isPast(new Date(l.created_date)) &&
        differenceInDays(now, new Date(l.created_date)) > 3;
    }
    return isPast(new Date(l.last_contact_date)) &&
      differenceInDays(now, new Date(l.last_contact_date)) >= 7;
  });

  // Hot leads (high score, active stage)
  const hotLeads = leads.filter(l =>
    l.lead_score >= 70 &&
    !['closed_won', 'closed_lost'].includes(l.stage)
  ).slice(0, 3);

  // New leads this week
  const newLeadsThisWeek = leads.filter(l =>
    l.created_date && isAfter(new Date(l.created_date), sevenDaysAgo)
  ).length;

  // Active pipeline leads (not closed)
  const activeLeads = leads.filter(l =>
    !['closed_won', 'closed_lost'].includes(l.stage)
  ).length;

  // Stale listings
  const staleProperties = properties.filter(p =>
    p.status === 'available' &&
    p.created_date && differenceInDays(now, new Date(p.created_date)) > 30
  ).length;

  // Pipeline conversion
  const conversionRate = leads.length > 0
    ? Math.round((leads.filter(l => l.stage === 'closed_won').length / leads.length) * 100)
    : 0;

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const urgentCount = overdueReminders.length + coldLeads.length;

  const items = [
    overdueReminders.length > 0 && {
      icon: AlertTriangle,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      label: `${overdueReminders.length} overdue task${overdueReminders.length > 1 ? 's' : ''}`,
      sub: 'Need immediate attention',
      link: '/reminders',
      urgent: true,
    },
    todayReminders.length > 0 && {
      icon: Clock,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      label: `${todayReminders.length} task${todayReminders.length > 1 ? 's' : ''} due today`,
      sub: viewingsToday.length > 0 ? `Including ${viewingsToday.length} viewing${viewingsToday.length > 1 ? 's' : ''}` : 'Stay on schedule',
      link: '/reminders',
    },
    viewingsToday.length > 0 && {
      icon: Eye,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      label: `${viewingsToday.length} viewing${viewingsToday.length > 1 ? 's' : ''} scheduled today`,
      sub: viewingsToday.map(v => v.lead_name || v.title).join(', '),
      link: '/reminders',
    },
    coldLeads.length > 0 && {
      icon: TrendingDown,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
      label: `${coldLeads.length} cold lead${coldLeads.length > 1 ? 's' : ''} need re-engagement`,
      sub: 'No contact in 7+ days',
      link: '/contacts',
      urgent: coldLeads.length > 5,
    },
    hotLeads.length > 0 && {
      icon: Flame,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      label: `${hotLeads.length} hot lead${hotLeads.length > 1 ? 's' : ''} ready to close`,
      sub: hotLeads.map(l => l.name).join(', '),
      link: '/pipeline',
    },
    newLeadsThisWeek > 0 && {
      icon: Target,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
      label: `${newLeadsThisWeek} new lead${newLeadsThisWeek > 1 ? 's' : ''} this week`,
      sub: `${activeLeads} active in pipeline`,
      link: '/leads',
    },
    staleProperties > 0 && {
      icon: Building2,
      color: 'text-sky-500',
      bg: 'bg-sky-500/10',
      label: `${staleProperties} listing${staleProperties > 1 ? 's' : ''} active 30+ days`,
      sub: 'Consider price review or re-marketing',
      link: '/properties',
    },
  ].filter(Boolean);

  return (
    <Card className="overflow-hidden border-0 shadow-md bg-gradient-to-br from-primary to-primary/90">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-primary-foreground/60 text-xs font-medium uppercase tracking-widest">
              {format(now, 'EEEE, MMMM d')}
            </p>
            <h2 className="text-primary-foreground font-semibold text-base leading-tight">
              {greeting} — {items.length === 0 ? "You're all caught up 🎉" : `${urgentCount > 0 ? urgentCount + ' urgent items' : items.length + ' things need attention'}`}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {urgentCount > 0 && (
            <Badge className="bg-red-500 text-white border-0 text-xs">
              {urgentCount} urgent
            </Badge>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-primary-foreground/40 hover:text-primary-foreground/80 transition-colors text-xs font-medium"
          >
            {expanded ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-5 pb-5">
          {items.length === 0 ? (
            <div className="flex items-center gap-3 bg-white/10 rounded-xl p-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-primary-foreground text-sm font-medium">Pipeline conversion: {conversionRate}%</p>
                <p className="text-primary-foreground/60 text-xs mt-0.5">No urgent actions — great work! Keep prospecting.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {items.map((item, i) => (
                <Link key={i} to={item.link}>
                  <div className={`flex items-start gap-3 rounded-xl p-3.5 cursor-pointer transition-all hover:scale-[1.02] ${item.urgent ? 'bg-white/20 ring-1 ring-red-400/40' : 'bg-white/10 hover:bg-white/15'}`}>
                    <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-primary-foreground text-sm font-medium leading-snug">{item.label}</p>
                      <p className="text-primary-foreground/50 text-xs mt-0.5 truncate">{item.sub}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-primary-foreground/30 shrink-0 mt-1" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Quick stats footer */}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/10">
            <div className="text-center">
              <p className="text-primary-foreground font-bold text-lg leading-none">{activeLeads}</p>
              <p className="text-primary-foreground/50 text-[10px] mt-1 uppercase tracking-wide">Active Leads</p>
            </div>
            <div className="text-center">
              <p className="text-primary-foreground font-bold text-lg leading-none">{todayReminders.length}</p>
              <p className="text-primary-foreground/50 text-[10px] mt-1 uppercase tracking-wide">Tasks Today</p>
            </div>
            <div className="text-center">
              <p className="text-primary-foreground font-bold text-lg leading-none">{conversionRate}%</p>
              <p className="text-primary-foreground/50 text-[10px] mt-1 uppercase tracking-wide">Conversion</p>
            </div>
            <div className="text-center">
              <p className={`font-bold text-lg leading-none ${coldLeads.length > 0 ? 'text-orange-400' : 'text-primary-foreground'}`}>{coldLeads.length}</p>
              <p className="text-primary-foreground/50 text-[10px] mt-1 uppercase tracking-wide">Cold Leads</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}