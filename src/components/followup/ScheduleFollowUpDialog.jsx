import { useState } from 'react';
import { format } from 'date-fns';
import { X, Clock, Calendar, CheckCircle2, AlertCircle, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const TYPE_OPTIONS = [
  { value: 'callback', label: 'Callback', icon: '📞' },
  { value: 'appointment', label: 'Appointment', icon: '📅' },
  { value: 'task', label: 'Task', icon: '✓' },
];

const STATUS_COLORS = {
  pending: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  done: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  missed: 'bg-red-500/10 text-red-400 border-red-500/30',
  cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

const STATUS_ICONS = {
  pending: <Clock className="w-3 h-3" />,
  done: <CheckCircle2 className="w-3 h-3" />,
  missed: <AlertCircle className="w-3 h-3" />,
  cancelled: <Ban className="w-3 h-3" />,
};

export default function ScheduleFollowUpDialog({ landlord, open, onClose }) {
  const qc = useQueryClient();
  const [formData, setFormData] = useState({
    type: 'callback',
    scheduled_at: '',
    notes: '',
    notify_landlord: true,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        created_source: 'manual',
        stage_at_creation: landlord.stage,
      };
      const created = await base44.entities.FollowUp.create(payload);
      try {
        await base44.functions.invoke('syncFollowUpCalendar', { follow_up_id: created.id, action: 'create' });
      } catch (e) {
        console.warn('Calendar sync failed:', e.message);
      }
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['followups', landlord.id] });
      qc.invalidateQueries({ queryKey: ['landlord-followups', landlord.id] });
      toast.success('Follow-up scheduled and added to calendar');
      setFormData({ type: 'callback', scheduled_at: '', notes: '', notify_landlord: true });
      onClose();
    },
    onError: (e) => toast.error('Failed to schedule: ' + e.message),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.scheduled_at) {
      toast.error('Please select a date and time');
      return;
    }
    createMutation.mutate({
      landlord_id: landlord.id,
      ...formData,
    });
  };

  const resetForm = () => {
    setFormData({ type: 'callback', scheduled_at: '', notes: '', notify_landlord: true });
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) { onClose(); resetForm(); } }}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="pb-4 border-b border-white/10">
          <SheetTitle className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.95)' }}>
            <Calendar className="w-5 h-5 text-accent" />
            Schedule Follow-up
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Landlord Info */}
          <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{landlord.full_name_en || landlord.full_name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Stage: <span className="text-accent">{landlord.stage?.replace(/_/g, ' ')}</span>
            </p>
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Type</label>
            <Select value={formData.type} onValueChange={(v) => setFormData(f => ({ ...f, type: v }))}>
              <SelectTrigger className="w-full" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-sm">
                    {opt.icon} {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scheduled At */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Date & Time</label>
            <input
              type="datetime-local"
              value={formData.scheduled_at}
              onChange={(e) => setFormData(f => ({ ...f, scheduled_at: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-md"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
            />
          </div>

          {/* Notify Landlord Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>Notify Landlord</p>
              <p className="text-xs text-muted-foreground">Send WhatsApp reminder</p>
            </div>
            <button
              type="button"
              onClick={() => setFormData(f => ({ ...f, notify_landlord: !f.notify_landlord }))}
              className={`w-12 h-6 rounded-full transition-colors ${formData.notify_landlord ? 'bg-accent' : 'bg-slate-600'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${formData.notify_landlord ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))}
              placeholder="Add context for this follow-up..."
              rows={4}
              className="w-full px-3 py-2 text-sm rounded-md resize-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={createMutation.isPending || !formData.scheduled_at}
            className="w-full gap-2"
          >
            <Calendar className="w-4 h-4" />
            {createMutation.isPending ? 'Scheduling...' : 'Schedule Follow-up'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}