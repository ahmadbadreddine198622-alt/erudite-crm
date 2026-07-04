// Appointments — calendar view + list view.
// Month grid shows Google Calendar events + CRM meetings/viewings/calls.
// Toggle between Month and List. Book Appointment button at top.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import AppointmentBookingDialog from '@/components/appointments/AppointmentBookingDialog';
import { useCurrentUser } from '@/lib/useCurrentUser';
import GoogleWorkspaceConnectBanner from '@/components/settings/GoogleWorkspaceConnectBanner';
import CalendarMonthView from '@/components/appointments/CalendarMonthView';
import {
  Calendar, Plus, Clock, MapPin, User, Loader2, CalendarCheck,
  Phone, Eye, Users as UsersIcon, ChevronRight, LayoutGrid, List as ListIcon
} from 'lucide-react';

const TYPE_META = {
  google:  { icon: Calendar,    color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  meeting: { icon: UsersIcon,   color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
  viewing: { icon: Eye,         color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  call:    { icon: Phone,       color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
};

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
}
function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
function formatDuration(start, end) {
  if (!start || !end) return '';
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function AppointmentCard({ appt, isAdmin }) {
  const meta = TYPE_META[appt.type] || TYPE_META.meeting;
  const Icon = meta.icon;
  const isGoogle = appt.source === 'google';

  return (
    <div className="glass-card p-4 flex items-center gap-4 group hover:bg-white/[0.08] transition-all">
      <div className="flex-none text-center w-14">
        <p className="text-[10px] font-bold uppercase text-muted-foreground">{formatDate(appt.start).split(' ')[0]}</p>
        <p className="text-xl font-bold text-foreground">{formatDate(appt.start).split(' ')[1]}</p>
        <p className="text-[10px] text-muted-foreground">{formatDate(appt.start).split(' ')[2]}</p>
      </div>
      <div className="flex-none w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: meta.bg, border: `1px solid ${meta.color}40` }}>
        <Icon className="w-4 h-4" style={{ color: meta.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{appt.title}</p>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(appt.start)}</span>
          {appt.end && <span>{formatDuration(appt.start, appt.end)}</span>}
          {appt.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {appt.location}</span>}
          {appt.landlord_name && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {appt.landlord_name}</span>}
          {isAdmin && appt.agent_name && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {appt.agent_name}</span>}
          {isGoogle && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd' }}>Google</span>}
          {appt.status && appt.status !== 'scheduled' && appt.status !== 'pending' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full capitalize" style={{ background: appt.status === 'cancelled' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: appt.status === 'cancelled' ? '#f87171' : '#34d399' }}>{appt.status}</span>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-none" />
    </div>
  );
}

function DateGroup({ label, items, isAdmin }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <CalendarCheck className="w-3.5 h-3.5 text-accent" />
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</h3>
        <span className="text-[10px] text-muted-foreground">({items.length})</span>
      </div>
      <div className="space-y-2">
        {items.map((appt, i) => <AppointmentCard key={appt.id || i} appt={appt} isAdmin={isAdmin} />)}
      </div>
    </div>
  );
}

export default function Appointments() {
  const [view, setView] = useState('month'); // 'month' | 'list'
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const { user } = useCurrentUser();
  const isAdmin = user?.role === 'admin';
  const [agentFilter, setAgentFilter] = useState('all');

  // Calendar state
  const [monthDate, setMonthDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Compute grid range for the visible month (6 weeks = 42 days from the Sunday before the 1st)
  const { gridStart, gridEnd } = useMemo(() => {
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 42);
    return { gridStart: start, gridEnd: end };
  }, [monthDate]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getUserCalendarEvents', {
        time_min: gridStart.toISOString(),
        time_max: gridEnd.toISOString(),
        ...(isAdmin && agentFilter !== 'all' ? { filter_agent_email: agentFilter } : {}),
      });
      const data = res?.data ?? res;
      if (data?.ok !== false) {
        setEvents(data.events || []);
      }
    } catch (e) {
      // Fallback: just load CRM appointments
      try {
        const appts = await base44.entities.LandlordAppointment.list('datetime', 50);
        setEvents((appts || []).map((a) => ({ ...a, title: `${a.type || 'meeting'}`, type: a.type || 'meeting', source: 'crm' })));
      } catch (_) { /* empty */ }
    } finally { setLoading(false); }
  }, [gridStart.toISOString(), gridEnd.toISOString(), isAdmin, agentFilter]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // ── List view grouping ──
  const listGroups = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const tomorrow = new Date(now.getTime() + 86400000);
    const tomorrowStr = tomorrow.toDateString();
    const weekEnd = new Date(now.getTime() + 7 * 86400000);
    const groups = { today: [], tomorrow: [], week: [], later: [] };
    (events || []).forEach((e) => {
      if (!e.start) return;
      const d = new Date(e.start);
      const dStr = d.toDateString();
      if (dStr === todayStr) groups.today.push(e);
      else if (dStr === tomorrowStr) groups.tomorrow.push(e);
      else if (d <= weekEnd) groups.week.push(e);
      else groups.later.push(e);
    });
    return groups;
  }, [events]);

  // ── Unique agents for admin filter dropdown ──
  const uniqueAgents = useMemo(() => {
    const map = {};
    (events || []).forEach((e) => {
      if (e.agent_email && !map[e.agent_email]) {
        map[e.agent_email] = e.agent_name || e.agent_email;
      }
    });
    return Object.entries(map).map(([email, name]) => ({ email, name }));
  }, [events]);

  // ── Selected day events (for month view detail panel) ──
  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    const key = selectedDate.toDateString();
    return (events || []).filter((e) => {
      if (!e.start) return false;
      return new Date(e.start).toDateString() === key;
    });
  }, [events, selectedDate]);

  const selectedDayLabel = selectedDate
    ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  return (
    <div className="page-root">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="page-title text-3xl flex items-center gap-2"><Calendar className="w-7 h-7 text-accent" /> Appointments</h1>
            <p className="page-subtitle mt-1">Your calendar — Google + CRM meetings, viewings, and calls in one view.</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && uniqueAgents.length > 0 && (
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="h-8 rounded-lg border border-white/10 bg-white/[0.04] px-2 text-xs text-foreground cursor-pointer"
              >
                <option value="all">All Agents</option>
                {uniqueAgents.map((a) => <option key={a.email} value={a.email}>{a.name}</option>)}
              </select>
            )}
            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-white/10 bg-white/[0.04] p-0.5">
              <button
                onClick={() => setView('month')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${view === 'month' ? 'bg-accent/20 text-accent' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Month
              </button>
              <button
                onClick={() => setView('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${view === 'list' ? 'bg-accent/20 text-accent' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <ListIcon className="w-3.5 h-3.5" /> List
              </button>
            </div>
            <Button onClick={() => setBookingOpen(true)} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5">
              <Plus className="w-4 h-4" /> Book
            </Button>
          </div>
        </div>

        {/* Google Calendar connection */}
        <div className="rounded-2xl overflow-hidden">
          <GoogleWorkspaceConnectBanner variant="compact" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
        ) : view === 'month' ? (
          /* ── Month calendar view ── */
          <div className="grid lg:grid-cols-[1fr_300px] gap-5">
            <CalendarMonthView
              events={events}
              monthDate={monthDate}
              selectedDate={selectedDate}
              onPrevMonth={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
              onNextMonth={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
              onSelectDate={(d) => setSelectedDate(d)}
            />

            {/* Selected day detail panel */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <CalendarCheck className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-bold text-foreground">{selectedDayLabel}</h3>
                <span className="text-[10px] text-muted-foreground">({selectedDayEvents.length})</span>
              </div>
              {selectedDayEvents.length === 0 ? (
                <div className="glass-card p-6 text-center">
                  <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-xs text-muted-foreground">No appointments on this day.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDayEvents.map((appt, i) => {
                    const meta = TYPE_META[appt.type] || TYPE_META.meeting;
                    const Icon = meta.icon;
                    const isGoogle = appt.source === 'google';
                    return (
                      <div key={appt.id || i} className="glass-card p-3 flex items-start gap-3">
                        <div className="flex-none w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: meta.bg, border: `1px solid ${meta.color}40` }}>
                          <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{appt.title}</p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {formatTime(appt.start)}</span>
                            {appt.landlord_name && <span className="flex items-center gap-1"><User className="w-2.5 h-2.5" /> {appt.landlord_name}</span>}
                            {isAdmin && appt.agent_name && <span className="flex items-center gap-1"><User className="w-2.5 h-2.5" /> {appt.agent_name}</span>}
                            {isGoogle && <span className="text-[8px] px-1 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd' }}>G</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Legend */}
              <div className="glass-card p-3 space-y-1.5">
                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Legend</p>
                {Object.entries(TYPE_META).map(([key, meta]) => (
                  <div key={key} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ background: meta.bg, border: `1px solid ${meta.color}` }} />
                    <span className="text-[11px] text-muted-foreground capitalize">{key}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── List view ── */
          events.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm font-semibold text-foreground">No upcoming appointments</p>
              <p className="text-xs text-muted-foreground mt-1">Click "Book" to schedule your first meeting.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {listGroups.today.length > 0 && <DateGroup label="Today" items={listGroups.today} isAdmin={isAdmin} />}
              {listGroups.tomorrow.length > 0 && <DateGroup label="Tomorrow" items={listGroups.tomorrow} isAdmin={isAdmin} />}
              {listGroups.week.length > 0 && <DateGroup label="This Week" items={listGroups.week} isAdmin={isAdmin} />}
              {listGroups.later.length > 0 && <DateGroup label="Later" items={listGroups.later} isAdmin={isAdmin} />}
            </div>
          )
        )}
      </div>

      <AppointmentBookingDialog open={bookingOpen} onOpenChange={setBookingOpen} onBooked={loadEvents} />
    </div>
  );
}