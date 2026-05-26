import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Edit2, Play, Zap, ChevronDown, ChevronUp, Copy, AlertCircle } from 'lucide-react';
import WorkflowNodeEditor from './WorkflowNodeEditor';
import { toast } from 'sonner';

const TRIGGERS = [
  { value: 'new_message', label: '📨 New Message Received', description: 'Fires on every inbound message' },
  { value: 'keyword_match', label: '🔍 Keyword Detected', description: 'Fires when message contains specific keywords' },
  { value: 'new_lead', label: '🆕 New Lead Created', description: 'Fires when a new lead is added via WhatsApp' },
  { value: 'no_reply', label: '⏰ No Reply Timeout', description: 'Fires after X hours without a response' },
  { value: 'sentiment_change', label: '😤 Negative Sentiment', description: 'Fires when AI detects negative sentiment' },
  { value: 'stage_change', label: '📊 Stage Change', description: 'Fires when lead stage is updated' },
];

const TEMPLATE_WORKFLOWS = [
  {
    name: 'AI Welcome + Qualify',
    description: 'Auto-welcome new leads and collect budget/timeline with AI',
    trigger: { type: 'new_lead', config: {} },
    nodes: [
      { id: 'n1', type: 'send_message', label: 'Welcome', config: { message: "Hello {name}! 👋 I'm the AI assistant for Erudite Property. I'd love to help you find your perfect property in Dubai. What type of property are you looking for?" }, next_node_id: 'n2' },
      { id: 'n2', type: 'ai_reply', label: 'AI Qualify', config: { prompt: 'You are a luxury real estate assistant. Ask about budget, timeline, and preferred area in Dubai. Be concise and professional.', language: 'auto' }, next_node_id: 'n3' },
      { id: 'n3', type: 'add_tag', label: 'Tag as AI-Qualified', config: { tag: 'ai-qualified' }, next_node_id: null },
    ]
  },
  {
    name: 'Keyword → Schedule Viewing',
    description: 'Detect viewing intent and auto-schedule',
    trigger: { type: 'keyword_match', config: { keywords: 'viewing,visit,see,tour' } },
    nodes: [
      { id: 'n1', type: 'send_message', label: 'Offer Viewing', config: { message: "Great! I'd be happy to schedule a viewing for you 🏠 Our available slots are weekdays 10am-6pm and weekends 11am-4pm. What time works best for you?" }, next_node_id: 'n2' },
      { id: 'n2', type: 'update_stage', label: 'Update Stage', config: { stage: 'viewing_scheduled' }, next_node_id: 'n3' },
      { id: 'n3', type: 'notify_agent', label: 'Alert Agent', config: { message: 'Client wants to schedule a viewing', email: '' }, next_node_id: null },
    ]
  },
  {
    name: 'Re-engagement After Silence',
    description: 'Follow up automatically after 48h of no reply',
    trigger: { type: 'no_reply', config: { hours: 48 } },
    nodes: [
      { id: 'n1', type: 'send_message', label: 'Follow-up', config: { message: "Hi {name}! 👋 Just checking in — are you still interested in properties in Dubai? I have some exciting new listings that might be perfect for you. Would you like to take a look?" }, next_node_id: null },
    ]
  },
];

