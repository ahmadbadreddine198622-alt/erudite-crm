import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2, Clock, Calendar, Phone, Edit3 } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_OPTIONS = [
  { value: 'note', label: '📝 Note', icon: Edit3 },
  { value: 'task', label: '✅ Task', icon: CheckCircle2 },
  { value: 'follow_up', label: '⏰ Follow-up', icon: Clock },
  { value: 'appointment', label: '📅 Appointment', icon: Calendar },
  { value: 'call', label: '📞 Call', icon: Phone },
];

export default function ActivityInputBar({ landlord }) {
  const qc = useQueryClient();
  const [activityType, setActivityType] = useState('note');
  const [text, setText] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  
  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        landlord_id: landlord.id,
        activity_type: activityType,
        description: text.trim(),
        created_by_id: 'system',
      };
      if (followupDate && activityType === 'follow_up') {
        payload.followup_date = followupDate;
      }
      return base44.entities.Activity.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landlord-activity', landlord.id] });
      setText('');
      setFollowupDate('');
      toast.success('Activity logged');
    },
    onError: (e) => toast.error('Failed to log: ' + e.message),
  });
  
  const handleSubmit = () => {
    if (!text.trim()) {
      toast.error('Please enter a description');
      return;
    }
    mutation.mutate();
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  const SelectedIcon = TYPE_OPTIONS.find(t => t.value === activityType)?.icon || Edit3;
  
  return (
    <div className="rounded-xl p-3 border" style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div className="flex items-center gap-2 mb-2">
        <SelectedIcon className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
        <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Log Activity
        </span>
      </div>
      
      <div className="flex gap-2 items-end">
        <Select value={activityType} onValueChange={setActivityType}>
          <SelectTrigger className="w-[140px] h-9 text-xs"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                <span className="flex items-center gap-1.5">
                  <opt.icon className="w-3 h-3" /> {opt.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Enter ${activityType.replace('_', ' ')} details… (Enter to save)`}
          rows={2}
          className="flex-1 text-xs resize-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
          disabled={mutation.isPending}
        />
        
        {activityType === 'follow_up' && (
          <input
            type="date"
            value={followupDate}
            onChange={(e) => setFollowupDate(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-md"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
          />
        )}
        
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!text.trim() || mutation.isPending}
          className="h-[60px] px-4 shrink-0"
        >
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}