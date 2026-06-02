import React, { useState } from 'react';
import EruditePage from '@/components/erudite/EruditePage';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeSection from '@/components/erudite/EruditeSection';
import EruditeStat from '@/components/erudite/EruditeStat';
import EruditeBadge from '@/components/erudite/EruditeBadge';
import EruditeButton from '@/components/erudite/EruditeButton';
import EruditeEmptyState from '@/components/erudite/EruditeEmptyState';
import EruditeTable from '@/components/erudite/EruditeTable';
import { Eye, Plus, Calendar, CheckCircle, Clock, TrendingUp, MapPin } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Viewings() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('upcoming');

  const queryClient = useQueryClient();

  // Fetch viewings (reminders with type='viewing')
  const { data: viewings = [], isLoading } = useQuery({
    queryKey: ['viewings'],
    queryFn: async () => {
      const all = await base44.entities.Reminder.list('-due_date');
      return all.filter(r => r.type === 'viewing');
    },
  });

  // Create viewing mutation
  const createViewingMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.Reminder.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['viewings'] });
      setIsDialogOpen(false);
      toast.success('Viewing scheduled');
    },
  });

  // Update viewing mutation
  const updateViewingMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await base44.entities.Reminder.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['viewings'] });
      toast.success('Viewing updated');
    },
  });

  // Calculate stats
  const stats = {
    today: viewings.filter(v => {
      const today = new Date().toDateString();
      return new Date(v.due_date).toDateString() === today && v.status === 'pending';
    }).length,
    thisWeek: viewings.filter(v => {
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const due = new Date(v.due_date);
      return due >= now && due <= weekFromNow && v.status === 'pending';
    }).length,
    completed: viewings.filter(v => v.status === 'completed').length,
    showToDealRate: 22, // Would need deal tracking
  };

  const statusColors = {
    pending: 'blue',
    completed: 'emerald',
    cancelled: 'rose',
  };

  const handleCreateViewing = (formData) => {
    createViewingMutation.mutate({
      ...formData,
      type: 'viewing',
      status: 'pending',
      due_date: new Date(formData.due_date).toISOString(),
    });
  };

  const handleComplete = (id) => {
    updateViewingMutation.mutate({
      id,
      data: { status: 'completed', completed_at: new Date().toISOString() },
    });
  };

  const tableColumns = [
    { header: 'Property', accessor: (row) => row.notes?.split('\n')[0] || 'Property Viewing' },
    { header: 'Lead', accessor: (row) => row.lead_name || '-' },
    { header: 'Date/Time', accessor: (row) => format(new Date(row.due_date), 'MMM d, h:mm a') },
    { header: 'Status', accessor: (row) => <EruditeBadge variant={statusColors[row.status]}>{row.status}</EruditeBadge> },
    { header: 'Location', accessor: (row) => row.property_id ? 'Dubai' : 'TBD' },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex gap-2">
          {row.status === 'pending' && (
            <button
              onClick={() => handleComplete(row.id)}
              className="p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors"
              title="Mark Complete"
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
      title="Viewings"
      subtitle="Property viewing management and scheduling"
      actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <EruditeButton icon={Plus}>Schedule Viewing</EruditeButton>
          </DialogTrigger>
          <DialogContent className="max-w-2xl bg-[#0F1419] border-white/10">
            <DialogHeader>
              <DialogTitle className="text-xl font-display">Schedule Property Viewing</DialogTitle>
            </DialogHeader>
            <CreateViewingForm onSubmit={handleCreateViewing} onCancel={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Today's Viewings" value={stats.today.toString()} />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="This Week" value={stats.thisWeek.toString()} trend="up" trendValue="+12%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Show-to-Deal Rate" value={`${stats.showToDealRate}%`} trend="up" trendValue="+4%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Completed" value={stats.completed.toString()} trend="up" trendValue="+8" />
          </div>
        </EruditeCard>
      </div>

      {/* Main Content */}
      <EruditeSection title="Scheduled Viewings" subtitle="Upcoming" icon={Calendar}>
        {viewings.length === 0 ? (
          <EruditeEmptyState
            icon={Eye}
            title="No viewings scheduled"
            description="Schedule your first property viewing to track appointments"
            action={
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <EruditeButton variant="primary">Schedule First Viewing</EruditeButton>
                </DialogTrigger>
              </Dialog>
            }
          />
        ) : (
          <EruditeTable columns={tableColumns} data={viewings} />
        )}
      </EruditeSection>
    </EruditePage>
  );
}

// Create Viewing Form
function CreateViewingForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    title: 'Property Viewing',
    lead_name: '',
    notes: '',
    due_date: '',
    property_id: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label className="text-white/80">Lead Name</Label>
        <Input
          value={formData.lead_name}
          onChange={(e) => setFormData({ ...formData, lead_name: e.target.value })}
          placeholder="Enter lead name"
          className="glass-input"
          required
        />
      </div>

      <div className="space-y-2">
        <Label className="text-white/80">Property (Optional)</Label>
        <Input
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Property details or address"
          className="glass-input"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-white/80">Viewing Date and Time</Label>
        <Input
          type="datetime-local"
          value={formData.due_date}
          onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
          className="glass-input"
          required
        />
      </div>

      <div className="flex gap-3 pt-4">
        <EruditeButton type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </EruditeButton>
        <EruditeButton type="submit" variant="primary" className="flex-1">
          Schedule Viewing
        </EruditeButton>
      </div>
    </form>
  );
}