import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Calendar, Clock, MapPin, Video, CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function Field({ label, icon: Icon, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs text-white/50 mb-1.5 font-medium">
        {Icon && <Icon className="w-3.5 h-3.5" />}{label}
      </label>
      {children}
    </div>
  );
}

export default function ViewingCalendarAssistant({ lead, onSuccess, onClose }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    viewing_date: today,
    viewing_time: '10:00',
    duration_minutes: 30,
    property_address: lead?.preferred_locations?.[0] || '',
    virtual_tour_link: '',
  });
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);

  const { data: properties = [] } = useQuery({
    queryKey: ['properties-for-viewing'],
    queryFn: () => base44.entities.Property.filter({ status: 'available' }, '-created_date', 30),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSchedule() {
    if (!form.viewing_date || !form.viewing_time) return;
    setStatus('loading');
    try {
      const res = await base44.functions.invoke('schedulePropertyViewing', {
        lead_id: lead.id,
        lead_name: lead.full_name,
        lead_phone: lead.whatsapp || lead.phone,
        property_title: form.property_address || lead.preferred_locations?.[0] || 'Property Viewing',
        property_address: form.property_address,
        virtual_tour_link: form.virtual_tour_link,
        viewing_date: form.viewing_date,
        viewing_time: form.viewing_time,
        duration_minutes: Number(form.duration_minutes),
      });
      setResult(res.data);
      setStatus('success');
      onSuccess?.(res.data);
    } catch (err) {
      setResult({ error: err.message });
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-emerald-400" />
        </div>
        <div>
          <p className="text-base font-semibold text-white">Viewing Scheduled!</p>
          <p className="text-sm text-white/50 mt-1">
            Calendar event created{result?.wa_confirmation_sent ? ' — WhatsApp confirmation sent' : ''}.
          </p>
        </div>
        {result?.calendar_link && (
          <a href={result.calendar_link} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-amber-400 hover:underline">
            <ExternalLink className="w-3.5 h-3.5" /> Open in Google Calendar
          </a>
        )}
        <Button size="sm" variant="outline" onClick={onClose} className="mt-2">Done</Button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Scheduling failed</p>
          <p className="text-xs text-white/40 mt-1">{result?.error || 'Unknown error'}</p>
          <p className="text-xs text-white/30 mt-1">Make sure Google Calendar is connected in Settings.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setStatus(null)}>Try Again</Button>
      </div>
    );
  }

  const btnLabel = status === 'loading' ? null : 'Schedule & Confirm';

  return (
    <div className="space-y-4">
      {/* Lead context */}
      <div className="glass-card rounded-xl p-3 flex items-center gap-3 border border-amber-500/20">
        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-bold shrink-0">
          {lead?.full_name?.[0] || '?'}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{lead?.full_name}</p>
          <p className="text-xs text-white/40 truncate">{lead?.phone || lead?.email || 'No contact'}</p>
        </div>
        {lead?.ai_lead_score != null && (
          <span className="ml-auto text-lg font-bold text-amber-400 tabular-nums">{lead.ai_lead_score}</span>
        )}
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Viewing Date" icon={Calendar}>
          <input
            type="date"
            min={today}
            value={form.viewing_date}
            onChange={e => set('viewing_date', e.target.value)}
            className="glass-input w-full rounded-lg px-3 py-2 text-sm text-white"
          />
        </Field>
        <Field label="Time (UAE)" icon={Clock}>
          <input
            type="time"
            value={form.viewing_time}
            onChange={e => set('viewing_time', e.target.value)}
            className="glass-input w-full rounded-lg px-3 py-2 text-sm text-white"
          />
        </Field>
      </div>

      {/* Duration */}
      <Field label="Duration" icon={Clock}>
        <select
          value={form.duration_minutes}
          onChange={e => set('duration_minutes', e.target.value)}
          className="glass-input w-full rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value={30}>30 minutes</option>
          <option value={45}>45 minutes</option>
          <option value={60}>1 hour</option>
          <option value={90}>1.5 hours</option>
        </select>
      </Field>

      {/* Property Address */}
      <Field label="Meeting Location / Property Address" icon={MapPin}>
        <Input
          placeholder="e.g. Unit 204, Marina Gate 1, Dubai Marina"
          value={form.property_address}
          onChange={e => set('property_address', e.target.value)}
          className="glass-input"
        />
        {properties.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {properties.slice(0, 4).map(p => (
              <button
                key={p.id}
                onClick={() => set('property_address', p.address || p.building_name || p.location || p.title)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/50 hover:bg-white/14 hover:text-white/80 transition-colors border border-white/10"
              >
                {p.building_name || p.title}
              </button>
            ))}
          </div>
        )}
      </Field>

      {/* Virtual Tour Link */}
      <Field label="Virtual Tour Link (optional)" icon={Video}>
        <Input
          placeholder="https://my.matterport.com/..."
          value={form.virtual_tour_link}
          onChange={e => set('virtual_tour_link', e.target.value)}
          className="glass-input"
        />
      </Field>

      {/* Info strip */}
      <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
        <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-300/80 leading-relaxed">
          Creates a Google Calendar event, updates lead to <strong>Viewing</strong> stage, and sends a WhatsApp
          confirmation{lead?.phone ? ` to ${lead.whatsapp || lead.phone}` : ''} with location
          {form.virtual_tour_link ? ' and virtual tour link' : ''}.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onClose} className="flex-1">Cancel</Button>
        <Button
          size="sm"
          onClick={handleSchedule}
          disabled={!form.viewing_date || !form.viewing_time || status === 'loading'}
          className="flex-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
        >
          {status === 'loading' ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scheduling…</>
          ) : (
            <><Calendar className="w-3.5 h-3.5" /> {btnLabel}</>
          )}
        </Button>
      </div>
    </div>
  );
}