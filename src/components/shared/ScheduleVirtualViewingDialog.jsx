import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Video, Calendar, Clock, ExternalLink, Loader2, Copy } from 'lucide-react';
import { toast } from 'sonner';

const DURATIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
];

export default function ScheduleVirtualViewingDialog({ open, onClose, prefill = {} }) {
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    property_title:    '',
    property_address:  '',
    landlord_name:     '',
    landlord_email:    '',
    landlord_phone:    '',
    buyer_name:        '',
    buyer_email:       '',
    buyer_phone:       '',
    viewing_date:      today,
    viewing_time:      '10:00',
    duration_minutes:  30,
  });
  const [loading, setLoading]   = useState(false);
  const [result,  setResult]    = useState(null);

  // Apply prefill when dialog opens
  useEffect(() => {
    if (open) {
      setResult(null);
      setForm(prev => ({
        ...prev,
        property_title:   prefill.property_title   || '',
        property_address: prefill.property_address  || '',
        landlord_name:    prefill.landlord_name     || '',
        landlord_email:   prefill.landlord_email    || '',
        landlord_phone:   prefill.landlord_phone    || '',
        buyer_name:       prefill.buyer_name        || '',
        buyer_email:      prefill.buyer_email       || '',
        buyer_phone:      prefill.buyer_phone       || '',
        viewing_date:     today,
        viewing_time:     '10:00',
        duration_minutes: 30,
      }));
    }
  }, [open]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    if (!form.viewing_date || !form.viewing_time) {
      toast.error('Date and time are required');
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('scheduleVirtualViewing', form);
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      toast.success('Virtual viewing scheduled! Google Meet link ready.');
    } catch (e) {
      toast.error('Failed to schedule: ' + (e.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (!result?.meet_link) return;
    navigator.clipboard.writeText(result.meet_link);
    toast.success('Meet link copied!');
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-accent" />
            Schedule Virtual Viewing
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 py-2">
            {/* Property */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Property</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Property Title / Unit</Label>
                  <Input placeholder="e.g. Unit 4B, Palm Jumeirah" value={form.property_title} onChange={e => set('property_title', e.target.value)} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Address (optional)</Label>
                  <Input placeholder="Building / Community" value={form.property_address} onChange={e => set('property_address', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Owner */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Owner / Landlord</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input placeholder="Owner name" value={form.landlord_name} onChange={e => set('landlord_name', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email (for invite)</Label>
                  <Input type="email" placeholder="owner@example.com" value={form.landlord_email} onChange={e => set('landlord_email', e.target.value)} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">WhatsApp (optional — for confirmation)</Label>
                  <Input placeholder="+971…" value={form.landlord_phone} onChange={e => set('landlord_phone', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Buyer / Tenant */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Buyer / Tenant</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input placeholder="Buyer / tenant name" value={form.buyer_name} onChange={e => set('buyer_name', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email (for invite)</Label>
                  <Input type="email" placeholder="buyer@example.com" value={form.buyer_email} onChange={e => set('buyer_email', e.target.value)} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">WhatsApp (optional — for confirmation)</Label>
                  <Input placeholder="+971…" value={form.buyer_phone} onChange={e => set('buyer_phone', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Date / Time / Duration */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Schedule (Dubai Time)</h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1 col-span-1">
                  <Label className="text-xs flex items-center gap-1"><Calendar className="w-3 h-3" /> Date</Label>
                  <Input type="date" value={form.viewing_date} onChange={e => set('viewing_date', e.target.value)} />
                </div>
                <div className="space-y-1 col-span-1">
                  <Label className="text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> Time</Label>
                  <Input type="time" value={form.viewing_time} onChange={e => set('viewing_time', e.target.value)} />
                </div>
                <div className="space-y-1 col-span-1">
                  <Label className="text-xs">Duration</Label>
                  <select
                    value={form.duration_minutes}
                    onChange={e => set('duration_minutes', Number(e.target.value))}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Success state */
          <div className="py-4 space-y-4">
            <div className="rounded-xl p-4 bg-emerald-500/10 border border-emerald-500/20 text-center">
              <Video className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-emerald-400">Virtual Viewing Scheduled!</p>
              <p className="text-xs text-white/60 mt-1">Calendar invites sent to all attendees.</p>
            </div>

            {result.meet_link && (
              <div className="rounded-lg border border-white/10 p-3 space-y-2">
                <p className="text-xs text-white/50 font-semibold uppercase tracking-wider">Google Meet Link</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono text-accent flex-1 truncate">{result.meet_link}</p>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copyLink}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <a href={result.meet_link} target="_blank" rel="noopener noreferrer">
                    <Button size="icon" variant="ghost" className="h-7 w-7">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                </div>
              </div>
            )}

            {result.calendar_link && (
              <a href={result.calendar_link} target="_blank" rel="noopener noreferrer" className="block">
                <Button variant="outline" size="sm" className="w-full gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> View in Google Calendar
                </Button>
              </a>
            )}
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={loading} className="gap-1.5">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                {loading ? 'Scheduling…' : 'Schedule & Create Meet Link'}
              </Button>
            </>
          ) : (
            <Button onClick={onClose} className="w-full">Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}