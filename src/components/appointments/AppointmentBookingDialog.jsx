// AppointmentBookingDialog — HubSpot-style booking modal.
// Fields: title, guest emails (chips), date + time + timezone, duration,
// multiple reminders (when + custom text, pre-filled from user defaults).

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Calendar, Clock, Mail, Plus, X, Bell, Loader2, Globe, User } from 'lucide-react';

const DURATIONS = [15, 30, 45, 60, 90, 120];
const TIMEZONES = [
  'Asia/Dubai', 'Asia/Riyadh', 'Asia/Kuwait', 'Asia/Qatar', 'Asia/Bahrain',
  'Europe/London', 'Europe/Moscow', 'Europe/Istanbul', 'Europe/Paris',
  'Asia/Kolkata', 'Asia/Karachi', 'Asia/Dhaka', 'Asia/Shanghai', 'Asia/Singapore',
  'Africa/Cairo', 'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'UTC',
];
const REMINDER_WHEN_OPTIONS = [
  { value: 1, label: '1 hour before' },
  { value: 3, label: '3 hours before' },
  { value: 6, label: '6 hours before' },
  { value: 24, label: '1 day before' },
  { value: 48, label: '2 days before' },
  { value: 72, label: '3 days before' },
];

// Convert a date+hour+ampm into an ISO string using the selected timezone offset
function buildDatetime(date, hour, ampm, timezone) {
  let hourNum = Math.min(12, Math.max(1, parseInt(hour, 10) || 12));
  if (ampm === 'PM' && hourNum < 12) hourNum += 12;
  if (ampm === 'AM' && hourNum === 12) hourNum = 0;
  const hh = String(hourNum).padStart(2, '0');
  // Get the timezone offset for the selected date
  let offset = '+04:00'; // default Dubai
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, timeZoneName: 'longOffset',
    }).formatToParts(new Date(date + 'T12:00:00'));
    const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value || '';
    const match = tzPart.match(/GMT([+-]\d{1,2}:?\d{2})/);
    if (match) offset = match[1].replace(/(\d{2})(\d{2})/, '$1:$2').replace('+', '+');
  } catch (_) {}
  return `${date}T${hh}:00:00${offset}`;
}

