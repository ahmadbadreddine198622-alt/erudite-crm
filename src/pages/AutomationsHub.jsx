// AutomationsHub — central page for managing all automated messages.
// Three sections: Welcome Sequence, Follow-up Automations, Templates Library.
// Built on existing MessageTemplate + AutomationRule entities.

import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Zap, Plus, Edit3, Trash2, ToggleLeft, ToggleRight, Mail, MessageCircle,
  Clock, Users, RefreshCw, ChevronDown, ChevronUp, Save, X, Loader2, Sparkles, Repeat2
} from 'lucide-react';

const CHANNEL_ICON = { email: Mail, whatsapp: MessageCircle, imessage: MessageCircle, telegram: MessageCircle, sms: MessageCircle };
const CHANNEL_COLOR = { email: '#3b82f6', whatsapp: '#22c55e', imessage: '#22c55e', telegram: '#22c55e', sms: '#f59e0b' };

function TemplateRow({ tpl, onEdit, onDelete, onToggle }) {
  const Icon = CHANNEL_ICON[tpl.channel] || Mail;
  const color = CHANNEL_COLOR[tpl.channel] || '#94a3b8';
  return (
    <div className="glass-card p-4 flex items-start gap-3">
      <div className="flex-none w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground">{tpl.title}</p>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide" style={{ background: `${color}15`, color }}>{tpl.channel}</span>
          {tpl.category === 'welcome_sequence' && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(168,85,247,0.15)', color: '#c4b5fd' }}>Welcome</span>
          )}
          {tpl.sort_order != null && tpl.category === 'welcome_sequence' && (
            <span className="text-[10px] font-bold text-muted-foreground">#{tpl.sort_order}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tpl.body?.substring(0, 120)}{tpl.body?.length > 120 ? '…' : ''}</p>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
          <span>by {tpl.created_by_name || tpl.created_by_email || 'Unknown'}</span>
          <span>·</span>
          <span>Used {tpl.usage_count || 0}×</span>
          {tpl.subject && <><span>·</span><span>{tpl.subject}</span></>}
        </div>
      </div>
      <div className="flex-none flex items-center gap-1">
        <button onClick={() => onToggle(tpl)} className="p-1.5 rounded-lg hover:bg-white/5" title={tpl.is_active ? 'Active' : 'Inactive'}>
          {tpl.is_active
            ? <ToggleRight className="w-5 h-5 text-emerald-400" />
            : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
        </button>
        <button onClick={() => onEdit(tpl)} className="p-1.5 rounded-lg hover:bg-white/5"><Edit3 className="w-4 h-4 text-muted-foreground" /></button>
        <button onClick={() => onDelete(tpl)} className="p-1.5 rounded-lg hover:bg-red-500/10"><Trash2 className="w-4 h-4 text-red-400" /></button>
      </div>
    </div>
  );
}

function TemplateEditor({ template, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: template?.title || '',
    subject: template?.subject || '',
    body: template?.body || '',
    channel: template?.channel || 'whatsapp',
    category: template?.category || 'general',
    sort_order: template?.sort_order ?? 0,
    visibility: template?.visibility || 'shared',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) { toast.error('Title and body are required'); return; }
    setSaving(true);
    try {
      await onSave(form);
    } finally { setSaving(false); }
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Edit3 className="w-4 h-4 text-accent" /> {template ? 'Edit Template' : 'New Template'}</h3>
        <button onClick={onCancel} className="p-1 rounded hover:bg-white/5"><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <div>
        <Label className="text-xs mb-1">Title</Label>
        <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Template name" className="glass-input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1">Channel</Label>
          <select value={form.channel} onChange={(e) => set('channel', e.target.value)} className="glass-input w-full px-2 py-2 text-sm rounded-lg">
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="imessage">iMessage</option>
            <option value="telegram">Telegram</option>
            <option value="sms">SMS</option>
          </select>
        </div>
        <div>
          <Label className="text-xs mb-1">Category</Label>
          <select value={form.category} onChange={(e) => set('category', e.target.value)} className="glass-input w-full px-2 py-2 text-sm rounded-lg">
            <option value="general">General</option>
            <option value="initial_contact">Initial Contact</option>
            <option value="follow_up_general">Follow-up</option>
            <option value="welcome_sequence">Welcome Sequence</option>
            <option value="price_discovery">Price Discovery</option>
            <option value="listing_commitment">Listing Commitment</option>
            <option value="form_a">Form A</option>
            <option value="viewing">Viewing</option>
            <option value="renewal">Renewal</option>
          </select>
        </div>
      </div>
      {form.channel === 'email' && (
        <div>
          <Label className="text-xs mb-1">Subject</Label>
          <Input value={form.subject} onChange={(e) => set('subject', e.target.value)} placeholder="Email subject line" className="glass-input" />
        </div>
      )}
      <div>
        <Label className="text-xs mb-1">Body</Label>
        <Textarea value={form.body} onChange={(e) => set('body', e.target.value)} placeholder="Message body… Use {{landlord_name}}, {{agent_name}}, {{property_name}}" className="glass-input min-h-[120px] font-mono text-xs" />
        <p className="text-[10px] text-muted-foreground mt-1">Variables: {'{{landlord_name}}'}, {'{{agent_name}}'}, {'{{property_name}}'}, {'{{project_name}}'}</p>
      </div>
      {form.category === 'welcome_sequence' && (
        <div>
          <Label className="text-xs mb-1">Order (lower = sent first)</Label>
          <Input type="number" value={form.sort_order} onChange={(e) => set('sort_order', Number(e.target.value))} className="glass-input w-24" />
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button onClick={handleSave} disabled={saving} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
        </Button>
        <Button onClick={onCancel} size="sm" variant="ghost">Cancel</Button>
      </div>
    </div>
  );
}

function AutomationRuleRow({ rule, onToggle, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [delay, setDelay] = useState(rule.delay_hours || 0);
  const [savingDelay, setSavingDelay] = useState(false);

  const saveDelay = async () => {
    setSavingDelay(true);
    try {
      await base44.entities.AutomationRule.update(rule.id, { delay_hours: Number(delay) });
      toast.success('Timing updated');
      setEditing(false);
    } catch (e) {
      toast.error('Failed to update');
    } finally { setSavingDelay(false); }
  };

  return (
    <div className="glass-card p-4 flex items-start gap-3">
      <button onClick={() => onToggle(rule)} className="flex-none mt-0.5">
        {rule.is_active
          ? <ToggleRight className="w-7 h-7 text-emerald-400" />
          : <ToggleLeft className="w-7 h-7 text-muted-foreground" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{rule.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{rule.description || 'No description'}</p>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {rule.trigger_type?.replace(/_/g, ' ')}</span>
          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {rule.recipient_type?.replace(/_/g, ' ')}</span>
          {editing ? (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <Input type="number" min="0" value={delay} onChange={(e) => setDelay(e.target.value)} className="glass-input w-16 h-6 text-xs px-1" /> hrs
              <button onClick={saveDelay} disabled={savingDelay} className="text-emerald-400">✓</button>
            </span>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1 hover:text-foreground">
              <Clock className="w-3 h-3" /> {rule.delay_hours || 0}h delay
            </button>
          )}
          <span>· Executed {rule.execution_count || 0}×</span>
        </div>
      </div>
    </div>
  );
}

export default function AutomationsHub() {
  const [templates, setTemplates] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [editingTpl, setEditingTpl] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [section, setSection] = useState('welcome'); // welcome | followups | templates

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tpls, rls] = await Promise.all([
        base44.entities.MessageTemplate.list('-updated_date', 200),
        base44.entities.AutomationRule.list('-priority', 100),
      ]);
      setTemplates(tpls || []);
      setRules(rls || []);
    } catch (e) {
      toast.error('Failed to load automations');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await base44.functions.invoke('seedDefaultAutomations', {});
      const data = res?.data ?? res;
      if (data?.ok !== false) {
        toast.success(`Seeded ${data?.templates_created || 0} welcome templates${data?.rule_created ? ' + automation rule' : ''}`);
        loadData();
      } else {
        toast.error(data?.error || 'Failed to seed');
      }
    } catch (e) {
      toast.error(e.message || 'Failed to seed');
    } finally { setSeeding(false); }
  };

  const handleToggleTpl = async (tpl) => {
    try {
      await base44.entities.MessageTemplate.update(tpl.id, { is_active: !tpl.is_active });
      setTemplates((prev) => prev.map((t) => t.id === tpl.id ? { ...t, is_active: !t.is_active } : t));
    } catch (e) { toast.error('Failed to toggle'); }
  };

  const handleDeleteTpl = async (tpl) => {
    if (!confirm(`Delete "${tpl.title}"?`)) return;
    try {
      await base44.entities.MessageTemplate.delete(tpl.id);
      setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
      toast.success('Template deleted');
    } catch (e) { toast.error('Failed to delete'); }
  };

  const handleSaveTpl = async (formData) => {
    try {
      if (editingTpl?.id) {
        await base44.entities.MessageTemplate.update(editingTpl.id, formData);
        toast.success('Template updated');
      } else {
        const me = await base44.auth.me();
        await base44.entities.MessageTemplate.create({
          ...formData,
          created_by_email: me.email,
          created_by_name: me.full_name,
        });
        toast.success('Template created');
      }
      setShowEditor(false);
      setEditingTpl(null);
      loadData();
    } catch (e) {
      toast.error(e.message || 'Failed to save');
    }
  };

  const handleToggleRule = async (rule) => {
    try {
      await base44.entities.AutomationRule.update(rule.id, { is_active: !rule.is_active });
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
    } catch (e) { toast.error('Failed to toggle'); }
  };

  const welcomeTemplates = templates.filter((t) => t.category === 'welcome_sequence').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const otherTemplates = templates.filter((t) => t.category !== 'welcome_sequence');
  const followupRules = rules.filter((r) => r.trigger_type === 'landlord_created' || r.trigger_type === 'days_no_activity' || r.actions?.some((a) => a.type === 'schedule_followup' || a.type === 'send_template'));

  const TABS = [
    { key: 'welcome', label: 'Welcome Sequence', icon: Sparkles, count: welcomeTemplates.length },
    { key: 'followups', label: 'Follow-up Automations', icon: Repeat2, count: followupRules.length },
    { key: 'templates', label: 'Templates Library', icon: Mail, count: otherTemplates.length },
  ];

  return (
    <div className="page-root">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="page-title text-3xl flex items-center gap-2"><Zap className="w-7 h-7 text-accent" /> Automations Hub</h1>
            <p className="page-subtitle mt-1">Control every automated message — welcome sequence, follow-ups, and templates — from one place.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSeed} disabled={seeding} variant="outline" size="sm" className="gap-1.5">
              {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Seed Defaults
            </Button>
            <Button onClick={() => { setEditingTpl(null); setShowEditor(true); }} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5">
              <Plus className="w-3.5 h-3.5" /> New Template
            </Button>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 p-1 rounded-xl glass-card">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = section === t.key;
            return (
              <button key={t.key} onClick={() => setSection(t.key)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${active ? 'bg-accent/15 text-accent' : 'text-muted-foreground hover:bg-white/5'}`}>
                <Icon className="w-4 h-4" /> {t.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-accent/20' : 'bg-white/5'}`}>{t.count}</span>
              </button>
            );
          })}
        </div>

        {/* Editor inline */}
        {showEditor && (
          <TemplateEditor
            template={editingTpl}
            onSave={handleSaveTpl}
            onCancel={() => { setShowEditor(false); setEditingTpl(null); }}
          />
        )}

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
        ) : section === 'welcome' ? (
          <div className="space-y-3">
            {welcomeTemplates.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No welcome sequence templates yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Click "Seed Defaults" to create the 3 WhatsApp messages + welcome email.</p>
              </div>
            ) : (
              welcomeTemplates.map((tpl) => (
                <TemplateRow key={tpl.id} tpl={tpl} onEdit={(t) => { setEditingTpl(t); setShowEditor(true); }} onDelete={handleDeleteTpl} onToggle={handleToggleTpl} />
              ))
            )}
          </div>
        ) : section === 'followups' ? (
          <div className="space-y-3">
            {followupRules.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No follow-up automations yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Follow-up automations appear here once created.</p>
              </div>
            ) : (
              followupRules.map((rule) => (
                <AutomationRuleRow key={rule.id} rule={rule} onToggle={handleToggleRule} onEdit={() => {}} />
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {otherTemplates.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <Mail className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No templates yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Click "New Template" to create your first message template.</p>
              </div>
            ) : (
              otherTemplates.map((tpl) => (
                <TemplateRow key={tpl.id} tpl={tpl} onEdit={(t) => { setEditingTpl(t); setShowEditor(true); }} onDelete={handleDeleteTpl} onToggle={handleToggleTpl} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}