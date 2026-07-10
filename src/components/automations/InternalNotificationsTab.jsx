// InternalNotificationsTab — create / edit / toggle internal notification rules.
// Each rule defines: WHEN (trigger), WHO receives (user / admin / all), delay,
// and the notification message (title + body). Stored as AutomationRule records
// with a `notify` action + recipient_role + message_title / message_body.

import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { buildAgentCtaHtml } from '@/lib/agentSignature';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Bell, Plus, Edit3, Trash2, ToggleLeft, ToggleRight, Save, X, Loader2,
  Clock, User, Shield, Users,
} from 'lucide-react';

const TRIGGERS = [
  ['lead_created', 'New lead created'],
  ['lead_status_change', 'Lead status changes'],
  ['pipeline_stage_change', 'Pipeline stage changes'],
  ['landlord_created', 'New landlord added'],
  ['appointment_created', 'Appointment created'],
  ['days_no_activity', 'No activity for X hours'],
  ['lead_score_change', 'Lead score changes'],
  ['tag_added', 'Tag added to lead'],
];

const ROLES = [
  { key: 'user', label: 'User (assigned agent)', icon: User, color: '#3b82f6' },
  { key: 'admin', label: 'Admins only', icon: Shield, color: '#f59e0b' },
  { key: 'all', label: 'Everyone', icon: Users, color: '#22c55e' },
];

