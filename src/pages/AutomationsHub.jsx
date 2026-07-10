// Automations Hub — the SINGLE place to manage every communication template
// AND every automation rule. One MessageTemplate entity (channel + access
// control) + one AutomationRule entity (create / edit / delete / toggle).
// Sections: Welcome Sequence · Automations · Internal Notifications · Templates Library.

import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Zap, Plus, RefreshCw, Clock, Loader2, Sparkles, Repeat2, Bell, GitBranch,
} from 'lucide-react';
import InternalNotificationsTab from '@/components/automations/InternalNotificationsTab';
import TemplateRow from '@/components/automations/TemplateRow';
import TemplateLibraryTab from '@/components/automations/TemplateLibraryTab';
import RuleCard from '@/components/automations/RuleCard';
import RuleFormDialog from '@/components/automations/RuleFormDialog';
import EmailTemplateDialog from '@/components/landlord/EmailTemplateDialog';

// Trigger metadata shared with RuleCard (mirrors the old Email Automations page).
const TRIGGER_LABELS = {
  lead_status_change: { label: 'Lead Status Change', icon: GitBranch, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  pipeline_stage_change: { label: 'Pipeline Stage Change', icon: Zap, color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  lead_created: { label: 'New Lead Created', icon: Plus, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  days_no_activity: { label: 'No Activity', icon: Clock, color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  lead_score_change: { label: 'Lead Score Change', icon: Zap, color: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
  tag_added: { label: 'Tag Added', icon: Plus, color: 'bg-sky-500/10 text-sky-600 border-sky-500/20' },
};

export default function AutomationsHub() {
  const [templates, setTemplates] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTpl, setEditingTpl] = useState(null);
  const [createChannel, setCreateChannel] = useState('whatsapp');
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [section, setSection] = useState('welcome');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tpls, rls] = await Promise.all([
        base44.entities.MessageTemplate.list('-updated_date', 200),
        base44.entities.AutomationRule.list('-created_date', 200),
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

  // --- Template handlers ---
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

  const handleSavedTpl = () => {
    setDialogOpen(false);
    setEditingTpl(null);
    loadData();
  };

  // --- Automation rule handlers ---
  const handleToggleRule = async (rule) => {
    try {
      await base44.entities.AutomationRule.update(rule.id, { is_active: !rule.is_active });
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
    } catch (e) { toast.error('Failed to toggle'); }
  };

  const handleDeleteRule = async (rule) => {
    if (!confirm(`Delete automation "${rule.name}"?`)) return;
    try {
      await base44.entities.AutomationRule.delete(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      toast.success('Automation deleted');
    } catch (e) { toast.error('Failed to delete'); }
  };

  const openNewRule = () => { setEditingRule(null); setRuleDialogOpen(true); };
  const openEditRule = (rule) => { setEditingRule(rule); setRuleDialogOpen(true); };
  const closeRuleDialog = () => { setRuleDialogOpen(false); setEditingRule(null); loadData(); };

  // --- Derived lists ---
  const welcomeTemplates = templates.filter((t) => t.category === 'welcome_sequence').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const otherTemplates = templates.filter((t) => t.category !== 'welcome_sequence');
  const automationRules = rules;
  const notifyRules = rules.filter((r) => r.actions?.some((a) => a.type === 'notify'));

  const TABS = [
    { key: 'welcome', label: 'Welcome Sequence', icon: Sparkles, count: welcomeTemplates.length },
    { key: 'automations', label: 'Automations', icon: Repeat2, count: automationRules.length },
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
            <p className="page-subtitle mt-1">The single home for every template and every automation — pick a channel, set who can see it, and automate notifications, follow-ups, and assignments.</p>
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
            {section === 'automations' && (
              <Button onClick={openNewRule} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5">
                <Plus className="w-3.5 h-3.5" /> New Automation
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
        ) : section === 'automations' ? (
          <div className="space-y-3">
            {automationRules.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <Repeat2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No automations yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Create an automation to act on lead changes, inactivity, or tags — send email, notify, tag, schedule a follow-up, or assign an agent.</p>
              </div>
            ) : (
              automationRules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  triggerLabels={TRIGGER_LABELS}
                  onEdit={() => openEditRule(rule)}
                  onToggle={() => handleToggleRule(rule)}
                  onDelete={() => handleDeleteRule(rule)}
                />
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

      {/* Shared template editor — channel selector + access control (private / everyone / specific agents) */}
      <EmailTemplateDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingTpl(null); }}
        template={editingTpl}
        channel={createChannel}
        showChannelSelector
        onSaved={handleSavedTpl}
      />

      {/* Automation rule editor (create / edit) */}
      <RuleFormDialog
        open={ruleDialogOpen}
        onClose={closeRuleDialog}
        editingRule={editingRule}
      />
    </div>
  );
}