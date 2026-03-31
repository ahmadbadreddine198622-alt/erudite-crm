import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Calendar, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ScheduleViewingDialog({ lead_id, lead_name, property_title, trigger_label = "Schedule Viewing" }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    viewing_date: '',
    viewing_time: '10:00',
    duration_minutes: 30
  });

  const handleSchedule = async () => {
    if (!formData.viewing_date || !formData.viewing_time) {
      toast.error('Please select date and time');
      return;
    }

    setLoading(true);
    try {
      const response = await base44.functions.invoke('schedulePropertyViewing', {
        lead_id,
        lead_name,
        property_title,
        ...formData
      });

      toast.success('Viewing scheduled on Google Calendar');
      setOpen(false);
      setFormData({ viewing_date: '', viewing_time: '10:00', duration_minutes: 30 });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to schedule viewing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Calendar className="w-4 h-4" />
          {trigger_label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Property Viewing</DialogTitle>
          <DialogDescription>
            Schedule a viewing for {property_title} with {lead_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">Event will be added to your Google Calendar</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="viewing_date">Date</Label>
            <Input
              id="viewing_date"
              type="date"
              value={formData.viewing_date}
              onChange={(e) => setFormData({ ...formData, viewing_date: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="viewing_time" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Time
            </Label>
            <Input
              id="viewing_time"
              type="time"
              value={formData.viewing_time}
              onChange={(e) => setFormData({ ...formData, viewing_time: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration_minutes">Duration (minutes)</Label>
            <Input
              id="duration_minutes"
              type="number"
              min="15"
              max="240"
              step="15"
              value={formData.duration_minutes}
              onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Scheduling...' : 'Schedule'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}