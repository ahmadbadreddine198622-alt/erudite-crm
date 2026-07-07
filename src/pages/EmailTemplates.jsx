// Template Hub — unified template manager for ALL channels (email, iMessage,
// WhatsApp, Telegram, SMS). Replaces the old stub + the separate iMessage page.
// Agents can create, edit, duplicate, delete, and filter by channel.

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { toast } from 'sonner';
import { FileBox, Plus, Edit2, Trash2, Globe, Lock, Users, Search, Mail, MessageSquare, MessageCircle, Send, Smartphone } from 'lucide-react';
import EmailTemplateDialog from '@/components/landlord/EmailTemplateDialog';

const VIS_META = {
  private: { label: 'Private', icon: Lock, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)' },
  shared: { label: 'Everyone', icon: Globe, color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
  specific_agents: { label: 'Specific agents', icon: Users, color: '#eab308', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.3)' },
};

const CATEGORY_LABELS = {
  general: 'General', initial_contact: 'Initial Contact', follow_up_general: 'Follow Up',
  viewing: 'Viewing', renewal: 'Renewal', welcome_sequence: 'Welcome',
  price_discovery: 'Price Discovery', listing_commitment: 'Listing Commitment',
  form_a: 'Form A',
};

const CHANNEL_TABS = [
  { key: 'all',       label: 'All',       icon: FileBox,      color: '#eab308' },
  { key: 'email',     label: 'Email',     icon: Mail,         color: '#60a5fa' },
  { key: 'imessage',  label: 'iMessage',  icon: MessageSquare,color: '#0A84FF' },
  { key: 'whatsapp',  label: 'WhatsApp',  icon: MessageCircle,color: '#34d399' },
  { key: 'telegram',  label: 'Telegram',  icon: Send,         color: '#38bdf8' },
  { key: 'sms',       label: 'SMS',       icon: Smartphone,   color: '#a78bfa' },
];

function timeAgo(iso) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d ago`;
  const h = Math.floor(diff / 3600000);
  if (h > 0) return `${h}h ago`;
  const m = Math.floor(diff / 60000);
  if (m > 0) return `${m}m ago`;
  return 'Just now';
}

const bodyPreviewStyle = {
  margin: '0 0 10px',
  fontSize: '12.5px',
  color: 'rgba(255,255,255,0.62)',
  lineHeight: 1.55,
  whiteSpace: 'pre-wrap',
  maxHeight: 80,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 4,
  WebkitBoxOrient: 'vertical',
};

export default function EmailTemplates() {
  const { user, isAdmin } = useCurrentUser();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [prefill, setPrefill] = useState(null);
  const [createChannel, setCreateChannel] = useState('email');

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['messageTemplates', 'all'],
    queryFn: async () => {
      const list = await base44.entities.MessageTemplate.filter({ is_active: true }, '-updated_date', 500);
      return list || [];
    },
  });

  const filtered = templates.filter((t) => {
    if (channelFilter !== 'all' && t.channel !== channelFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (t.title || '').toLowerCase().includes(q) || (t.body || '').toLowerCase().includes(q) || (t.subject || '').toLowerCase().includes(q);
  });

  const openCreate = (channel = channelFilter === 'all' ? 'email' : channelFilter) => {
    setEditing(null);
    setPrefill(null);
    setCreateChannel(channel);
    setDialogOpen(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    setPrefill(null);
    setCreateChannel(t.channel || 'email');
    setDialogOpen(true);
  };

  const openDuplicate = (t) => {
    setEditing(null);
    setCreateChannel(t.channel || 'email');
    setPrefill({ title: `${t.title} (copy)`, body: t.body || '', subject: t.subject || '', category: t.category || 'general', visibility: 'private' });
    setDialogOpen(true);
  };

  const handleDelete = async (t) => {
    if (!confirm('Delete this template? This cannot be undone.')) return;
    try {
      await base44.entities.MessageTemplate.delete(t.id);
      qc.invalidateQueries({ queryKey: ['messageTemplates'] });
      toast.success('Template deleted');
    } catch (e) {
      toast.error(e?.message || 'Failed to delete');
    }
  };

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ['messageTemplates'] });
    setDialogOpen(false);
    setEditing(null);
    setPrefill(null);
  };

  const counts = {};
  templates.forEach((t) => { counts[t.channel] = (counts[t.channel] || 0) + 1; });

  return (
    <div className="page-root page-enter">
      <style>{`
        @keyframes th-row-in { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: translateY(0); } }
        .th-row { animation: th-row-in 0.28s ease both; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 28, display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileBox style={{ width: 26, height: 26, color: '#eab308' }} />
            Template Hub
          </h1>
          <p className="page-subtitle" style={{ marginTop: 6 }}>
            All your communication templates in one place — email, iMessage, WhatsApp, Telegram, and SMS. Use <code style={{ color: '#eab308' }}>{'{landlord_name}'}</code> style variables for auto-personalization.
          </p>
        </div>
        <button onClick={() => openCreate()}
          className="flex items-center gap-2 px-4 h-10 rounded-xl transition-all border"
          style={{ background: 'linear-gradient(180deg, #eab308, #ca9a04)', color: '#1a1205', border: '1px solid rgba(234,179,8,0.6)', cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 6px 20px rgba(234,179,8,0.3)' }}>
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {/* Channel tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {CHANNEL_TABS.map((tab) => {
          const TabIcon = tab.icon;
          const active = channelFilter === tab.key;
          const count = tab.key === 'all' ? templates.length : (counts[tab.key] || 0);
          return (
            <button key={tab.key} onClick={() => setChannelFilter(tab.key)}
              className="flex items-center gap-2 px-3 h-9 rounded-lg transition-all border"
              style={{
                background: active ? `${tab.color}22` : 'rgba(255,255,255,0.04)',
                color: active ? tab.color : 'rgba(255,255,255,0.5)',
                border: `1px solid ${active ? `${tab.color}55` : 'rgba(255,255,255,0.1)'}`,
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>
              <TabIcon size={13} />
              {tab.label}
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '8px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <Search className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)', flex: 'none' }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates by name, subject, or content…"
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'rgba(255,255,255,0.9)', fontSize: 13 }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{filtered.length} of {templates.length}</span>
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading templates…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, borderRadius: 16, background: 'rgba(234,179,8,0.04)', border: '1px solid rgba(234,179,8,0.15)' }}>
          <FileBox style={{ width: 40, height: 40, color: 'rgba(234,179,8,0.4)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.8)', margin: '0 0 6px' }}>
            {search ? 'No templates match your search' : 'No templates yet'}
          </h3>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: '0 0 16px' }}>
            {search ? 'Try a different search term.' : 'Create your first template to reuse common messages across all channels.'}
          </p>
          {!search && (
            <button onClick={() => openCreate()}
              className="flex items-center gap-2 px-4 h-9 rounded-lg"
              style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.4)', cursor: 'pointer', fontSize: 12, fontWeight: 600, margin: '0 auto' }}>
              <Plus className="w-3.5 h-3.5" /> Create First Template
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((t, idx) => {
            const vis = VIS_META[t.visibility] || VIS_META.private;
            const VisIcon = vis.icon;
            const isOwner = t.created_by_email === user?.email;
            const canManage = isAdmin || isOwner;
            const catLabel = CATEGORY_LABELS[t.category] || t.category || 'General';
            const chMeta = CHANNEL_TABS.find((c) => c.key === t.channel) || CHANNEL_TABS[0];
            const ChIcon = chMeta.icon;
            return (
              <div key={t.id} className="th-row" style={{ animationDelay: `${Math.min(idx * 0.03, 0.3)}s`, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: 16, transition: 'border-color 0.15s, background 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${chMeta.color}44`; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}>
                {/* Top row: title + badges */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>{t.title || 'Untitled'}</h3>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600, background: `${chMeta.color}18`, color: chMeta.color, border: `1px solid ${chMeta.color}40` }} title={`Channel: ${chMeta.label}`}>
                      <ChIcon size={10} /> {chMeta.label}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>{catLabel}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600, background: vis.bg, color: vis.color, border: `1px solid ${vis.border}` }} title={`Visibility: ${vis.label}`}>
                      <VisIcon size={10} /> {vis.label}
                    </span>
                    {t.created_by_name && (
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>by {t.created_by_name}{isOwner ? ' (you)' : ''}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={() => openEdit(t)} disabled={!canManage} title={canManage ? 'Edit template' : 'Only the owner or admin can edit'}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, cursor: canManage ? 'pointer' : 'not-allowed', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: canManage ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)' }}>
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => openDuplicate(t)} title="Duplicate"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                      <Plus size={13} />
                    </button>
                    {canManage && (
                      <button onClick={() => handleDelete(t)} title="Delete"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
                {/* Subject (email only) */}
                {t.channel === 'email' && t.subject && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6, fontStyle: 'italic' }}>Subject: {t.subject}</div>
                )}
                {/* Body preview */}
                <p style={bodyPreviewStyle}>{t.body || '(empty body)'}</p>
                {/* Footer: usage + specific agents */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 10.5, color: 'rgba(255,255,255,0.4)', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span>Used <strong style={{ color: 'rgba(255,255,255,0.6)' }}>{t.usage_count || 0}</strong>×</span>
                    <span>Last used {timeAgo(t.last_used_at)}</span>
                  </div>
                  {t.visibility === 'specific_agents' && Array.isArray(t.shared_with_agents) && t.shared_with_agents.length > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, background: 'rgba(234,179,8,0.08)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' }}>
                      <Users size={10} /> Shared with {t.shared_with_agents.length} agent{t.shared_with_agents.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EmailTemplateDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); setPrefill(null); }}
        template={editing || (prefill ? { ...prefill, channel: createChannel } : null)}
        channel={createChannel}
        onSaved={handleSaved}
      />
    </div>
  );
}