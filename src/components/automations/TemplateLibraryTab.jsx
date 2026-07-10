// TemplateLibraryTab — the unified template manager surface embedded in the
// Automations Hub. Channel filter tabs + search + list. New templates are
// created via the shared EmailTemplateDialog (with channel selector + access
// control) owned by the parent Automations Hub.
import React, { useState, useMemo } from 'react';
import TemplateRow from './TemplateRow';
import { Search, FileBox, Plus, Mail, MessageSquare, MessageCircle, Send, Smartphone } from 'lucide-react';

const CHANNEL_TABS = [
  { key: 'all', label: 'All', icon: FileBox, color: '#eab308' },
  { key: 'email', label: 'Email', icon: Mail, color: '#60a5fa' },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: '#34d399' },
  { key: 'imessage', label: 'iMessage', icon: MessageSquare, color: '#0A84FF' },
  { key: 'telegram', label: 'Telegram', icon: Send, color: '#38bdf8' },
  { key: 'sms', label: 'SMS', icon: Smartphone, color: '#a78bfa' },
];

export default function TemplateLibraryTab({ templates, onEdit, onDelete, onToggle, onNew }) {
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');

  const counts = useMemo(() => {
    const c = {};
    templates.forEach((t) => { c[t.channel] = (c[t.channel] || 0) + 1; });
    return c;
  }, [templates]);

  const filtered = templates.filter((t) => {
    if (channelFilter !== 'all' && t.channel !== channelFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (t.title || '').toLowerCase().includes(q) || (t.body || '').toLowerCase().includes(q) || (t.subject || '').toLowerCase().includes(q);
  });

  const activeLabel = channelFilter === 'all' ? 'Template' : `${CHANNEL_TABS.find((c) => c.key === channelFilter)?.label} Template`;

  return (
    <div className="space-y-4">
      {/* Channel filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {CHANNEL_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = channelFilter === tab.key;
          const count = tab.key === 'all' ? templates.length : (counts[tab.key] || 0);
          return (
            <button key={tab.key} onClick={() => setChannelFilter(tab.key)}
              className="flex items-center gap-2 px-3 h-9 rounded-lg transition-all border"
              style={{
                background: active ? `${tab.color}22` : 'rgba(255,255,255,0.04)',
                color: active ? tab.color : 'rgba(255,255,255,0.5)',
                border: `1px solid ${active ? `${tab.color}55` : 'rgba(255,255,255,0.1)'}`,
                fontSize: 12, fontWeight: 600,
              }}>
              <Icon className="w-3.5 h-3.5" /> {tab.label}
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search + New */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl glass-card flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates by name, subject, or content…"
            className="flex-1 bg-transparent border-none outline-none text-sm text-foreground" />
          <span className="text-xs text-muted-foreground font-semibold">{filtered.length} of {templates.length}</span>
        </div>
        <button onClick={() => onNew(channelFilter === 'all' ? 'whatsapp' : channelFilter)}
          className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold transition-all"
          style={{ background: 'linear-gradient(180deg, #eab308, #ca9a04)', color: '#1a1205', border: '1px solid rgba(234,179,8,0.6)', boxShadow: '0 6px 20px rgba(234,179,8,0.25)' }}>
          <Plus className="w-4 h-4" /> New {activeLabel}
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <FileBox className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{search ? 'No templates match your search.' : 'No templates yet for this channel.'}</p>
          <p className="text-xs text-muted-foreground mt-1">Create a template, pick its channel, and choose who can see it.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((tpl) => (
            <TemplateRow key={tpl.id} tpl={tpl} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}