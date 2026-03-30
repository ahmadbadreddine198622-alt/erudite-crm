import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Bell, CheckCircle2, Clock, Eye, Phone, Calendar, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, isPast, isToday, isTomorrow, addDays, isAfter } from 'date-fns';
import PageHeader from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';

const typeIcons = {
  follow_up: Phone,
  viewing: Eye,
  contract_renewal: FileText,
  payment_due: Calendar,
  document_expiry: FileText,
  custom: Bell,
};

const priorityColors = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-500/10 text-blue-600',
  high: 'bg-amber-500/10 text-amber-600',
  urgent: 'bg-red-500/10 text-red-600',
};

export default function Reminders() {
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState('pending');
  const queryClient = useQueryClient();

  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => base44.entities.Reminder.list('-due_date', 200),
  });

  const completeMutation = useMutation({
    mutationFn: (id) => base44.entities.Reminder.update(id, { status: 'completed' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminders'] }),
  });

  const pending = reminders.filter(r => r.status === 'pending');
  const completed = reminders.filter(r => r.status === 'completed');
  const overdue = pending.filter(r => r.due_date && isPast(new Date(r.due_date)) && !isToday(new Date(r.due_date)));
  const today = pending.filter(r => r.due_date && isToday(new Date(r.due_date)));
  const upcoming = pending.filter(r => r.due_date && isAfter(new Date(r.due_date), new Date()) && !isToday(new Date(r.due_date)));

  const renderList = (items) => (
    <div className="space-y-2">
      {items.map(rem => {
        const Icon = typeIcons[rem.type] || Bell;
        const isOverdue = rem.due_date && isPast(new Date(rem.due_date)) && !isToday(new Date(rem.due_date));
        return (
          <div key={rem.id} className="flex items-center gap-3 p-4 rounded-xl bg-card border hover:shadow-sm transition-shadow">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
              isOverdue ? "bg-red-500/10" : "bg-accent/10"
            )}>
              <Icon className={cn("w-5 h-5", isOverdue ? "text-red-500" : "text-accent")} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate">{rem.title}</p>
                <Badge className={cn("text-[10px] capitalize shrink-0", priorityColors[rem.priority])}>
                  {rem.priority}
                </Badge>
              </div>
              {rem.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{rem.description}</p>}
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px] capitalize">{rem.type?.replace('_', ' ')}</Badge>
                <span className={cn("text-[10px]", isOverdue ? "text-red-500 font-semibold" : "text-muted-foreground")}>
                  {rem.due_date && format(new Date(rem.due_date), 'MMM d, h:mm a')}
                  {isOverdue && ' · Overdue'}
                </span>
              </div>
            </div>
            {rem.status === 'pending' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => completeMutation.mutate(rem.id)}
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 shrink-0"
              >
                <CheckCircle2 className="w-5 h-5" />
              </Button>
            )}
          </div>
        );
      })}
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No reminders</p>
      )}
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto">
      <PageHeader title="Reminders" subtitle="Stay on top of follow-ups and deadlines">
        <Button size="sm" onClick={() => setShowAdd(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-1" /> Add Reminder
        </Button>
      </PageHeader>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className={cn("p-4 text-center", overdue.length > 0 && "border-red-500/30")}>
          <p className="text-2xl font-bold text-red-500">{overdue.length}</p>
          <p className="text-xs text-muted-foreground">Overdue</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-accent">{today.length}</p>
          <p className="text-xs text-muted-foreground">Due Today</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{upcoming.length}</p>
          <p className="text-xs text-muted-foreground">Upcoming</p>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          {overdue.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2">Overdue</h3>
              {renderList(overdue)}
            </div>
          )}
          {today.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">Today</h3>
              {renderList(today)}
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Upcoming</h3>
              {renderList(upcoming)}
            </div>
          )}
          {pending.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">All caught up! No pending reminders.</p>
          )}
        </TabsContent>
        <TabsContent value="completed">
          {renderList(completed)}
        </TabsContent>
      </Tabs>

      <AddReminderDialog open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}

function AddReminderDialog({ open, onClose }) {
  const [form, setForm] = useState({
    title: '', description: '', type: 'follow_up', due_date: '',
    priority: 'medium',
  });
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Reminder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      setForm({ title: '', description: '', type: 'follow_up', due_date: '', priority: 'medium' });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({ ...form, status: 'pending' });
  };

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e?.target?.value ?? e }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Reminder</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={set('title')} required placeholder="Follow up with client" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={set('description')} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={set('type')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="viewing">Viewing</SelectItem>
                  <SelectItem value="contract_renewal">Contract Renewal</SelectItem>
                  <SelectItem value="payment_due">Payment Due</SelectItem>
                  <SelectItem value="document_expiry">Document Expiry</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={set('priority')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Due Date & Time *</Label>
            <Input value={form.due_date} onChange={set('due_date')} type="datetime-local" required />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={createMutation.isPending}>
              Create Reminder
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}