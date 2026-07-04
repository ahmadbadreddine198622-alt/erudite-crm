// AppointmentBookingDialog — modal for booking a new appointment.
// Fields: title, date, time (12h + AM/PM), duration, type, landlord, location, notes,
// reminder delay + reminder text for the landlord.

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Calendar, Clock, User, MapPin, Bell, Loader2 } from 'lucide-react';

const TYPES = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'call', label: 'Call' },
  { value: 'viewing', label: 'Viewing' },
];
const DURATIONS = [15, 30, 45, 60, 90, 120];
const REMINDER_OPTIONS = [
  { value: 0, label: 'No reminder' },
  { value: 1, label: '1 hour before' },
  { value: 3, label: '3 hours before' },
  { value: 24, label: '1 day before' },
  { value: 48, label: '2 days before' },
];

export default function AppointmentBookingDialog({ open, onOpenChange, onBooked }) {
  const [landlords, setLandlords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    landlord_id: '',
    title: '',
    date: '',
    hour: '10',
    ampm: 'AM',
    duration: 30,
    type: 'meeting',
    location: '',
    notes: '',
    reminder_hours: 0,
    reminder_text: '',
  });

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    base44.entities.Landlord.list('-created_date', 200)
      .then((data) => setLandlords(data || []))
      .catch(() => setLandlords([]))
      .finally(() => setLoading(false));
  }, [open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.landlord_id) { toast.error('Please select a landlord'); return; }
    if (!form.date) { toast.error('Please pick a date'); return; }
    if (!form.title.trim()) { toast.error('Please enter a title'); return; }

    let hourNum = Math.min(12, Math.max(1, parseInt(form.hour, 10) || 12));
    if (form.ampm === 'PM' && hourNum < 12) hourNum += 12;
    if (form.ampm === 'AM' && hourNum === 12) hourNum = 0;
    const hh = String(hourNum).padStart(2, '0');
    const datetime = `${form.date}T${hh}:00:00+04:00`;

    setSaving(true);
    try {
      const res = await base44.functions.invoke('bookAppointment', {
        landlord_id: form.landlord_id,
        title: form.title.trim(),
        datetime,
        duration_minutes: Number(form.duration),
        type: form.type,
        location: form.location,
        notes: form.notes,
        reminder_delay_hours: Number(form.reminder_hours) > 0 ? Number(form.reminder_hours) : undefined,
        reminder_text: form.reminder_hours > 0 ? form.reminder_text : undefined,
      });
      const data = res?.data ?? res;
      if (data?.ok !== false) {
        toast.success(`Appointment booked — ${data?.landlord_name || 'landlord'}`);
        onBooked?.(data);
        onOpenChange(false);
        setForm({ landlord_id: '', title: '', date: '', hour: '10', ampm: 'AM', duration: 30, type: 'meeting', location: '', notes: '', reminder_hours: 0, reminder_text: '' });
      } else {
        toast.error(data?.error || 'Failed to book appointment');
      }
    } catch (e) {
      toast.error(e.message || 'Failed to book appointment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Calendar className="w-5 h-5 text-accent" /> Book Appointment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Landlord */}
          <div>
            <Label className="text-xs mb-1.5 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Landlord / Owner</Label>
            <select
              value={form.landlord_id}
              onChange={(e) => set('landlord_id', e.target.value)}
              className="glass-input w-full px-3 py-2 text-sm rounded-lg"
              disabled={loading}
            >
              <option value="">{loading ? 'Loading…' : 'Select landlord…'}</option>
              {landlords.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.full_name_en || l.full_name_ar || 'Unnamed'}{l.phone ? ` · ${l.phone}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <Label className="text-xs mb-1.5">Title</Label>
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Property viewing discussion" className="glass-input" />
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs mb-1.5 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Date</Label>
              <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className="glass-input" />
            </div>
            <div>
              <Label className="text-xs mb-1.5 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Time</Label>
              <div className="flex gap-1">
                <Input type="number" min="1" max="12" value={form.hour} onChange={(e) => set('hour', e.target.value)} className="glass-input w-16 text-center" />
                <select value={form.ampm} onChange={(e) => set('ampm', e.target.value)} className="glass-input px-2 text-sm rounded-lg">
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1.5">Duration</Label>
              <select value={form.duration} onChange={(e) => set('duration', e.target.value)} className="glass-input w-full px-2 py-2 text-sm rounded-lg">
                {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>

          {/* Type + Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5">Type</Label>
              <select value={form.type} onChange={(e) => set('type', e.target.value)} className="glass-input w-full px-2 py-2 text-sm rounded-lg capitalize">
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs mb-1.5 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Location</Label>
              <Input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Office / Site / Online" className="glass-input" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs mb-1.5">Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Agenda, preparation notes…" className="glass-input min-h-[60px]" />
          </div>

          {/* Reminder */}
          <div className="space-y-2 p-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400">
              <Bell className="w-3.5 h-3.5" /> Landlord Reminder
            </div>
            <select value={form.reminder_hours} onChange={(e) => set('reminder_hours', Number(e.target.value))} className="glass-input w-full px-2 py-2 text-sm rounded-lg">
              {REMINDER_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            {form.reminder_hours > 0 && (
              <Textarea
                value={form.reminder_text}
                onChange={(e) => set('reminder_text', e.target.value)}
                placeholder="Reminder message for the landlord… Use {{landlord_name}} and {{title}}"
                className="glass-input min-h-[50px] text-sm"
              />
            )}
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