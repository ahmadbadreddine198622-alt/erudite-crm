// Appointments — HubSpot-style appointments page.
// Shows a clean list of upcoming appointments (Google Calendar + CRM),
// with a "Book Appointment" button and Google Calendar connection card.

import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import AppointmentBookingDialog from '@/components/appointments/AppointmentBookingDialog';
import GoogleWorkspaceConnectBanner from '@/components/settings/GoogleWorkspaceConnectBanner';
import {
  Calendar, Plus, Clock, MapPin, User, Loader2, CalendarCheck,
  Phone, Eye, Users as UsersIcon, ChevronRight
} from 'lucide-react';

const TYPE_META = {
  meeting: { icon: UsersIcon, color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  call: { icon: Phone, color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  viewing: { icon: Eye, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
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

function AppointmentCard({ appt }) {
  const meta = TYPE_META[appt.type] || TYPE_META.meeting;
  const Icon = meta.icon;
  const isGoogle = appt.source === 'google';

  return (
    <div className="glass-card p-4 flex items-center gap-4 group hover:bg-white/[0.08] transition-all">
      {/* Date block */}
      <div className="flex-none text-center w-14">
        <p className="text-[10px] font-bold uppercase text-muted-foreground">{formatDate(appt.start).split(' ')[0]}</p>
        <p className="text-xl font-bold text-foreground">{formatDate(appt.start).split(' ')[1]}</p>
        <p className="text-[10px] text-muted-foreground">{formatDate(appt.start).split(' ')[2]}</p>
      </div>

      {/* Type icon */}
      <div className="flex-none w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: meta.bg, border: `1px solid ${meta.color}40` }}>
        <Icon className="w-4 h-4" style={{ color: meta.color }} />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{appt.title}</p>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(appt.start)}</span>
          {appt.end && <span>{formatDuration(appt.start, appt.end)}</span>}
          {appt.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {appt.location}</span>}
          {appt.landlord_name && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {appt.landlord_name}</span>}
          {isGoogle && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd' }}>Google</span>}
          {appt.status && appt.status !== 'scheduled' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full capitalize" style={{ background: appt.status === 'cancelled' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: appt.status === 'cancelled' ? '#f87171' : '#34d399' }}>{appt.status}</span>
          )}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-none" />
    </div>
  );
}

function DateGroup({ label, items }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <CalendarCheck className="w-3.5 h-3.5 text-accent" />
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</h3>
        <span className="text-[10px] text-muted-foreground">({items.length})</span>
      </div>
      <div className="space-y-2">
        {items.map((appt, i) => <AppointmentCard key={appt.id || i} appt={appt} />)}
      </div>
    </div>
  );
}

export default function Appointments() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getUserCalendarEvents', { days_ahead: 30 });
      const data = res?.data ?? res;
      if (data?.ok !== false) {
        setEvents(data.events || []);
      }
    } catch (e) {
      // Fallback: just load CRM appointments
      try {
        const appts = await base44.entities.LandlordAppointment.list('datetime', 50);
        setEvents((appts || []).map((a) => ({ ...a, title: `${a.type || 'meeting'}`, source: 'crm' })));
      } catch (_) { /* empty */ }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // Group events: Today, Tomorrow, This Week, Later
  const now = new Date();
  const todayStr = now.toDateString();
  const tomorrow = new Date(now.getTime() + 86400000);
  const tomorrowStr = tomorrow.toDateString();
  const weekEnd = new Date(now.getTime() + 7 * 86400000);

  const groups = {
    today: [],
    tomorrow: [],
    week: [],
    later: [],
  };

  (events || []).forEach((e) => {
    if (!e.start) return;
    const d = new Date(e.start);
    const dStr = d.toDateString();
    if (dStr === todayStr) groups.today.push(e);
    else if (dStr === tomorrowStr) groups.tomorrow.push(e);
    else if (d <= weekEnd) groups.week.push(e);
    else groups.later.push(e);
  });

  return (
    <div className="page-root">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="page-title text-3xl flex items-center gap-2"><Calendar className="w-7 h-7 text-accent" /> Appointments</h1>
            <p className="page-subtitle mt-1">Your calendar — synced with Google. Book meetings, viewings, and calls.</p>
          </div>
          <Button onClick={() => setBookingOpen(true)} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5">
            <Plus className="w-4 h-4" /> Book Appointment
          </Button>
        </div>

        {/* Google Calendar connection */}
        <div className="rounded-2xl overflow-hidden">
          <GoogleWorkspaceConnectBanner variant="compact" />
        </div>

        {/* Appointments list */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
        ) : events.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm font-semibold text-foreground">No upcoming appointments</p>
            <p className="text-xs text-muted-foreground mt-1">Click "Book Appointment" to schedule your first meeting.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.today.length > 0 && <DateGroup label="Today" items={groups.today} />}
            {groups.tomorrow.length > 0 && <DateGroup label="Tomorrow" items={groups.tomorrow} />}
            {groups.week.length > 0 && <DateGroup label="This Week" items={groups.week} />}
            {groups.later.length > 0 && <DateGroup label="Later" items={groups.later} />}
          </div>
        )}
      </div>

      <AppointmentBookingDialog open={bookingOpen} onOpenChange={setBookingOpen} onBooked={loadEvents} />
    </div>
  );
}