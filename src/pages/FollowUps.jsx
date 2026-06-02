import React, { useState } from 'react';
import iOSCard from '@/components/ios/iOSCard';
import iOSBadge from '@/components/ios/iOSBadge';
import { Repeat, Clock, CheckCircle, TrendingUp, Plus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function FollowUps() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const queryClient = useQueryClient();

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['reminders'],
    queryFn: async () => {
      const result = await base44.entities.Reminder.list('-due_date');
      return result.filter(r => r.type === 'follow_up' || !r.type);
    },
  });

  const createReminderMutation = useMutation({
    mutationFn: async (reminderData) => {
      return await base44.entities.Reminder.create(reminderData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      setIsDialogOpen(false);
      toast.success('Follow up scheduled');
    },
    onError: (error) => {
      toast.error('Failed to schedule: ' + error.message);
    },
  });

  const updateReminderMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await base44.entities.Reminder.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast.success('Follow up updated');
    },
    onError: (error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  const followUps = reminders.filter(r => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') return r.status === 'pending';
    if (filterStatus === 'completed') return r.status === 'completed';
    return true;
  });

  const stats = {
    pending: followUps.filter(r => r.status === 'pending').length,
    completed: followUps.filter(r => r.status === 'completed').length,
    overdue: followUps.filter(r => r.status === 'pending' && new Date(r.due_date) < new Date()).length,
  };

  const handleCreateFollowUp = (formData) => {
    createReminderMutation.mutate({
      ...formData,
      type: 'follow_up',
      status: 'pending',
      due_date: new Date(formData.due_date).toISOString(),
    });
  };

  const handleComplete = (id) => {
    updateReminderMutation.mutate({
      id,
      data: { status: 'completed', completed_at: new Date().toISOString() },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Follow Ups</h1>
            <p className="text-gray-500 mt-1">Activity-driven follow-up engine</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
                Schedule Follow Up
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Schedule Follow Up</DialogTitle>
              </DialogHeader>
              <CreateFollowUpForm onSubmit={handleCreateFollowUp} onCancel={() => setIsDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Pending</span>
              <Clock className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.pending}</p>
          </iOSCard>
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Completed</span>
              <CheckCircle className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.completed}</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +8
            </p>
          </iOSCard>
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Overdue</span>
              <Clock className="w-4 h-4 text-gray-400" />
            </div>
            <p className={`text-3xl font-bold ${stats.overdue > 0 ? 'text-red-600' : 'text-gray-900'}`}>{stats.overdue}</p>
          </iOSCard>
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Total</span>
              <Repeat className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{followUps.length}</p>
          </iOSCard>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <iOSBadge 
            variant={filterStatus === 'all' ? 'blue' : 'gray'}
            className="cursor-pointer"
            onClick={() => setFilterStatus('all')}
          >
            All
          </iOSBadge>
          <iOSBadge 
            variant={filterStatus === 'pending' ? 'blue' : 'gray'}
            className="cursor-pointer"
            onClick={() => setFilterStatus('pending')}
          >
            Pending
          </iOSBadge>
          <iOSBadge 
            variant={filterStatus === 'completed' ? 'blue' : 'gray'}
            className="cursor-pointer"
            onClick={() => setFilterStatus('completed')}
          >
            Completed
          </iOSBadge>
        </div>

        {/* Main Content */}
        <iOSCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-100">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Follow Ups</h2>
              <p className="text-sm text-gray-500">{filterStatus === 'all' ? 'All' : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}</p>
            </div>
          </div>

          {followUps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-8 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50">
              <Repeat className="w-12 h-12 mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2 text-gray-700">No follow ups scheduled</h3>
              <p className="text-sm text-center max-w-md text-gray-500">
                Schedule your first follow up to stay on top of lead conversations
              </p>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <button className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
                    Schedule First Follow Up
                  </button>
                </DialogTrigger>
              </Dialog>
            </div>
          ) : (
            <div className="space-y-3">
              {followUps.map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">{reminder.title}</p>
                      <p className="text-xs text-gray-500">
                        {reminder.lead_name || 'No lead'} • Due {reminder.due_date ? format(new Date(reminder.due_date), 'MMM d, h:mm a') : '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <iOSBadge variant={reminder.priority === 'urgent' ? 'red' : reminder.priority === 'high' ? 'orange' : 'gray'}>
                      {reminder.priority || 'none'}
                    </iOSBadge>
                    <iOSBadge variant={reminder.status === 'completed' ? 'green' : 'blue'}>
                      {reminder.status}
                    </iOSBadge>
                    {reminder.status === 'pending' && (
                      <button
                        onClick={() => handleComplete(reminder.id)}
                        className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
                        title="Mark complete"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </iOSCard>
      </div>
    </div>
  );
}

function CreateFollowUpForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    lead_name: '',
    notes: '',
    due_date: '',
    priority: 'medium',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>Title</Label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g., Call back about Palm Jumeirah property"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Lead Name</Label>
        <Input
          value={formData.lead_name}
          onChange={(e) => setFormData({ ...formData, lead_name: e.target.value })}
          placeholder="Contact name"
        />
      </div>

      <div className="space-y-2">
        <Label>Due Date and Time</Label>
        <Input
          type="datetime-local"
          value={formData.due_date}
          onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Priority</Label>
        <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional context or talking points..."
          className="min-h-[100px]"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          Schedule Follow Up
        </button>
      </div>
    </form>
  );
}