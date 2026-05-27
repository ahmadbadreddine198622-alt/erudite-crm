import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Play, Pause, Mail, Tag, Bell, CalendarClock, Clock } from 'lucide-react';

const ACTION_ICONS = {
  send_email: Mail,
  tag: Tag,
  notify: Bell,
  schedule_followup: CalendarClock,
  assign: Bell,
};

const ACTION_LABELS = {
  send_email: 'Send Email',
  tag: 'Add Tag',
  notify: 'Notify Agent',
  schedule_followup: 'Schedule Follow-up',
  assign: 'Assign Agent',
};

export default function RuleCard({ rule, triggerLabels, onEdit, onToggle, onDelete }) {
  const trigger = triggerLabels[rule.trigger_type] || { label: rule.trigger_type, color: 'bg-muted text-foreground border-border' };
  const TriggerIcon = trigger.icon;

  const buildConditionSummary = () => {
    const c = rule.trigger_conditions || {};
    const parts = [];
    if (c.status) parts.push(`Status: ${c.status}`);
    if (c.stage) parts.push(`Stage: ${c.stage}`);
    if (c.score_min !== undefined) parts.push(`Score ≥ ${c.score_min}`);
    if (c.days !== undefined) parts.push(`${c.days} days`);
    if (c.tag) parts.push(`Tag: ${c.tag}`);
    return parts.join(' • ') || 'Any';
  };

  return (
    <div className={`bg-card border rounded-xl p-4 flex items-start gap-4 transition-opacity ${!rule.is_active ? 'opacity-60' : ''}`}>
      {/* Status dot */}
      <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${rule.is_active ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground">{rule.name}</span>
          <Badge variant="outline" className={`text-xs border ${trigger.color}`}>
            {TriggerIcon && <TriggerIcon className="w-3 h-3 mr-1" />}
            {trigger.label}
          </Badge>
          {!rule.is_active && <Badge variant="outline" className="text-xs">Paused</Badge>}
        </div>

        {rule.description && (
          <p className="text-sm text-muted-foreground mt-0.5">{rule.description}</p>
        )}

        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
          <span>When: <span className="text-foreground">{buildConditionSummary()}</span></span>
          {rule.delay_hours > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> After {rule.delay_hours}h
            </span>
          )}
          {rule.execution_count > 0 && (
            <span>Ran <span className="text-foreground font-medium">{rule.execution_count}</span> times</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-2 flex-wrap">
          {(rule.actions || []).map((action, i) => {
            const Icon = ACTION_ICONS[action.type] || Bell;
            const label = ACTION_LABELS[action.type] || action.type;
            const subject = action.payload?.subject || action.payload?.email_subject;
            return (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted rounded-md px-2 py-0.5">
                <Icon className="w-3 h-3" />
                {label}{subject ? `: "${subject}"` : ''}
              </span>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1 flex-shrink-0">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onToggle} title={rule.is_active ? 'Pause' : 'Resume'}>
          {rule.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit} title="Edit">
          <Pencil className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete} title="Delete">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}