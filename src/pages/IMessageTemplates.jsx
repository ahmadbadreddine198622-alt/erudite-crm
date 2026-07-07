// IMessageTemplates — manager page for iMessage (channel='imessage') templates.
// Agents can create, edit, and reuse common iMessage responses.
// Admins (and template owners) can set who can reuse each template via the
// visibility control (private / shared / specific_agents).

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { toast } from 'sonner';
import { MessageSquare, Plus, Edit2, Trash2, Globe, Lock, Users, Search, FileText } from 'lucide-react';
import EmailTemplateDialog from '@/components/landlord/EmailTemplateDialog';

const VIS_META = {
  private: { label: 'Private', icon: Lock, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)' },
  shared: { label: 'Everyone', icon: Globe, color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
  specific_agents: { label: 'Specific agents', icon: Users, color: '#eab308', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.3)' },
};

const CATEGORY_LABELS = {
  general: 'General', initial_contact: 'Initial Contact', follow_up_general: 'Follow Up',
  viewing: 'Viewing', renewal: 'Renewal', welcome_sequence: 'Welcome',
};

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

export default function IMessageTemplates() {
  const { user, isAdmin } = useCurrentUser();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [prefill, setPrefill] = useState(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['messageTemplates', 'imessage'],
    queryFn: async () => {
      const list = await base44.entities.MessageTemplate.filter({ channel: 'imessage', is_active: true }, '-updated_date', 200);
      return list || [];
    },
  });

  const filtered = templates.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (t.title || '').toLowerCase().includes(q) || (t.body || '').toLowerCase().includes(q);
  });

  const openCreate = () => {
    setEditing(null);
    setPrefill(null);
    setDialogOpen(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    setPrefill(null);
    setDialogOpen(true);
  };

  const openDuplicate = (t) => {
    setEditing(null);
    setPrefill({ title: `${t.title} (copy)`, body: t.body || '', subject: '', category: t.category || 'general', visibility: 'private' });
    setDialogOpen(true);
  };

  const handleDelete = async (t) => {
    if (!confirm('Delete this iMessage template? This cannot be undone.')) return;
    try {
      await base44.entities.MessageTemplate.delete(t.id);
      qc.invalidateQueries({ queryKey: ['messageTemplates', 'imessage'] });
      toast.success('Template deleted');
    } catch (e) {
      toast.error(e?.message || 'Failed to delete');
    }
  };

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ['messageTemplates', 'imessage'] });
    qc.invalidateQueries({ queryKey: ['messageTemplates'] });
    setDialogOpen(false);
    setEditing(null);
    setPrefill(null);
  };

  return (
    <div className="page-root page-enter">
      <style>{`
        @keyframes imt-row-in { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: translateY(0); } }
        .imt-row { animation: imt-row-in 0.28s ease both; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 28, display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageSquare style={{ width: 26, height: 26, color: '#0A84FF' }} />
            iMessage Templates
          </h1>
          <p className="page-subtitle" style={{ marginTop: 6 }}>
            Save and reuse common iMessage responses. Anyone can create and share templates — you'll only see templates you have access to.
          </p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 h-10 rounded-xl transition-all border"
          style={{ background: 'linear-gradient(180deg, #0A84FF, #0066cc)', color: '#fff', border: '1px solid rgba(10,132,255,0.6)', cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 6px 20px rgba(10,132,255,0.3)' }}>
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '8px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <Search className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)', flex: 'none' }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates by name or content…"
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'rgba(255,255,255,0.9)', fontSize: 13 }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{filtered.length} of {templates.length}</span>
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading templates…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, borderRadius: 16, background: 'rgba(10,132,255,0.04)', border: '1px solid rgba(10,132,255,0.15)' }}>
          <FileText style={{ width: 40, height: 40, color: 'rgba(10,132,255,0.4)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.8)', margin: '0 0 6px' }}>
            {search ? 'No templates match your search' : 'No iMessage templates yet'}
          </h3>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: '0 0 16px' }}>
            {search ? 'Try a different search term.' : 'Create your first template to reuse common iMessage responses.'}
          </p>
          {!search && (
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 h-9 rounded-lg"
              style={{ background: 'rgba(10,132,255,0.15)', color: '#60a5fa', border: '1px solid rgba(10,132,255,0.4)', cursor: 'pointer', fontSize: 12, fontWeight: 600, margin: '0 auto' }}>
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
            return (
              <div key={t.id} className="imt-row" style={{ animationDelay: `${Math.min(idx * 0.03, 0.3)}s`, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: 16, transition: 'border-color 0.15s, background 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(10,132,255,0.3)'; e.currentTarget.style.background = 'rgba(10,132,255,0.04)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}>
                {/* Top row: title + badges */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>{t.title || 'Untitled'}</h3>
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
        template={editing || (prefill ? { ...prefill, channel: 'imessage' } : null)}
        channel="imessage"
        onSaved={handleSaved}
      />
    </div>
  );
}