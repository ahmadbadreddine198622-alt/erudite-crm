// Automations Hub — the SINGLE place to manage every communication template.
// One MessageTemplate entity, one editor (EmailTemplateDialog with channel
// selector + access control: private / everyone / specific agents).
// Sections: Welcome Sequence · Follow-up Automations · Internal Notifications · Templates Library.

import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Zap, Plus, ToggleLeft, ToggleRight, Users, RefreshCw, Clock, Loader2,
  Sparkles, Repeat2, Bell,
} from 'lucide-react';
import InternalNotificationsTab from '@/components/automations/InternalNotificationsTab';
import TemplateRow from '@/components/automations/TemplateRow';
import TemplateLibraryTab from '@/components/automations/TemplateLibraryTab';
import EmailTemplateDialog from '@/components/landlord/EmailTemplateDialog';

function AutomationRuleRow({ rule, onToggle }) {
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
        {rule.is_active ? <ToggleRight className="w-7 h-7 text-emerald-400" /> : <ToggleLeft className="w-7 h-7 text-muted-foreground" />}
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTpl, setEditingTpl] = useState(null);
  const [createChannel, setCreateChannel] = useState('whatsapp');
  const [section, setSection] = useState('welcome');

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
      setTemplates((prev) => prev.map((t) => t.id === tpl.id ? { ...t, is_active: !tpl.is_active } : t));
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

  // New template — optionally prefilled (e.g. welcome_sequence category).
  const openNew = (channel = 'whatsapp', prefill = null) => {
    setEditingTpl(prefill ? { ...prefill, channel } : null);
    setCreateChannel(channel);
    setDialogOpen(true);
  };

  const openEdit = (tpl) => {
    setEditingTpl(tpl);
    setCreateChannel(tpl.channel || 'whatsapp');
    setDialogOpen(true);
  };

  const handleSaved = () => {
    setDialogOpen(false);
    setEditingTpl(null);
    loadData();
  };

  const handleToggleRule = async (rule) => {
    try {
      await base44.entities.AutomationRule.update(rule.id, { is_active: !rule.is_active });
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, is_active: !rule.is_active } : r));
    } catch (e) { toast.error('Failed to toggle'); }
  };

  const welcomeTemplates = templates.filter((t) => t.category === 'welcome_sequence').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const otherTemplates = templates.filter((t) => t.category !== 'welcome_sequence');
  const followupRules = rules.filter((r) => r.trigger_type === 'landlord_created' || r.trigger_type === 'days_no_activity' || r.actions?.some((a) => a.type === 'schedule_followup' || a.type === 'send_template'));
  const notifyRules = rules.filter((r) => r.actions?.some((a) => a.type === 'notify'));

  const TABS = [
    { key: 'welcome', label: 'Welcome Sequence', icon: Sparkles, count: welcomeTemplates.length },
    { key: 'followups', label: 'Follow-up Automations', icon: Repeat2, count: followupRules.length },
    { key: 'notifications', label: 'Internal Notifications', icon: Bell, count: notifyRules.length },
    { key: 'templates', label: 'Templates Library', icon: Zap, count: otherTemplates.length },
  ];

  return (
    <div className="page-root">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="page-title text-3xl flex items-center gap-2"><Zap className="w-7 h-7 text-accent" /> Automations Hub</h1>
            <p className="page-subtitle mt-1">The single home for every template — pick a channel, set who can see it (private, everyone, or specific agents), and reuse it everywhere.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSeed} disabled={seeding} variant="outline" size="sm" className="gap-1.5">
              {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Seed Defaults
            </Button>
            {section === 'welcome' && (
              <Button onClick={() => openNew('whatsapp', { category: 'welcome_sequence' })} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5">
                <Plus className="w-3.5 h-3.5" /> New Welcome Message
              </Button>
            )}
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
                <TemplateRow key={tpl.id} tpl={tpl} onEdit={openEdit} onDelete={handleDeleteTpl} onToggle={handleToggleTpl} />
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
                <AutomationRuleRow key={rule.id} rule={rule} onToggle={handleToggleRule} />
              ))
            )}
          </div>
        ) : section === 'notifications' ? (
          <InternalNotificationsTab rules={rules} onChanged={loadData} />
        ) : (
          <TemplateLibraryTab
            templates={otherTemplates}
            onEdit={openEdit}
            onDelete={handleDeleteTpl}
            onToggle={handleToggleTpl}
            onNew={(channel) => openNew(channel)}
          />
        )}
      </div>

      {/* Shared editor — channel selector + access control (private / everyone / specific agents) */}
      <EmailTemplateDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingTpl(null); }}
        template={editingTpl}
        channel={createChannel}
        showChannelSelector
        onSaved={handleSaved}
      />
    </div>
  );
}