export default function AppointmentBookingDialog({ open, onOpenChange, onBooked }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [landlords, setLandlords] = useState([]);
  const [guestInput, setGuestInput] = useState('');
  const [form, setForm] = useState({
    landlord_id: '',
    title: '',
    date: '',
    hour: '10',
    ampm: 'AM',
    timezone: 'Asia/Dubai',
    duration: 30,
    reminders: [], // [{ when_hours, text }]
  });

  // Load user defaults + landlord list when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      base44.auth.me().catch(() => null),
      base44.entities.Landlord.list('-created_date', 200).catch(() => []),
    ]).then(([me, llList]) => {
      setLandlords(llList || []);
      const defaultReminders = (me?.default_reminders || []).map((r) => ({
        when_hours: r.when_hours,
        text: r.text || me?.default_reminder_text || '',
      }));
      setForm((f) => ({
        ...f,
        reminders: defaultReminders.length ? defaultReminders : [],
      }));
    }).finally(() => setLoading(false));
  }, [open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addGuest = () => {
    const email = guestInput.trim().toLowerCase();
    if (!email || !email.includes('@')) { toast.error('Enter a valid email'); return; }
    // Add as a reminder guest chip — store in a guests array
    setForm((f) => {
      const existing = f.guests || [];
      if (existing.includes(email)) return f;
      return { ...f, guests: [...existing, email] };
    });
    setGuestInput('');
  };

  const removeGuest = (email) => {
    setForm((f) => ({ ...f, guests: (f.guests || []).filter((g) => g !== email) }));
  };

  const addReminder = () => {
    setForm((f) => ({
      ...f,
      reminders: [...(f.reminders || []), { when_hours: 24, text: f.defaultReminderText || '' }],
    }));
  };

  const updateReminder = (idx, key, val) => {
    setForm((f) => ({
      ...f,
      reminders: f.reminders.map((r, i) => i === idx ? { ...r, [key]: val } : r),
    }));
  };

  const removeReminder = (idx) => {
    setForm((f) => ({ ...f, reminders: f.reminders.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!form.date) { toast.error('Please pick a date'); return; }
    if (!form.title.trim()) { toast.error('Please enter a title'); return; }

    const datetime = buildDatetime(form.date, form.hour, form.ampm, form.timezone);
    const guests = form.guests || [];

    setSaving(true);
    try {
      const res = await base44.functions.invoke('bookAppointment', {
        landlord_id: form.landlord_id || undefined,
        title: form.title.trim(),
        guest_emails: guests.length ? guests : undefined,
        datetime,
        timezone: form.timezone,
        duration_minutes: Number(form.duration),
        type: 'meeting',
        location: form.location || undefined,
        notes: form.notes || undefined,
        reminders: (form.reminders || []).length ? form.reminders : undefined,
      });
      const data = res?.data ?? res;
      if (data?.ok !== false) {
        toast.success(`Appointment booked — ${data?.landlord_name || 'guest'}`);
        onBooked?.(data);
        onOpenChange(false);
        setForm({ landlord_id: '', title: '', date: '', hour: '10', ampm: 'AM', timezone: 'Asia/Dubai', duration: 30, reminders: [], guests: [], location: '', notes: '' });
      } else {
        toast.error(data?.error || 'Failed to book appointment');
      }
    } catch (e) {
      toast.error(e.message || 'Failed to book appointment');
    } finally {
      setSaving(false);
    }
  };

  const guests = form.guests || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Calendar className="w-5 h-5 text-accent" /> Book Appointment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Meeting Title */}
          <div>
            <Label className="text-xs mb-1.5">Meeting title</Label>
            <Input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Property viewing discussion"
              className="glass-input"
            />
          </div>

          {/* Add Guests (email chips) */}
          <div>
            <Label className="text-xs mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Add guests
            </Label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={guestInput}
                onChange={(e) => setGuestInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGuest(); } }}
                placeholder="guest@email.com"
                className="glass-input flex-1"
              />
              <Button type="button" size="sm" variant="ghost" onClick={addGuest} className="glass-input px-3">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {guests.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {guests.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: 'hsl(38 92% 50% / 0.12)', border: '1px solid hsl(38 92% 50% / 0.3)', color: 'hsl(38 92% 62%)' }}
                  >
                    {email}
                    <button onClick={() => removeGuest(email)} className="hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Optional: link to a landlord */}
          <div>
            <Label className="text-xs mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Link to landlord <span className="text-muted-foreground normal-case font-normal">(optional)</span>
            </Label>
            <select
              value={form.landlord_id}
              onChange={(e) => set('landlord_id', e.target.value)}
              className="glass-input w-full px-3 py-2 text-sm rounded-lg"
              disabled={loading}
            >
              <option value="">None</option>
              {landlords.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.full_name_en || l.full_name_ar || 'Unnamed'}{l.phone ? ` · ${l.phone}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date + Time + Timezone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Date
              </Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                className="glass-input"
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Time
              </Label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={form.hour}
                  onChange={(e) => set('hour', e.target.value)}
                  className="glass-input w-16 text-center"
                />
                <select
                  value={form.ampm}
                  onChange={(e) => set('ampm', e.target.value)}
                  className="glass-input px-2 text-sm rounded-lg"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
          </div>

          {/* Timezone + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Timezone
              </Label>
              <select
                value={form.timezone}
                onChange={(e) => set('timezone', e.target.value)}
                className="glass-input w-full px-2 py-2 text-sm rounded-lg"
              >
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs mb-1.5">Duration</Label>
              <select
                value={form.duration}
                onChange={(e) => set('duration', e.target.value)}
                className="glass-input w-full px-2 py-2 text-sm rounded-lg"
              >
                {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>

          {/* Location + Notes (compact) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5">Location</Label>
              <Input
                value={form.location || ''}
                onChange={(e) => set('location', e.target.value)}
                placeholder="Office / Online"
                className="glass-input"
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5">Notes</Label>
              <Input
                value={form.notes || ''}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Agenda…"
                className="glass-input"
              />
            </div>
          </div>

          {/* Reminders (multiple) */}
          <div className="space-y-2 p-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-400">
                <Bell className="w-3.5 h-3.5" /> Reminders
              </span>
              <button
                onClick={addReminder}
                className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md hover:bg-white/10"
                style={{ color: '#60a5fa' }}
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {(form.reminders || []).length === 0 && (
              <p className="text-xs text-muted-foreground py-1">No reminders — click "Add" to create one.</p>
            )}
            {(form.reminders || []).map((r, idx) => (
              <div key={idx} className="flex flex-col gap-1.5 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2">
                  <select
                    value={r.when_hours}
                    onChange={(e) => updateReminder(idx, 'when_hours', Number(e.target.value))}
                    className="glass-input px-2 py-1.5 text-xs rounded-md flex-1"
                  >
                    {REMINDER_WHEN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <button onClick={() => removeReminder(idx)} className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Textarea
                  value={r.text}
                  onChange={(e) => updateReminder(idx, 'text', e.target.value)}
                  placeholder="Reminder message… Use {{landlord_name}}, {{title}}, {{agent_name}}"
                  className="glass-input min-h-[40px] text-xs"
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            {saving ? 'Booking…' : 'Book Appointment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}