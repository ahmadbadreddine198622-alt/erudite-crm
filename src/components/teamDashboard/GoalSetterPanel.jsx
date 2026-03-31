import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

function GoalRow({ agent, month, existingGoal, onSave, isSaving }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    target_deals: existingGoal?.target_deals || 0,
    target_revenue_aed: existingGoal?.target_revenue_aed || 0,
    target_leads: existingGoal?.target_leads || 0,
    target_viewings: existingGoal?.target_viewings || 0,
    notes: existingGoal?.notes || '',
  });

  useEffect(() => {
    setForm({
      target_deals: existingGoal?.target_deals || 0,
      target_revenue_aed: existingGoal?.target_revenue_aed || 0,
      target_leads: existingGoal?.target_leads || 0,
      target_viewings: existingGoal?.target_viewings || 0,
      notes: existingGoal?.notes || '',
    });
  }, [existingGoal]);

  const handleSave = () => {
    onSave({ agent, month, form, existingGoalId: existingGoal?.id });
    setOpen(false);
  };

  const hasGoal = existingGoal && (existingGoal.target_deals > 0 || existingGoal.target_revenue_aed > 0 || existingGoal.target_leads > 0);

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent">
            {agent.full_name?.[0]?.toUpperCase() || agent.email?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">{agent.full_name || agent.email}</p>
            <p className="text-xs text-muted-foreground">{agent.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasGoal ? (
            <span className="text-xs bg-emerald-500/10 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Goals Set</span>
          ) : (
            <span className="text-xs bg-orange-500/10 text-orange-600 px-2 py-0.5 rounded-full font-medium">No Goals</span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 bg-muted/20 border-t space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium">Deals Target</label>
              <Input
                type="number"
                min={0}
                value={form.target_deals}
                onChange={e => setForm(f => ({ ...f, target_deals: Number(e.target.value) }))}
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">Revenue (AED)</label>
              <Input
                type="number"
                min={0}
                value={form.target_revenue_aed}
                onChange={e => setForm(f => ({ ...f, target_revenue_aed: Number(e.target.value) }))}
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">Leads Target</label>
              <Input
                type="number"
                min={0}
                value={form.target_leads}
                onChange={e => setForm(f => ({ ...f, target_leads: Number(e.target.value) }))}
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">Viewings Target</label>
              <Input
                type="number"
                min={0}
                value={form.target_viewings}
                onChange={e => setForm(f => ({ ...f, target_viewings: Number(e.target.value) }))}
                className="mt-1 h-8 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium">Notes for agent</label>
            <Input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional motivation or notes..."
              className="mt-1 h-8 text-sm"
            />
          </div>
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save Goals
          </Button>
        </div>
      )}
    </div>
  );
}

export default function GoalSetterPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentMonth = format(startOfMonth(new Date()), 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: goals = [] } = useQuery({
    queryKey: ['agent_goals', selectedMonth],
    queryFn: () => base44.entities.AgentGoal.filter({ month: selectedMonth }),
  });

  const saveMutation = useMutation({
    mutationFn: async ({ agent, month, form, existingGoalId }) => {
      const data = {
        agent_email: agent.email,
        agent_name: agent.full_name || agent.email,
        month,
        ...form,
      };
      if (existingGoalId) {
        return base44.entities.AgentGoal.update(existingGoalId, data);
      } else {
        return base44.entities.AgentGoal.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent_goals'] });
      toast({ title: 'Goals saved successfully' });
    },
  });

  // Build month options: current + 5 past + 2 future
  const monthOptions = [];
  for (let i = -5; i <= 2; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() + i);
    const val = format(startOfMonth(d), 'yyyy-MM');
    monthOptions.push({ value: val, label: format(startOfMonth(d), 'MMMM yyyy') });
  }

  const agentUsers = users.filter(u => u.role !== 'admin' || users.length <= 2);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" />
            Set Monthly Goals per Agent
          </CardTitle>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {users.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No team members found. Invite users to get started.</p>
        )}
        {users.map(agent => {
          const existingGoal = goals.find(g => g.agent_email === agent.email);
          return (
            <GoalRow
              key={agent.id}
              agent={agent}
              month={selectedMonth}
              existingGoal={existingGoal}
              onSave={saveMutation.mutate}
              isSaving={saveMutation.isPending}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}