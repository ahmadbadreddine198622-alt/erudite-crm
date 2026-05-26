import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const NODE_TYPES = [
  { value: 'send_message', label: '💬 Send Message', color: 'border-blue-400 bg-blue-500/5' },
  { value: 'ai_reply', label: '🤖 AI Auto-Reply', color: 'border-purple-400 bg-purple-500/5' },
  { value: 'condition', label: '🔀 Condition / Branch', color: 'border-yellow-400 bg-yellow-500/5' },
  { value: 'assign_agent', label: '👤 Assign Agent', color: 'border-green-400 bg-green-500/5' },
  { value: 'update_stage', label: '🏷️ Update Lead Stage', color: 'border-orange-400 bg-orange-500/5' },
  { value: 'wait', label: '⏱️ Wait / Delay', color: 'border-gray-400 bg-gray-500/5' },
  { value: 'send_template', label: '📋 Send Template', color: 'border-teal-400 bg-teal-500/5' },
  { value: 'add_tag', label: '🏷 Add Tag', color: 'border-pink-400 bg-pink-500/5' },
  { value: 'notify_agent', label: '🔔 Notify Agent', color: 'border-red-400 bg-red-500/5' },
];

const STAGES = ['new_lead', 'contacted', 'viewing_scheduled', 'viewing_done', 'negotiation', 'offer_made', 'closed_won', 'closed_lost'];

