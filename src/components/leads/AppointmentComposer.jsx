import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Clock, Building, User, Check, X, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

const APPOINTMENT_TYPES = [
  { key: 'viewing', label: 'Property Viewing', defaultDuration: 45 },
  { key: 'owner_meeting', label: 'Owner Meeting', defaultDuration: 30 },
  { key: 'followup', label: 'Follow-up Call', defaultDuration: 20 },
];

export default function AppointmentComposer({ lead, property, onClose }) {
  const queryClient = useQueryClient();
  const [appointmentType, setAppointmentType] = useState('viewing');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(45);
  const [showConfirmChip, setShowConfirmChip] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [suggestedSlots, setSuggestedSlots] = useState([]);

  // Fetch agent's calendar events for slot suggestions
  const { data: calendarEvents = [] } = useQuery({
    queryKey: ['calendar-events', date],
    queryFn: async () => {
      if (!date) return [];
      const startDate = new Date(date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);
      const result = await base44.functions.invoke('getCalendarEvents', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      });
      return result.data || [];
    },
    enabled: !!date,
  });

  // Update duration when type changes
  useEffect(() => {
    const type = APPOINTMENT_TYPES.find((t) => t.key === appointmentType);
    if (type) setDuration(type.defaultDuration);
  }, [appointmentType]);

  const scheduleMutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke('schedulePropertyViewing', payload),
    onSuccess: () => {
      toast.success('Appointment scheduled! Calendar invite sent.');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['activities', lead.id] });
      onClose?.();
    },
    onError: (err) => {
      const detail = err?.response?.data?.message || err.message || 'Failed to schedule';
      toast.error('Scheduling failed: ' + detail);
      setIsConfirming(false);
    },
  });

  // Generate suggested slots from calendar
  const handleSuggestSlots = () => {
    const today = new Date();
    const slots = [];
    const workHours = [10, 11, 14, 15, 16]; // 10am, 11am, 2pm, 3pm, 4pm

    for (let i = 1; i <= 7 && slots.length < 3; i++) {
      const slotDate = new Date(today);
      slotDate.setDate(slotDate.getDate() + i);
      // Skip weekends
      if (slotDate.getDay() === 0 || slotDate.getDay() === 6) continue;

      for (const hour of workHours) {
        const slotDateTime = new Date(slotDate);
        slotDateTime.setHours(hour, 0, 0, 0);

        // Check if busy
        const isBusy = calendarEvents.some((event) => {
          const eventStart = new Date(event.start);
          const eventEnd = new Date(event.end);
          return slotDateTime >= eventStart && slotDateTime < eventEnd;
        });

        if (!isBusy && slots.length < 3) {
          slots.push({
            date: format(slotDateTime, 'yyyy-MM-dd'),
            time: format(slotDateTime, 'HH:mm'),
            label: format(slotDateTime, 'EEE, MMM d · h:mm a'),
          });
        }
      }
    }
    setSuggestedSlots(slots);
  };

  const handleSelectSlot = (slot) => {
    setDate(slot.date);
    setTime(slot.time);
    setShowConfirmChip(true);
  };

  const handleConfirm = () => {
    if (!date || !time) {
      toast.error('Please select a date and time');
      return;
    }

    const propertyAddress = property
      ? `${property.building_name || 'Property'} · Unit ${property.unit_no || '—'}, ${property.location || ''}`
      : lead.interested_properties?.[0] || 'Property';

    const payload = {
      lead_id: lead.id,
      lead_name: lead.full_name || lead.name || 'Lead',
      lead_phone: lead.phone || '',
      property_title: property?.title || propertyAddress,
      property_address: propertyAddress,
      virtual_tour_link: property?.virtual_tour_url || '',
      viewing_date: date,
      viewing_time: time,
      duration_minutes: duration,
      agent_email: lead.assigned_agent_email || '',
    };

    setIsConfirming(true);
    scheduleMutation.mutate(payload);
  };

  const resolvedDateTime = date && time ? format(parseISO(`${date}T${time}`), 'EEE, MMM d, h:mm a') : '';

  // Confirm Chip UI
  if (showConfirmChip) {
    return (
      <div
        className="rounded-xl p-4 mb-4"
        style={{
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.3)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Check className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'hsl(38 92% 50%)' }}>
            Confirm Appointment
          </span>
        </div>

        <div className="space-y-2 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-foreground font-medium">{resolvedDateTime}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-foreground">{duration} minutes</span>
          </div>
          <div className="flex items-center gap-2">
            <Building className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-foreground truncate">
              {property?.building_name || 'Property'} {property?.unit_no && `· Unit ${property.unit_no}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-foreground">{lead.full_name || lead.name}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowConfirmChip(false)}
            className="flex-1"
          >
            <X className="w-3.5 h-3.5 mr-1" /> Edit
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={isConfirming}
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {isConfirming ? 'Scheduling…' : 'Confirm'}
          </Button>
        </div>
      </div>
    );
  }

  // Main Composer UI
  return (
    <div
      className="rounded-xl p-4 mb-4"
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'hsl(38 92% 50%)' }}>
          Schedule Appointment
        </span>
      </div>

      {/* Appointment Type */}
      <div className="mb-3">
        <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Type</label>
        <Select value={appointmentType} onValueChange={setAppointmentType}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {APPOINTMENT_TYPES.map((t) => (
              <SelectItem key={t.key} value={t.key}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Suggested Slots */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[10px] font-medium text-muted-foreground">Suggested Slots</label>
          <Button size="sm" variant="ghost" onClick={handleSuggestSlots} className="h-6 text-[10px]">
            <Calendar className="w-3 h-3 mr-1" /> Fetch
          </Button>
        </div>
        {suggestedSlots.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {suggestedSlots.map((slot, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className="cursor-pointer hover:bg-accent/10 hover:border-accent/40 transition-colors text-[10px]"
                onClick={() => handleSelectSlot(slot)}
              >
                {slot.label}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">Click "Fetch" to load available slots</p>
        )}
      </div>

      {/* Manual Date/Time */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Date</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Time</label>
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Duration */}
      <div className="mb-4">
        <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Duration</label>
        <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="20">20 minutes</SelectItem>
            <SelectItem value="30">30 minutes</SelectItem>
            <SelectItem value="45">45 minutes</SelectItem>
            <SelectItem value="60">1 hour</SelectItem>
            <SelectItem value="90">1.5 hours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onClose}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => setShowConfirmChip(true)}
          disabled={!date || !time}
          className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Check className="w-3.5 h-3.5 mr-1" /> Review
        </Button>
      </div>

      {(!date || !time) && (
        <div className="flex items-center gap-1.5 mt-3 text-[10px] text-muted-foreground">
          <AlertCircle className="w-3 h-3" />
          <span>Select a date and time to continue</span>
        </div>
      )}
    </div>
  );
}