import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const LEAD_STATUSES = ['hot', 'warm', 'cold', 'dead'];
const PIPELINE_STAGES = [
  'new', 'contacted', 'qualified', 'nurturing', 'viewing_scheduled',
  'offer_made', 'negotiating', 'contract_sent', 'won', 'lost', 'on_hold'
];
const ACTION_TYPES = [
  { value: 'send_email', label: 'Send Email' },
  { value: 'notify', label: 'Notify Agent' },
  { value: 'tag', label: 'Add Tag' },
  { value: 'schedule_followup', label: 'Schedule Follow-up' },
  { value: 'assign', label: 'Assign Agent' },
];

const defaultForm = () => ({
  name: '',
  description: '',
  is_active: true,
  trigger_type: 'lead_status_change',
  trigger_conditions: {},
  delay_hours: 0,
  actions: [{ type: 'send_email', payload: { subject: '', body: '', to_field: 'lead_email' } }],
  priority: 1,
});

export default function RuleFormDialog({ open, onClose, editingRule }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultForm());

  useEffect(() => {
    if (editingRule) {
      setForm({ ...defaultForm(), ...editingRule });
    } else {
      setForm(defaultForm());
    }
  }, [editingRule, open]);

  const saveMutation = useMutation({
    mutationFn: (data) => editingRule
      ? base44.entities.AutomationRule.update(editingRule.id, data)
      : base44.entities.AutomationRule.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success(editingRule ? 'Automation updated' : 'Automation created');
      onClose();
    },
  });

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const setCondition = (key, value) => setForm(f => ({
    ...f,
    trigger_conditions: { ...f.trigger_conditions, [key]: value || undefined }
  }));

  const addAction = () => setForm(f => ({
    ...f,
    actions: [...f.actions, { type: 'send_email', payload: { subject: '', body: '', to_field: 'lead_email' } }]
  }));

  const removeAction = (i) => setForm(f => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i) }));

  const updateAction = (i, field, value) => setForm(f => {
    const actions = [...f.actions];
    if (field === 'type') {
      actions[i] = { type: value, payload: value === 'send_email' ? { subject: '', body: '', to_field: 'lead_email' } : {} };
    } else {
      actions[i] = { ...actions[i], payload: { ...actions[i].payload, [field]: value } };
    }
    return { ...f, actions };
  });

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error('Rule name is required'); return; }
    if (!form.actions.length) { toast.error('Add at least one action'); return; }
    saveMutation.mutate(form);
  };

  const cond = form.trigger_conditions || {};

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingRule ? 'Edit Automation' : 'New Email Automation'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Rule Name *</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Welcome Email on Qualified" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Description</Label>
              <Input value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="Optional description" />
            </div>
          </div>

          {/* Trigger */}
          <div className="space-y-3 border rounded-xl p-4 bg-muted/30">
            <p className="text-sm font-semibold text-foreground">Trigger</p>
            <div className="space-y-1">
              <Label>Trigger Type</Label>
              <Select value={form.trigger_type} onValueChange={v => { set('trigger_type', v); set('trigger_conditions', {}); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead_status_change">Lead Status Change</SelectItem>
                  <SelectItem value="pipeline_stage_change">Pipeline Stage Change</SelectItem>
                  <SelectItem value="lead_created">New Lead Created</SelectItem>
                  <SelectItem value="days_no_activity">Days Without Activity</SelectItem>
                  <SelectItem value="lead_score_change">Lead Score Change</SelectItem>
                  <SelectItem value="tag_added">Tag Added</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Trigger-specific conditions */}
            {form.trigger_type === 'lead_status_change' && (
              <div className="space-y-1">
                <Label>When status changes to</Label>
                <Select value={cond.status || ''} onValueChange={v => setCondition('status', v)}>
                  <SelectTrigger><SelectValue placeholder="Any status" /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.trigger_type === 'pipeline_stage_change' && (
              <div className="space-y-1">
                <Label>When stage changes to</Label>
                <Select value={cond.stage || ''} onValueChange={v => setCondition('stage', v)}>
                  <SelectTrigger><SelectValue placeholder="Any stage" /></SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.trigger_type === 'days_no_activity' && (
              <div className="space-y-1">
                <Label>After how many days of no activity</Label>
                <Input type="number" min={1} value={cond.days || ''} onChange={e => setCondition('days', parseInt(e.target.value))} placeholder="e.g. 7" />
              </div>
            )}

            {form.trigger_type === 'lead_score_change' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Score drops below</Label>
                  <Input type="number" min={0} max={100} value={cond.score_below || ''} onChange={e => setCondition('score_below', parseInt(e.target.value))} placeholder="e.g. 30" />
                </div>
                <div className="space-y-1">
                  <Label>Score rises above</Label>
                  <Input type="number" min={0} max={100} value={cond.score_above || ''} onChange={e => setCondition('score_above', parseInt(e.target.value))} placeholder="e.g. 70" />
                </div>
              </div>
            )}

            {form.trigger_type === 'tag_added' && (
              <div className="space-y-1">
                <Label>When tag is added</Label>
                <Input value={cond.tag || ''} onChange={e => setCondition('tag', e.target.value)} placeholder="e.g. vip, hot-buyer" />
              </div>
            )}

            <div className="space-y-1">
              <Label>Delay before executing (hours)</Label>
              <Input type="number" min={0} value={form.delay_hours} onChange={e => set('delay_hours', parseInt(e.target.value) || 0)} />
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3 border rounded-xl p-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Actions</p>
              <Button type="button" size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={addAction}>
                <Plus className="w-3 h-3" /> Add Action
              </Button>
            </div>

            {form.actions.map((action, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-3 bg-background">
                <div className="flex items-center justify-between">
                  <Select value={action.type} onValueChange={v => updateAction(i, 'type', v)}>
                    <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {form.actions.length > 1 && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeAction(i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                {action.type === 'send_email' && (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Email Subject *</Label>
                      <Input value={action.payload?.subject || ''} onChange={e => updateAction(i, 'subject', e.target.value)} placeholder="e.g. We have properties matching your criteria!" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email Body *</Label>
                      <Textarea rows={4} value={action.payload?.body || ''} onChange={e => updateAction(i, 'body', e.target.value)} placeholder="Hi {{lead_name}}, thank you for your interest..." />
                      <p className="text-xs text-muted-foreground">Use &#123;&#123;lead_name&#125;&#125;, &#123;&#123;agent_name&#125;&#125;, &#123;&#123;stage&#125;&#125; as placeholders</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">From Name (optional)</Label>
                      <Input value={action.payload?.from_name || ''} onChange={e => updateAction(i, 'from_name', e.target.value)} placeholder="e.g. Your Agent Name" />
                    </div>
                  </div>
                )}

                {action.type === 'tag' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Tag to add</Label>
                    <Input value={action.payload?.tag || ''} onChange={e => updateAction(i, 'tag', e.target.value)} placeholder="e.g. re-engaged" />
                  </div>
                )}

                {action.type === 'notify' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Notification message</Label>
                    <Input value={action.payload?.message || ''} onChange={e => updateAction(i, 'message', e.target.value)} placeholder="e.g. Lead stage changed, follow up needed" />
                  </div>
                )}

                {action.type === 'schedule_followup' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Follow-up note</Label>
                    <Input value={action.payload?.note || ''} onChange={e => updateAction(i, 'note', e.target.value)} placeholder="e.g. Check in with lead after stage change" />
                  </div>
                )}

                {action.type === 'assign' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Assign to agent email</Label>
                    <Input value={action.payload?.agent_email || ''} onChange={e => updateAction(i, 'agent_email', e.target.value)} placeholder="agent@company.com" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <Switch checked={form.is_active} onCheckedChange={v => set('is_active', v)} />
            <Label className="cursor-pointer">Active — rule will run automatically</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : editingRule ? 'Save Changes' : 'Create Automation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}