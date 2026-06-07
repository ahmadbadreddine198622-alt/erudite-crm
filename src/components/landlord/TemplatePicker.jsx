import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Zap, X, Plus, Pencil, Trash2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const CATEGORY_LABELS = {
  initial_contact: '👋 Initial Contact',
  price_discovery: '💰 Price Discovery',
  listing_commitment: '🤝 Listing Commitment',
  form_a: '📄 Form A',
  viewing: '🏠 Viewing',
  follow_up_general: '🔁 Follow-Up',
  renewal: '♻️ Renewal',
};

const CATEGORY_ORDER = ['initial_contact', 'price_discovery', 'listing_commitment', 'form_a', 'viewing', 'follow_up_general', 'renewal'];

function fillTemplate(body, vars) {
  let result = body;
  Object.entries(vars).forEach(([k, v]) => {
    result = result.replaceAll(`{{${k}}}`, v || `[${k}]`);
  });
  return result;
}

// ─── Manage Templates Modal ────────────────────────────────────────────────
function TemplateModal({ open, onClose }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null); // null = list, {} = new, {id,...} = edit
  const [form, setForm] = useState({ title: '', body: '', category: 'initial_contact', sort_order: 0, is_active: true });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['message-templates'],
    queryFn: () => base44.entities.MessageTemplate.list('sort_order', 200),
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing?.id
      ? base44.entities.MessageTemplate.update(editing.id, data)
      : base44.entities.MessageTemplate.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['message-templates'] });
      setEditing(null);
      toast.success(editing?.id ? 'Template updated' : 'Template created');
    },
    onError: (e) => toast.error('Save failed: ' + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MessageTemplate.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['message-templates'] }); toast.success('Deleted'); },
    onError: (e) => toast.error('Delete failed: ' + e.message),
  });

  const startEdit = (tmpl) => {
    setForm({ title: tmpl.title, body: tmpl.body, category: tmpl.category, sort_order: tmpl.sort_order || 0, is_active: tmpl.is_active !== false });
    setEditing(tmpl);
  };

  const startNew = () => {
    setForm({ title: '', body: '', category: 'initial_contact', sort_order: 0, is_active: true });
    setEditing({});
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="relative w-full max-w-2xl mx-4 rounded-2xl overflow-hidden" style={{ background: 'hsl(222 47% 11%)', border: '1px solid rgba(255,255,255,0.12)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 className="font-display font-semibold text-base" style={{ color: 'rgba(255,255,255,0.95)' }}>
            {editing ? (editing.id ? 'Edit Template' : 'New Template') : 'Manage Templates'}
          </h3>
          <div className="flex items-center gap-2">
            {!editing && (
              <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={startNew}>
                <Plus className="w-3.5 h-3.5" /> New
              </Button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/10 transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {editing ? (
            /* Edit / New form */
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Title</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Template name…"
                  className="w-full px-3 py-2 text-sm rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
                >
                  {CATEGORY_ORDER.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">
                  Body — use <code className="text-amber-400 text-[10px]">{'{{landlord_name}}'}</code>, <code className="text-amber-400 text-[10px]">{'{{property_name}}'}</code>, <code className="text-amber-400 text-[10px]">{'{{project_name}}'}</code>, <code className="text-amber-400 text-[10px]">{'{{agent_name}}'}</code>
                </label>
                <textarea
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  rows={8}
                  placeholder="Template body…"
                  className="w-full px-3 py-2 text-sm rounded-lg resize-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[11px] text-muted-foreground">Sort order</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                  className="w-20 px-2 py-1 text-sm rounded-md"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
                />
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground ml-auto">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                  Active
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                <Button size="sm" variant="outline" onClick={() => saveMutation.mutate(form)} disabled={!form.title || !form.body || saveMutation.isPending} className="gap-1.5">
                  {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Save Template
                </Button>
              </div>
            </div>
          ) : isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>
          ) : (
            /* List grouped by category */
            <div className="space-y-4">
              {CATEGORY_ORDER.map(cat => {
                const group = templates.filter(t => t.category === cat);
                if (!group.length) return null;
                return (
                  <div key={cat}>
                    <div className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>{CATEGORY_LABELS[cat]}</div>
                    <div className="space-y-1.5">
                      {group.map(t => (
                        <div key={t.id} className="flex items-start justify-between gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium" style={{ color: t.is_active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)' }}>{t.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{t.body.slice(0, 80)}…</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => startEdit(t)} className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"><Pencil className="w-3 h-3" /></button>
                            <button onClick={() => deleteMutation.mutate(t.id)} disabled={deleteMutation.isPending} className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Template Picker Popover ───────────────────────────────────────────────
export default function TemplatePicker({ landlord, agentName = 'Ahmad', onSelect }) {
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [expandedCats, setExpandedCats] = useState({});
  const ref = useRef(null);

  const { data: templates = [] } = useQuery({
    queryKey: ['message-templates'],
    queryFn: () => base44.entities.MessageTemplate.list('sort_order', 200),
    enabled: open,
  });

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const activeTemplates = templates.filter(t => t.is_active !== false);

  const vars = {
    landlord_name: landlord?.full_name_en || landlord?.full_name || '',
    property_name: landlord?.unit_reference || landlord?.property_name || '',
    project_name: landlord?.project_name || '',
    agent_name: agentName,
  };

  const toggleCat = (cat) => setExpandedCats(p => ({ ...p, [cat]: !p[cat] }));

  const handleSelect = (tmpl) => {
    const filled = fillTemplate(tmpl.body, vars);
    onSelect(filled);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="Message templates"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
        style={open
          ? { background: 'rgba(245,158,11,0.2)', color: 'hsl(38 92% 55%)' }
          : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }
        }
      >
        <Zap className="w-4 h-4" />
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-2 right-0 w-80 rounded-xl overflow-hidden z-50 shadow-2xl"
          style={{ background: 'hsl(222 47% 11%)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>Templates</span>
            <button
              onClick={() => { setOpen(false); setManageOpen(true); }}
              className="text-[11px] px-2 py-0.5 rounded border border-white/20 hover:bg-white/10 transition-colors"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              Manage
            </button>
          </div>

          {/* Body */}
          <div className="max-h-72 overflow-y-auto py-1">
            {activeTemplates.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-6">No templates yet.</div>
            ) : (
              CATEGORY_ORDER.map(cat => {
                const group = activeTemplates.filter(t => t.category === cat);
                if (!group.length) return null;
                const expanded = expandedCats[cat] !== false; // default open
                return (
                  <div key={cat}>
                    <button
                      onClick={() => toggleCat(cat)}
                      className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-white/05 transition-colors"
                    >
                      <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>{CATEGORY_LABELS[cat]}</span>
                      {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                    </button>
                    {expanded && group.map(t => (
                      <button
                        key={t.id}
                        onClick={() => handleSelect(t)}
                        className="w-full text-left px-4 py-2 hover:bg-white/08 transition-colors"
                      >
                        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{t.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{t.body.slice(0, 60)}…</p>
                      </button>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <TemplateModal open={manageOpen} onClose={() => setManageOpen(false)} />
    </div>
  );
}