function NotifyEditor({ rule, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: rule?.name || '',
    trigger_type: rule?.trigger_type || 'lead_created',
    recipient_role: rule?.recipient_role || 'all',
    delay_hours: rule?.delay_hours ?? 0,
    message_title: rule?.message_title || '',
    message_body: rule?.message_body || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Rule name is required'); return; }
    if (!form.message_title.trim()) { toast.error('Notification title is required'); return; }
    if (!form.message_body.trim()) { toast.error('Notification body is required'); return; }
    setSaving(true);
    try {
      await onSave(form);
    } finally { setSaving(false); }
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Bell className="w-4 h-4 text-accent" /> {rule ? 'Edit Internal Notification' : 'New Internal Notification'}
        </h3>
        <button onClick={onCancel} className="p-1 rounded hover:bg-white/5"><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      <div>
        <Label className="text-xs mb-1">Rule name</Label>
        <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Notify admin on new lead" className="glass-input" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1">When — trigger</Label>
          <select value={form.trigger_type} onChange={(e) => set('trigger_type', e.target.value)} className="glass-input w-full px-2 py-2 text-sm rounded-lg">
            {TRIGGERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs mb-1">Delay (hours)</Label>
          <Input type="number" min="0" value={form.delay_hours} onChange={(e) => set('delay_hours', Number(e.target.value))} className="glass-input" />
        </div>
      </div>

      <div>
        <Label className="text-xs mb-2">Who receives this notification</Label>
        <div className="flex gap-2 flex-wrap">
          {ROLES.map((r) => {
            const Icon = r.icon;
            const on = form.recipient_role === r.key;
            return (
              <button key={r.key} onClick={() => set('recipient_role', r.key)} type="button"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${on ? 'bg-accent/15 text-accent border border-accent/40' : 'text-muted-foreground hover:bg-white/5 border border-white/10'}`}>
                <Icon className="w-3.5 h-3.5" /> {r.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label className="text-xs mb-1">Notification title</Label>
        <Input value={form.message_title} onChange={(e) => set('message_title', e.target.value)} placeholder="e.g. New lead assigned to you" className="glass-input" />
      </div>

      <div>
        <Label className="text-xs mb-1">Notification body</Label>
        <Textarea value={form.message_body} onChange={(e) => set('message_body', e.target.value)} placeholder="Message… Use {{agent_name}}, {{lead_name}}, {{landlord_name}}" className="glass-input min-h-[90px] text-xs" />
        <p className="text-[10px] text-muted-foreground mt-1">Variables: {'{{agent_name}}'}, {'{{lead_name}}'}, {'{{landlord_name}}'}</p>
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={handleSave} disabled={saving} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
        </Button>
        <Button onClick={onCancel} size="sm" variant="ghost">Cancel</Button>
      </div>
    </div>
  );
}

function NotifyPreview({ rule, user }) {
  const bodyHtml = (rule.message_body || '').split(/\n{2,}/).map((p) => `<p style="margin:0 0 10px;line-height:1.55;">${p.replace(/\n/g, '<br/>')}</p>`).join('');
  const cta = user ? buildAgentCtaHtml(user) : '';
  const fullName = user?.full_name || '';
  const firstName = fullName.split(' ').filter(Boolean)[0] || fullName || '';
  return (
    <div style={{
      background: '#1e2229', borderRadius: 12, padding: 18, marginTop: 8,
      border: '1px solid rgba(255,255,255,0.06)',
      fontFamily: "'Inter',Arial,Helvetica,sans-serif",
    }}>
      <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, margin: 0, fontWeight: 600 }}>{rule.message_title}</p>
      <div style={{ color: '#e0e0e0', fontSize: 13, marginTop: 10 }}
        dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      <p style={{ color: '#e0e0e0', fontSize: 13, margin: '10px 0 2px' }}>Best regards,</p>
      <p style={{ color: '#e0e0e0', fontSize: 13, fontWeight: 700, margin: '0 0 2px' }}>{fullName || 'Your agent'}</p>
      <p style={{ color: '#C5A059', fontSize: 12, fontWeight: 600, margin: 0 }}>Erudite Real Estate</p>
      {cta && <div style={{ marginTop: 12 }} dangerouslySetInnerHTML={{ __html: cta }} />}
    </div>
  );
}

function NotifyRow({ rule, onToggle, onEdit, onDelete, user }) {
  const [expanded, setExpanded] = useState(false);
  const role = ROLES.find((r) => r.key === rule.recipient_role) || ROLES[2];
  const RoleIcon = role.icon;
  return (
    <div className="glass-card p-4">
      <div className="flex items-start gap-3">
        <button onClick={() => onToggle(rule)} className="flex-none mt-0.5" title={rule.is_active ? 'Active' : 'Inactive'}>
          {rule.is_active
            ? <ToggleRight className="w-6 h-6 text-emerald-400" />
            : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{rule.name}</p>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide flex items-center gap-1"
              style={{ background: `${role.color}15`, color: role.color }}>
              <RoleIcon className="w-3 h-3" /> {role.label.split(' ')[0]}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(197,160,89,0.12)', color: '#C5A059' }}>
              {rule.trigger_type?.replace(/_/g, ' ')}
            </span>
            {rule.delay_hours > 0 && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> {rule.delay_hours}h</span>}
            <span className="text-[10px] text-muted-foreground">· Fired {rule.execution_count || 0}×</span>
          </div>
          <button onClick={() => setExpanded((e) => !e)} className="text-[11px] text-accent hover:underline mt-1.5">
            {expanded ? 'Hide preview' : 'View preview'}
          </button>
        </div>
        <div className="flex-none flex items-center gap-1">
          <button onClick={() => onEdit(rule)} className="p-1.5 rounded-lg hover:bg-white/5"><Edit3 className="w-4 h-4 text-muted-foreground" /></button>
          <button onClick={() => onDelete(rule)} className="p-1.5 rounded-lg hover:bg-red-500/10"><Trash2 className="w-4 h-4 text-red-400" /></button>
        </div>
      </div>
      {expanded && <NotifyPreview rule={rule} user={user} />}
    </div>
  );
}

export default function InternalNotificationsTab({ rules, onChanged }) {
  const { user } = useCurrentUser();
  const [editing, setEditing] = useState(null); // null = list, {} = new, {id} = edit
  const [saving, setSaving] = useState(false);

  const notifyRules = rules.filter((r) => r.actions?.some((a) => a.type === 'notify'));

  const handleSave = async (form) => {
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        trigger_type: form.trigger_type,
        delay_hours: Number(form.delay_hours) || 0,
        recipient_role: form.recipient_role,
        message_title: form.message_title.trim(),
        message_body: form.message_body.trim(),
        actions: [{ type: 'notify', payload: { title: form.message_title.trim(), body: form.message_body.trim(), role: form.recipient_role } }],
        is_active: editing?.is_active !== false,
      };
      if (editing?.id) {
        await base44.entities.AutomationRule.update(editing.id, payload);
        toast.success('Notification rule updated');
      } else {
        await base44.entities.AutomationRule.create(payload);
        toast.success('Notification rule created');
      }
      setEditing(null);
      onChanged?.();
    } catch (e) {
      toast.error(e?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleToggle = async (rule) => {
    try {
      await base44.entities.AutomationRule.update(rule.id, { is_active: !rule.is_active });
      onChanged?.();
    } catch (e) { toast.error('Failed to toggle'); }
  };

  const handleDelete = async (rule) => {
    if (!confirm(`Delete "${rule.name}"?`)) return;
    try {
      await base44.entities.AutomationRule.delete(rule.id);
      toast.success('Rule deleted');
      onChanged?.();
    } catch (e) { toast.error('Failed to delete'); }
  };

  if (editing) {
    return (
      <NotifyEditor
        rule={editing.id ? editing : null}
        saving={saving}
        onSave={handleSave}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({})} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5">
          <Plus className="w-3.5 h-3.5" /> New Notification Rule
        </Button>
      </div>
      {notifyRules.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No internal notification rules yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Create a rule to notify a user or admin automatically when something happens.</p>
        </div>
      ) : (
        notifyRules.map((rule) => (
          <NotifyRow key={rule.id} rule={rule} user={user} onToggle={handleToggle} onEdit={(r) => setEditing(r)} onDelete={handleDelete} />
        ))
      )}
    </div>
  );
}