export default function WorkflowNodeEditor({ node, onChange, allNodes }) {
  const update = (field, value) => onChange({ ...node, [field]: value });
  const updateConfig = (key, value) => onChange({ ...node, config: { ...node.config, [key]: value } });

  const nodeType = NODE_TYPES.find(n => n.value === node.type);

  return (
    <div className={`border-2 rounded-xl p-4 space-y-3 ${nodeType?.color || 'border-border'}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">Step Type</Label>
          <Select value={node.type} onValueChange={v => update('type', v)}>
            <SelectTrigger className="h-8 text-sm mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NODE_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">Step Label</Label>
          <Input
            value={node.label || ''}
            onChange={e => update('label', e.target.value)}
            placeholder="e.g. Welcome message"
            className="h-8 text-sm mt-1"
          />
        </div>
      </div>

      {/* Config per type */}
      {node.type === 'send_message' && (
        <div>
          <Label className="text-xs text-muted-foreground">Message Text</Label>
          <Textarea
            value={node.config?.message || ''}
            onChange={e => updateConfig('message', e.target.value)}
            placeholder="Hello {name}, thanks for reaching out! Use {name}, {phone}, {agent} as variables."
            className="text-sm mt-1 min-h-[80px]"
          />
          <p className="text-xs text-muted-foreground mt-1">Variables: {'{name}'}, {'{phone}'}, {'{agent}'}</p>
        </div>
      )}

      {node.type === 'ai_reply' && (
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-muted-foreground">AI System Prompt</Label>
            <Textarea
              value={node.config?.prompt || ''}
              onChange={e => updateConfig('prompt', e.target.value)}
              placeholder="You are a helpful real estate assistant for Erudite Property. Be professional and concise. Answer the user's query about our properties in Dubai."
              className="text-sm mt-1 min-h-[80px]"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Max Length</Label>
              <Select value={node.config?.max_length || '150'} onValueChange={v => updateConfig('max_length', v)}>
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="80">Short (80 chars)</SelectItem>
                  <SelectItem value="150">Medium (150 chars)</SelectItem>
                  <SelectItem value="300">Long (300 chars)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Language</Label>
              <Select value={node.config?.language || 'auto'} onValueChange={v => updateConfig('language', v)}>
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                  <SelectItem value="ru">Russian</SelectItem>
                  <SelectItem value="zh">Chinese</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {node.type === 'condition' && (
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-muted-foreground">Condition Field</Label>
            <Select value={node.config?.field || ''} onValueChange={v => updateConfig('field', v)}>
              <SelectTrigger className="h-8 text-sm mt-1">
                <SelectValue placeholder="Select field..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="message_contains">Message contains keyword</SelectItem>
                <SelectItem value="sentiment">AI Sentiment is</SelectItem>
                <SelectItem value="language">Detected language is</SelectItem>
                <SelectItem value="lead_stage">Lead stage is</SelectItem>
                <SelectItem value="has_agent">Has assigned agent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Value</Label>
            <Input
              value={node.config?.value || ''}
              onChange={e => updateConfig('value', e.target.value)}
              placeholder="e.g. price, viewing, buy"
              className="h-8 text-sm mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-green-600">✅ If TRUE → go to step</Label>
              <Select value={node.next_node_id || ''} onValueChange={v => update('next_node_id', v)}>
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue placeholder="Next step" />
                </SelectTrigger>
                <SelectContent>
                  {allNodes.filter(n => n.id !== node.id).map(n => (
                    <SelectItem key={n.id} value={n.id}>{n.label || n.type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-red-500">❌ If FALSE → go to step</Label>
              <Select value={node.else_node_id || ''} onValueChange={v => update('else_node_id', v)}>
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue placeholder="Else step" />
                </SelectTrigger>
                <SelectContent>
                  {allNodes.filter(n => n.id !== node.id).map(n => (
                    <SelectItem key={n.id} value={n.id}>{n.label || n.type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {node.type === 'assign_agent' && (
        <div>
          <Label className="text-xs text-muted-foreground">Agent Email</Label>
          <Input
            value={node.config?.agent_email || ''}
            onChange={e => updateConfig('agent_email', e.target.value)}
            placeholder="agent@company.com"
            className="h-8 text-sm mt-1"
          />
        </div>
      )}

      {node.type === 'update_stage' && (
        <div>
          <Label className="text-xs text-muted-foreground">New Stage</Label>
          <Select value={node.config?.stage || ''} onValueChange={v => updateConfig('stage', v)}>
            <SelectTrigger className="h-8 text-sm mt-1">
              <SelectValue placeholder="Select stage..." />
            </SelectTrigger>
            <SelectContent>
              {STAGES.map(s => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {node.type === 'wait' && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Wait Duration</Label>
            <Input
              type="number"
              value={node.config?.duration || 1}
              onChange={e => updateConfig('duration', parseInt(e.target.value))}
              min={1}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Unit</Label>
            <Select value={node.config?.unit || 'hours'} onValueChange={v => updateConfig('unit', v)}>
              <SelectTrigger className="h-8 text-sm mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutes</SelectItem>
                <SelectItem value="hours">Hours</SelectItem>
                <SelectItem value="days">Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {node.type === 'add_tag' && (
        <div>
          <Label className="text-xs text-muted-foreground">Tag to Add</Label>
          <Input
            value={node.config?.tag || ''}
            onChange={e => updateConfig('tag', e.target.value)}
            placeholder="e.g. hot-lead, arabic-speaker, viewing-requested"
            className="h-8 text-sm mt-1"
          />
        </div>
      )}

      {node.type === 'notify_agent' && (
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-muted-foreground">Notify (email)</Label>
            <Input
              value={node.config?.email || ''}
              onChange={e => updateConfig('email', e.target.value)}
              placeholder="agent@company.com"
              className="h-8 text-sm mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Message</Label>
            <Input
              value={node.config?.message || ''}
              onChange={e => updateConfig('message', e.target.value)}
              placeholder="Urgent lead needs follow-up"
              className="h-8 text-sm mt-1"
            />
          </div>
        </div>
      )}

      {/* Next node selector (non-condition types) */}
      {node.type !== 'condition' && (
        <div>
          <Label className="text-xs text-muted-foreground">Then go to step (optional)</Label>
          <Select value={node.next_node_id || 'end'} onValueChange={v => update('next_node_id', v === 'end' ? null : v)}>
            <SelectTrigger className="h-8 text-sm mt-1">
              <SelectValue placeholder="End workflow" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="end">⛔ End Workflow</SelectItem>
              {allNodes.filter(n => n.id !== node.id).map(n => (
                <SelectItem key={n.id} value={n.id}>{n.label || n.type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}