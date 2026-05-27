import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Zap, Play, Pause, Trash2, Pencil, Mail, GitBranch, Clock } from 'lucide-react';
import RuleFormDialog from '@/components/automations/RuleFormDialog';
import RuleCard from '@/components/automations/RuleCard';

const TRIGGER_LABELS = {
  lead_status_change: { label: 'Lead Status Change', icon: GitBranch, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  pipeline_stage_change: { label: 'Pipeline Stage Change', icon: Zap, color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  lead_created: { label: 'New Lead Created', icon: Plus, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  days_no_activity: { label: 'No Activity', icon: Clock, color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  lead_score_change: { label: 'Lead Score Change', icon: Zap, color: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
  tag_added: { label: 'Tag Added', icon: Plus, color: 'bg-sky-500/10 text-sky-600 border-sky-500/20' },
};

export default function EmailAutomations() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['automation-rules'],
    queryFn: () => base44.entities.AutomationRule.list('-created_date'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.AutomationRule.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automation-rules'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AutomationRule.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automation-rules'] }),
  });

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingRule(null);
  };

  const activeCount = rules.filter(r => r.is_active).length;
  const emailRules = rules.filter(r => r.actions?.some(a => a.type === 'send_email'));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Email Automations</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Automate email campaigns based on lead status and pipeline stage changes
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Automation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Rules', value: rules.length, color: 'text-foreground' },
          { label: 'Active', value: activeCount, color: 'text-emerald-600' },
          { label: 'Email Actions', value: emailRules.length, color: 'text-blue-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-card border rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Rules List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-card border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-20 border border-dashed rounded-xl">
          <Mail className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-foreground">No automations yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Create your first email automation to engage leads automatically
          </p>
          <Button onClick={() => setDialogOpen(true)} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" /> Create Automation
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <RuleCard
              key={rule.id}
              rule={rule}
              triggerLabels={TRIGGER_LABELS}
              onEdit={() => handleEdit(rule)}
              onToggle={() => toggleMutation.mutate({ id: rule.id, is_active: !rule.is_active })}
              onDelete={() => deleteMutation.mutate(rule.id)}
            />
          ))}
        </div>
      )}

      <RuleFormDialog
        open={dialogOpen}
        onClose={handleClose}
        editingRule={editingRule}
      />
    </div>
  );
}