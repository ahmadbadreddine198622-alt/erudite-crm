import React, { useState } from 'react';
import iOSCard from '@/components/ios/iOSCard';
import iOSBadge from '@/components/ios/iOSBadge';
import { Eye, Plus, Calendar, CheckCircle, Clock, TrendingUp, MapPin } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Viewings() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: viewings = [], isLoading } = useQuery({
    queryKey: ['viewings'],
    queryFn: async () => {
      const all = await base44.entities.Reminder.list('-due_date');
      return all.filter(r => r.type === 'viewing');
    },
  });

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

  const updateViewingMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await base44.entities.Reminder.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['viewings'] });
      toast.success('Viewing updated');
    },
  });

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Viewings</h1>
            <p className="text-gray-500 mt-1">Property viewing management and scheduling</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
                Schedule Viewing
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Schedule Property Viewing</DialogTitle>
              </DialogHeader>
              <CreateViewingForm onSubmit={handleCreateViewing} onCancel={() => setIsDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Today's Viewings</span>
              <Eye className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.today}</p>
          </iOSCard>
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">This Week</span>
              <Calendar className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.thisWeek}</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +12%
            </p>
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
              <span className="text-xs font-medium text-gray-500 uppercase">Show-to-Deal Rate</span>
              <TrendingUp className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">22%</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +4%
            </p>
          </iOSCard>
        </div>

        {/* Scheduled Viewings */}
        <iOSCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-100">
              <Calendar className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Scheduled Viewings</h2>
              <p className="text-sm text-gray-500">Upcoming</p>
            </div>
          </div>

          {viewings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-8 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50">
              <Eye className="w-12 h-12 mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2 text-gray-700">No viewings scheduled</h3>
              <p className="text-sm text-center max-w-md text-gray-500">
                Schedule your first property viewing to track appointments
              </p>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <button className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
                    Schedule First Viewing
                  </button>
                </DialogTrigger>
              </Dialog>
            </div>
          ) : (
            <div className="space-y-3">
              {viewings.map((viewing) => (
                <div
                  key={viewing.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">
                        {viewing.notes?.split('\n')[0] || 'Property Viewing'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {viewing.lead_name || 'No lead assigned'} • {format(new Date(viewing.due_date), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <iOSBadge variant={viewing.status === 'completed' ? 'green' : viewing.status === 'cancelled' ? 'red' : 'blue'}>
                      {viewing.status}
                    </iOSBadge>
                    {viewing.status === 'pending' && (
                      <button
                        onClick={() => handleComplete(viewing.id)}
                        className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
                        title="Mark Complete"
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

function CreateViewingForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    title: 'Property Viewing',
    lead_name: '',
    notes: '',
    due_date: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>Lead Name</Label>
        <Input
          value={formData.lead_name}
          onChange={(e) => setFormData({ ...formData, lead_name: e.target.value })}
          placeholder="Enter lead name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Property Details</Label>
        <Input
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Property details or address"
        />
      </div>

      <div className="space-y-2">
        <Label>Viewing Date and Time</Label>
        <Input
          type="datetime-local"
          value={formData.due_date}
          onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
          required
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
          Schedule Viewing
        </button>
      </div>
    </form>
  );
}