function WorkflowCard({ workflow, onEdit, onDelete, onToggle }) {
  const trigger = TRIGGERS.find(t => t.value === workflow.trigger?.type);
  return (
    <Card className={`border transition-all ${workflow.is_active ? 'border-green-500/30 bg-green-500/3' : 'border-border'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm truncate">{workflow.name}</h3>
              <Badge variant="outline" className={`text-xs shrink-0 ${workflow.is_active ? 'border-green-500/30 text-green-600' : 'text-muted-foreground'}`}>
                {workflow.is_active ? '● Active' : '○ Inactive'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{trigger?.label || workflow.trigger?.type}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{workflow.nodes?.length || 0} steps</span>
              <span>·</span>
              <span>{workflow.execution_count || 0} runs</span>
              {workflow.last_triggered && (
                <>
                  <span>·</span>
                  <span>Last: {new Date(workflow.last_triggered).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={workflow.is_active}
              onCheckedChange={v => onToggle(workflow.id, v)}
            />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(workflow)}>
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(workflow.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WorkflowBuilder() {
  const queryClient = useQueryClient();
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['wa_workflows'],
    queryFn: () => base44.entities.WhatsAppWorkflow.list('-created_date', 50),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.WhatsAppWorkflow.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa_workflows'] });
      toast.success('Workflow created');
      setShowEditor(false);
      setEditingWorkflow(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WhatsAppWorkflow.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa_workflows'] });
      toast.success('Workflow updated');
      setShowEditor(false);
      setEditingWorkflow(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WhatsAppWorkflow.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wa_workflows'] }),
  });

  const newWorkflow = () => {
    setEditingWorkflow({
      name: '',
      description: '',
      is_active: false,
      trigger: { type: 'new_message', config: {} },
      nodes: [],
    });
    setShowEditor(true);
  };

  const addFromTemplate = (template) => {
    createMutation.mutate({ ...template, is_active: false });
    setShowTemplates(false);
  };

  const addNode = () => {
    const id = `n${Date.now()}`;
    setEditingWorkflow(w => ({
      ...w,
      nodes: [...(w.nodes || []), { id, type: 'send_message', label: '', config: {}, next_node_id: null }]
    }));
  };

  const removeNode = (id) => {
    setEditingWorkflow(w => ({ ...w, nodes: w.nodes.filter(n => n.id !== id) }));
  };

  const updateNode = (id, updated) => {
    setEditingWorkflow(w => ({ ...w, nodes: w.nodes.map(n => n.id === id ? updated : n) }));
  };

  const saveWorkflow = () => {
    if (!editingWorkflow.name.trim()) { toast.error('Workflow name is required'); return; }
    if (!editingWorkflow.trigger?.type) { toast.error('Select a trigger'); return; }
    if (editingWorkflow.id) {
      updateMutation.mutate({ id: editingWorkflow.id, data: editingWorkflow });
    } else {
      createMutation.mutate(editingWorkflow);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-base">AI Workflow Builder</h2>
          <p className="text-xs text-muted-foreground">Automate responses and actions with AI-powered workflows</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowTemplates(true)}>
            <Copy className="w-3.5 h-3.5 mr-1" /> Templates
          </Button>
          <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={newWorkflow}>
            <Plus className="w-3.5 h-3.5 mr-1" /> New Workflow
          </Button>
        </div>
      </div>

      {/* Workflows list */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading workflows...</div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl text-muted-foreground">
          <Zap className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium mb-1">No workflows yet</p>
          <p className="text-xs mb-4">Start with a template or build from scratch</p>
          <div className="flex gap-2 justify-center">
            <Button size="sm" variant="outline" onClick={() => setShowTemplates(true)}>Use Template</Button>
            <Button size="sm" className="bg-accent text-accent-foreground" onClick={newWorkflow}>Build From Scratch</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {workflows.map(wf => (
            <WorkflowCard
              key={wf.id}
              workflow={wf}
              onEdit={w => { setEditingWorkflow(w); setShowEditor(true); }}
              onDelete={id => { if (confirm('Delete this workflow?')) deleteMutation.mutate(id); }}
              onToggle={(id, val) => updateMutation.mutate({ id, data: { is_active: val } })}
            />
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="flex gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">Workflows execute when triggered by the WhatsApp webhook. Make sure your webhook is configured and the <code className="font-mono bg-amber-500/20 px-1 rounded">whatsappEmbeddedSignup</code> function is deployed.</p>
      </div>

      {/* Template Picker */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Workflow Templates</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {TEMPLATE_WORKFLOWS.map((t, i) => (
              <div key={i} className="border rounded-lg p-4 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => addFromTemplate(t)}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-sm">{t.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                    <div className="flex gap-1 mt-2">
                      <Badge variant="outline" className="text-xs">{TRIGGERS.find(tr => tr.value === t.trigger.type)?.label}</Badge>
                      <Badge variant="outline" className="text-xs">{t.nodes.length} steps</Badge>
                    </div>
                  </div>
                  <Button size="sm" className="shrink-0">Use</Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Workflow Editor */}
      <Dialog open={showEditor} onOpenChange={v => { setShowEditor(v); if (!v) setEditingWorkflow(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingWorkflow?.id ? 'Edit Workflow' : 'New Workflow'}</DialogTitle>
          </DialogHeader>

          {editingWorkflow && (
            <div className="space-y-5">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Workflow Name *</Label>
                  <Input
                    value={editingWorkflow.name}
                    onChange={e => setEditingWorkflow(w => ({ ...w, name: e.target.value }))}
                    placeholder="e.g. AI Welcome Bot"
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Switch
                        checked={editingWorkflow.is_active}
                        onCheckedChange={v => setEditingWorkflow(w => ({ ...w, is_active: v }))}
                      />
                      <span className="text-sm">{editingWorkflow.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trigger */}
              <div className="border rounded-xl p-4 bg-accent/5 border-accent/20">
                <Label className="text-xs font-semibold text-accent uppercase tracking-wide">⚡ Trigger</Label>
                <Select
                  value={editingWorkflow.trigger?.type || ''}
                  onValueChange={v => setEditingWorkflow(w => ({ ...w, trigger: { type: v, config: {} } }))}
                >
                  <SelectTrigger className="h-9 text-sm mt-2">
                    <SelectValue placeholder="Select a trigger..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <div>
                          <div>{t.label}</div>
                          <div className="text-xs text-muted-foreground">{t.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {editingWorkflow.trigger?.type === 'keyword_match' && (
                  <div className="mt-3">
                    <Label className="text-xs text-muted-foreground">Keywords (comma-separated)</Label>
                    <Input
                      value={editingWorkflow.trigger.config?.keywords || ''}
                      onChange={e => setEditingWorkflow(w => ({ ...w, trigger: { ...w.trigger, config: { keywords: e.target.value } } }))}
                      placeholder="viewing, visit, price, buy"
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                )}
                {editingWorkflow.trigger?.type === 'no_reply' && (
                  <div className="mt-3">
                    <Label className="text-xs text-muted-foreground">Trigger after (hours)</Label>
                    <Input
                      type="number"
                      value={editingWorkflow.trigger.config?.hours || 24}
                      onChange={e => setEditingWorkflow(w => ({ ...w, trigger: { ...w.trigger, config: { hours: parseInt(e.target.value) } } }))}
                      className="h-8 text-sm mt-1 w-24"
                    />
                  </div>
                )}
              </div>

              {/* Nodes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wide">🔗 Steps ({editingWorkflow.nodes?.length || 0})</Label>
                  <Button size="sm" variant="outline" onClick={addNode}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Step
                  </Button>
                </div>

                {editingWorkflow.nodes?.length === 0 && (
                  <div className="text-center py-6 border-2 border-dashed rounded-xl text-muted-foreground text-sm">
                    No steps yet. Click "Add Step" to build your workflow.
                  </div>
                )}

                {editingWorkflow.nodes?.map((node, idx) => (
                  <div key={node.id} className="relative">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded-full bg-accent text-accent-foreground text-xs flex items-center justify-center font-bold shrink-0">{idx + 1}</span>
                      <div className="h-px flex-1 bg-border" />
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive shrink-0" onClick={() => removeNode(node.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <WorkflowNodeEditor
                      node={node}
                      onChange={updated => updateNode(node.id, updated)}
                      allNodes={editingWorkflow.nodes}
                    />
                  </div>
                ))}
              </div>

              {/* Save */}
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" className="flex-1" onClick={() => { setShowEditor(false); setEditingWorkflow(null); }}>Cancel</Button>
                <Button
                  className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={saveWorkflow}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : 'Save Workflow'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}