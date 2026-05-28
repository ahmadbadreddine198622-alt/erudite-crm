import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckSquare, CalendarCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function AddTaskPanel({ leadId, agentName, type = 'task', onClose }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const queryClient = useQueryClient();

  const isBooking = type === 'booking';

  const mutation = useMutation({
    mutationFn: (data) => base44.entities.LeadActivity.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-activities', leadId] });
      toast.success(isBooking ? 'Booking created' : 'Task created');
      onClose?.();
    },
  });

  const handleSave = () => {
    if (!title.trim()) return;
    mutation.mutate({
      lead_id: leadId,
      activity_type: type,
      title: title.trim(),
      body: body.trim() || undefined,
      due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
      assigned_to: assignedTo.trim() || agentName,
      created_by: agentName || 'Agent',
      completed: false,
    });
  };

  const Icon = isBooking ? CalendarCheck : CheckSquare;

  return (
    <div className="space-y-3 p-3 rounded-xl border border-border bg-muted/30">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${isBooking ? 'text-blue-500' : 'text-purple-500'}`} />
        <span className="text-sm font-semibold">{isBooking ? 'New Booking' : 'New Task'}</span>
      </div>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={isBooking ? 'e.g. Property viewing at Marina View' : 'e.g. Follow-up call'}
        className="h-8 text-sm"
      />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="text-sm resize-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground">
            {isBooking ? 'Appointment time' : 'Due date/time'}
          </label>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="mt-1 h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground">Assign to</label>
          <Input
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder={agentName || 'Agent name'}
            className="mt-1 h-8 text-xs"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!title.trim() || mutation.isPending}
          onClick={handleSave}
          className={`h-7 text-xs ${isBooking ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
        >
          {isBooking ? 'Create Booking' : 'Create Task'}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}