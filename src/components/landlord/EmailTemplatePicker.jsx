// EmailTemplatePicker — inline dropdown showing the agent's visible email templates.
// Clicking a template loads it into the composer; edit/delete actions per row.
//
// Props:
//   onSelect (fn)  — called with { subject, body } when a template is chosen
//   onLoad (fn)    — optional, called with the full template object (for "manage" actions)

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { FileText, Edit2, Trash2, Plus, Loader2, ChevronDown, Lock, Globe, Users, Search } from 'lucide-react';
import EmailTemplateDialog from './EmailTemplateDialog';
import { toast } from 'sonner';

const VIS_META = {
  private: { icon: Lock, color: 'rgba(255,255,255,0.4)', label: 'Private' },
  shared: { icon: Globe, color: '#34d399', label: 'Everyone' },
  specific_agents: { icon: Users, color: '#60a5fa', label: 'Specific' },
};

export default function EmailTemplatePicker({ onSelect, channel = 'email', compact = false }) {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['messageTemplates', channel],
    queryFn: async () => {
      const list = await base44.entities.MessageTemplate.filter({ channel, is_active: true }, '-updated_date', 100);
      return list || [];
    },
  });

  const filtered = templates.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (t.title || '').toLowerCase().includes(q) || (t.subject || '').toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q);
  });

  const handleSelect = (t) => {
    onSelect?.({ subject: t.subject || '', body: t.body || '', template: t });
    // Bump usage count (fire-and-forget)
    base44.entities.MessageTemplate.update(t.id, { usage_count: (t.usage_count || 0) + 1, last_used_at: new Date().toISOString() }).catch(() => {});
    qc.invalidateQueries({ queryKey: ['emailTemplates'] });
    setOpen(false);
  };

  const handleEdit = (e, t) => {
    e.stopPropagation();
    setEditing(t);
    setDialogOpen(true);
  };

  const handleDelete = async (e, t) => {
    e.stopPropagation();
    if (!confirm(`Delete "${t.title}"?`)) return;
    try {
      await base44.entities.MessageTemplate.delete(t.id);
      qc.invalidateQueries({ queryKey: ['emailTemplates'] });
      toast.success('Template deleted');
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const handleNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const canEdit = (t) => user?.role === 'admin' || t.created_by_email === user?.email;

  return (
    <>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen((o) => !o)}
          title="Templates"
          style={compact ? {
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
            background: open ? 'hsl(38 92% 50% / 0.18)' : 'transparent',
            color: open ? 'hsl(38 92% 64%)' : 'rgba(255,255,255,0.6)',
            border: '1px solid ' + (open ? 'hsl(38 92% 50% / 0.3)' : 'transparent'),
            transition: 'background 0.15s, border-color 0.15s',
          } : {
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 11px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            fontFamily: "'Inter',sans-serif",
            background: open ? 'hsl(38 92% 50% / 0.18)' : 'rgba(255,255,255,0.05)',
            color: open ? 'hsl(38 92% 64%)' : 'rgba(255,255,255,0.7)',
            border: '1px solid ' + (open ? 'hsl(38 92% 50% / 0.4)' : 'rgba(255,255,255,0.12)'),
          }}
        >
          <FileText size={compact ? 14 : 13} />
          {!compact && <span>Templates</span>}
          {!compact && <ChevronDown size={12} style={{ opacity: 0.6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />}
        </button>

        {open && (
          <>
            {/* Click-away overlay */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
            <div
              style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 45,
                width: 340, maxHeight: 400, overflowY: 'auto',
                borderRadius: 12, background: 'rgba(11,16,26,0.98)',
                border: '1px solid rgba(201,162,75,0.25)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
                backdropFilter: 'blur(16px)',
                padding: 10,
              }}
            >
              {/* Search + New */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 9px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Search size={12} style={{ color: 'rgba(255,255,255,0.35)' }} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates…" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'rgba(255,255,255,0.9)', fontSize: 12, fontFamily: "'Inter',sans-serif" }} />
                </div>
                <button onClick={handleNew} title="New template"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 7, cursor: 'pointer', background: 'hsl(38 92% 50% / 0.18)', border: '1px solid hsl(38 92% 50% / 0.4)', color: 'hsl(38 92% 64%)' }}>
                  <Plus size={14} />
                </button>
              </div>

              {/* List */}
              {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Loader2 size={16} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} /></div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '16px 8px', textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '0 0 8px' }}>No templates yet</p>
                  <button onClick={handleNew} style={{ fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '5px 12px', borderRadius: 6, background: 'hsl(38 92% 50% / 0.14)', border: '1px solid hsl(38 92% 50% / 0.35)', color: 'hsl(38 92% 62%)', fontFamily: "'Inter',sans-serif" }}>+ Create one</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {filtered.map((t) => {
                    const vis = VIS_META[t.visibility] || VIS_META.private;
                    const VisIcon = vis.icon;
                    const editable = canEdit(t);
                    return (
                      <div key={t.id} onClick={() => handleSelect(t)}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 9px', borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.12s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(201,162,75,0.08)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
                      >
                        <FileText size={14} style={{ color: 'hsl(38 92% 55%)', marginTop: 1, flex: 'none' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                            <VisIcon size={10} style={{ color: vis.color, flex: 'none' }} title={vis.label} />
                          </div>
                          {t.subject && <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>}
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 3, textTransform: 'capitalize' }}>{(t.category || 'general').replace(/_/g, ' ')}{t.created_by_name ? ' · ' + t.created_by_name : ''}</div>
                        </div>
                        {editable && (
                          <div style={{ display: 'flex', gap: 2, flex: 'none' }}>
                            <button onClick={(e) => handleEdit(e, t)} title="Edit / manage access" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'rgba(255,255,255,0.4)', display: 'flex' }}><Edit2 size={12} /></button>
                            <button onClick={(e) => handleDelete(e, t)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'rgba(255,255,255,0.4)', display: 'flex' }}><Trash2 size={12} /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <EmailTemplateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        template={editing}
        channel={channel}
        onSaved={() => { qc.invalidateQueries({ queryKey: ['messageTemplates', channel] }); qc.invalidateQueries({ queryKey: ['emailTemplates'] }); }}
      />
    </>
  );
}