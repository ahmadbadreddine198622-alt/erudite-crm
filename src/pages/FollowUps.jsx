import React, { useState } from 'react';
import EruditePage from '@/components/erudite/EruditePage';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeSection from '@/components/erudite/EruditeSection';
import EruditeStat from '@/components/erudite/EruditeStat';
import EruditeBadge from '@/components/erudite/EruditeBadge';
import EruditeButton from '@/components/erudite/EruditeButton';
import EruditeEmptyState from '@/components/erudite/EruditeEmptyState';
import EruditeTable from '@/components/erudite/EruditeTable';
import { Repeat, Clock, CheckCircle, TrendingUp, Plus, Eye } from 'lucide-react';
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

  // Fetch reminders (used for follow ups)
  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['reminders'],
    queryFn: async () => {
      const result = await base44.entities.Reminder.list('-due_date');
      return result.filter(r => r.type === 'follow_up' || !r.type);
    },
  });

  // Create reminder mutation
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

  // Update reminder mutation
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

  // Filter reminders
  const followUps = reminders.filter(r => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') return r.status === 'pending';
    if (filterStatus === 'completed') return r.status === 'completed';
    return true;
  });

  // Calculate stats
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

  const tableColumns = [
    { header: 'Title', accessor: 'title' },
    { header: 'Lead', accessor: (row) => row.lead_name || '-' },
    { header: 'Due Date', accessor: (row) => row.due_date ? format(new Date(row.due_date), 'MMM d, h:mm a') : '-' },
    { header: 'Priority', accessor: (row) => (
      <EruditeBadge variant={row.priority === 'urgent' ? 'rose' : row.priority === 'high' ? 'orange' : 'default'}>
        {row.priority || 'none'}
      </EruditeBadge>
    )},
    { header: 'Status', accessor: (row) => (
      <EruditeBadge variant={row.status === 'completed' ? 'emerald' : 'blue'}>
        {row.status}
      </EruditeBadge>
    )},
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex gap-2">
          {row.status === 'pending' && (
            <button
              onClick={() => handleComplete(row.id)}
              className="p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors"
              title="Mark complete"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <EruditePage
      title="Follow Ups"
      subtitle="Activity-driven follow-up engine"
      actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <EruditeButton icon={Plus}>Schedule Follow Up</EruditeButton>
          </DialogTrigger>
          <DialogContent className="max-w-2xl bg-[#0F1419] border-white/10">
            <DialogHeader>
              <DialogTitle className="text-xl font-display">Schedule Follow Up</DialogTitle>
            </DialogHeader>
            <CreateFollowUpForm onSubmit={handleCreateFollowUp} onCancel={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Pending" value={stats.pending.toString()} />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Completed" value={stats.completed.toString()} trend="up" trendValue="+8" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Overdue" value={stats.overdue.toString()} trend={stats.overdue > 0 ? 'down' : undefined} />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Total" value={followUps.length.toString()} />
          </div>
        </EruditeCard>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <EruditeBadge 
          className={`cursor-pointer transition-all ${filterStatus === 'all' ? 'ring-2 ring-amber-500/50' : ''}`}
          onClick={() => setFilterStatus('all')}
        >
          All
        </EruditeBadge>
        <EruditeBadge 
          className={`cursor-pointer transition-all ${filterStatus === 'pending' ? 'ring-2 ring-amber-500/50' : ''}`}
          onClick={() => setFilterStatus('pending')}
        >
          Pending
        </EruditeBadge>
        <EruditeBadge 
          className={`cursor-pointer transition-all ${filterStatus === 'completed' ? 'ring-2 ring-amber-500/50' : ''}`}
          onClick={() => setFilterStatus('completed')}
        >
          Completed
        </EruditeBadge>
      </div>

      {/* Main Content */}
      <EruditeSection title="Follow Ups" subtitle={filterStatus === 'all' ? 'All' : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} icon={Clock}>
        {followUps.length === 0 ? (
          <EruditeEmptyState
            icon={Repeat}
            title="No follow ups scheduled"
            description="Schedule your first follow up to stay on top of lead conversations"
            action={
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <EruditeButton variant="primary">Schedule First Follow Up</EruditeButton>
                </DialogTrigger>
              </Dialog>
            }
          />
        ) : (
          <EruditeTable columns={tableColumns} data={followUps} />
        )}
      </EruditeSection>
    </EruditePage>
  );
}

// Create Follow Up Form Component
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
        <Label className="text-white/80">Title</Label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g., Call back about Palm Jumeirah property"
          className="glass-input"
          required
        />
      </div>

      <div className="space-y-2">
        <Label className="text-white/80">Lead Name</Label>
        <Input
          value={formData.lead_name}
          onChange={(e) => setFormData({ ...formData, lead_name: e.target.value })}
          placeholder="Contact name"
          className="glass-input"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-white/80">Due Date and Time</Label>
        <Input
          type="datetime-local"
          value={formData.due_date}
          onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
          className="glass-input"
          required
        />
      </div>

      <div className="space-y-2">
        <Label className="text-white/80">Priority</Label>
        <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
          <SelectTrigger className="glass-input">
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
        <Label className="text-white/80">Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional context or talking points..."
          className="glass-input min-h-[100px]"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <EruditeButton type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </EruditeButton>
        <EruditeButton type="submit" variant="primary" className="flex-1">
          Schedule Follow Up
        </EruditeButton>
      </div>
    </form>
  );
}