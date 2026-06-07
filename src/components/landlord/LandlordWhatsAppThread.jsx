import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  Send, Loader2, MessageSquare, Clock, Zap, Sparkles, Paperclip,
  Check, CheckCheck, CalendarPlus, StickyNote, ChevronDown, X,
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const STAGE_LABELS = {
  initial_contact: 'Initial Contact',
  price_discovery: 'Price Discovery',
  listing_commitment: 'Listing Commitment',
  form_a_initiation: 'Form A Initiation',
  form_a_signing: 'Form A Signing',
  owner_documents: 'Owner Documents',
  photos_videos: 'Photos / Videos',
  photographer_scheduling: 'Photographer Scheduling',
  listing_creation: 'Listing Creation',
  internal_verification: 'Internal Verification',
  listing_publication: 'Listing Publication',
  final_confirmation: 'Final Confirmation',
};

const STAGE_OPTIONS = Object.keys(STAGE_LABELS);

const TEMPLATE_CATEGORIES = [
  { key: 'initial_contact', label: 'Initial Contact' },
  { key: 'price_discovery', label: 'Price Discovery' },
  { key: 'listing_commitment', label: 'Listing Commitment' },
  { key: 'form_a_initiation', label: 'Form A Initiation' },
  { key: 'viewing_coordination', label: 'Viewing Coordination' },
  { key: 'general_followup', label: 'General Follow-Up' },
];

const STARTER_TEMPLATES = [
  {
    title: 'Warm Introduction',
    category: 'initial_contact',
    body: `Hi {{landlord_name}} 👋 I'm {{agent_name}} from Erudite Property Real Estate. I came across your property at {{project_name}} and would love to discuss how we can get you the best value for your unit. When would be a good time to connect?`,
    sort_order: 1,
  },
  {
    title: 'Market Pricing Discussion',
    category: 'price_discovery',
    body: `Hello {{landlord_name}}, based on our current market analysis for {{project_name}}, comparable units are transacting between AED [X]M–[Y]M. I'd love to walk you through the data and align on a competitive asking price for your unit. Can we schedule a quick call?`,
    sort_order: 1,
  },
  {
    title: 'Exclusive Mandate Proposal',
    category: 'listing_commitment',
    body: `Hi {{landlord_name}}, following our conversation, I'd like to formally propose an exclusive mandate for {{unit_number}} at {{project_name}}. An exclusive gives us the leverage to negotiate aggressively on your behalf and protect your price. I'll send across our proposal — happy to walk through it together.`,
    sort_order: 1,
  },
  {
    title: 'Form A Ready to Sign',
    category: 'form_a_initiation',
    body: `Hi {{landlord_name}}, great news — I've prepared the Form A for {{property_name}}. It's a straightforward listing authorization that legally protects your interests. I'll send it over via DocuSign shortly. Just a quick digital signature and we're all set to market your unit! 🏠`,
    sort_order: 1,
  },
  {
    title: 'Viewing Appointment Confirmation',
    category: 'viewing_coordination',
    body: `Hi {{landlord_name}}, I've scheduled a viewing of your unit at {{project_name}} for [Date/Time]. Could you please ensure access is arranged? If the unit is tenanted, kindly notify the tenant 24 hours ahead. I'll keep you updated on buyer feedback right after. 🔑`,
    sort_order: 1,
  },
  {
    title: 'Friendly Follow-Up',
    category: 'general_followup',
    body: `Hi {{landlord_name}}, just checking in on your end — hope all is well! I wanted to share a quick update on the activity for {{project_name}} and see if you had any questions. Always here to help. Have a wonderful day! 😊`,
    sort_order: 1,
  },
];

function fillPlaceholders(body, landlord) {
  const name = landlord?.full_name_en || landlord?.full_name || '';
  const firstName = name.split(' ')[0] || name;
  return body
    .replace(/{{landlord_name}}/g, firstName)
    .replace(/{{property_name}}/g, landlord?.project_name || landlord?.unit_reference || '')
    .replace(/{{unit_number}}/g, landlord?.unit_reference || '')
    .replace(/{{project_name}}/g, landlord?.project_name || '')
    .replace(/{{agent_name}}/g, 'Ahmad Badreddine');
}

function StatusTick({ status, isOutgoing }) {
  if (!isOutgoing || !status) return null;
  if (status === 'read') return <CheckCheck className="w-3.5 h-3.5 inline ml-1" style={{ color: '#C9A24B' }} />;
  if (status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 inline ml-1 text-white/50" />;
  return <Check className="w-3.5 h-3.5 inline ml-1 text-white/40" />;
}

// ── Template Manager Modal ────────────────────────────────────────────────────
function TemplateManagerModal({ open, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', body: '', category: 'initial_contact', sort_order: 0, is_active: true });
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ['message-templates'],
    queryFn: () => base44.entities.MessageTemplate.list('sort_order', 200),
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editId
      ? base44.entities.MessageTemplate.update(editId, data)
      : base44.entities.MessageTemplate.create({ ...data, variables: [] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['message-templates'] });
      setShowForm(false);
      setEditId(null);
      setForm({ title: '', body: '', category: 'initial_contact', sort_order: 0, is_active: true });
      toast.success(editId ? 'Template updated' : 'Template created');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.MessageTemplate.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['message-templates'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MessageTemplate.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['message-templates'] }),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-2xl w-full max-w-xl max-h-[80vh] flex flex-col" style={{ background: '#0F1419', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="font-semibold text-base" style={{ color: '#C9A24B' }}>Manage Templates</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground hover:text-white" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {templates.map(t => (
            <div key={t.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{t.title}</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 border-amber-500/30 text-amber-400">
                      {TEMPLATE_CATEGORIES.find(c => c.key === t.category)?.label || t.category}
                    </Badge>
                    {!t.is_active && <Badge variant="outline" className="text-[9px] border-slate-500/30 text-slate-400">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{t.body}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => { setEditId(t.id); setForm({ title: t.title, body: t.body, category: t.category, sort_order: t.sort_order || 0, is_active: t.is_active !== false }); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-white/10">
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => toggleMutation.mutate({ id: t.id, is_active: !t.is_active })} className="p-1.5 rounded-lg hover:bg-white/10">
                    {t.is_active ? <ToggleRight className="w-3.5 h-3.5 text-emerald-400" /> : <ToggleLeft className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                  <button onClick={() => deleteMutation.mutate(t.id)} className="p-1.5 rounded-lg hover:bg-red-500/10">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {showForm && (
          <div className="border-t border-white/10 p-4 space-y-3">
            <p className="text-xs font-semibold" style={{ color: '#C9A24B' }}>{editId ? 'Edit Template' : 'New Template'}</p>
            <input
              placeholder="Title"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 text-xs rounded-lg"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
            />
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 text-xs rounded-lg"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
            >
              {TEMPLATE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <textarea
              placeholder="Message body… use {{landlord_name}}, {{property_name}}, {{unit_number}}, {{project_name}}, {{agent_name}}"
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 text-xs rounded-lg resize-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowForm(false); setEditId(null); }} className="text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/8" style={{ color: 'rgba(255,255,255,0.55)' }}>Cancel</button>
              <button
                onClick={() => saveMutation.mutate(form)}
                disabled={!form.title || !form.body || saveMutation.isPending}
                className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                style={{ background: '#C9A24B', color: '#0F1419', fontWeight: 600 }}
              >
                {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Save
              </button>
            </div>
          </div>
        )}

        <div className="px-4 py-3 border-t border-white/10 flex justify-between">
          <button
            onClick={() => { setEditId(null); setForm({ title: '', body: '', category: 'initial_contact', sort_order: 0, is_active: true }); setShowForm(true); }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/8"
            style={{ color: '#C9A24B' }}
          >
            <Plus className="w-3.5 h-3.5" /> New Template
          </button>
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/8" style={{ color: 'rgba(255,255,255,0.55)' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Log Note Modal ─────────────────────────────────────────────────────────────
function LogNoteModal({ open, onClose, landlordId }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!note.trim()) return;
    setSaving(true);
    await base44.entities.FollowUp.create({
      landlord_id: landlordId,
      type: 'task',
      scheduled_at: new Date().toISOString(),
      status: 'done',
      notes: note.trim(),
      created_source: 'manual',
    });
    setSaving(false);
    setNote('');
    onClose();
    toast.success('Note logged');
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-2xl w-full max-w-sm p-5 space-y-3" style={{ background: '#0F1419', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: '#C9A24B' }}>Log Note</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <textarea
          autoFocus
          placeholder="Quick note…"
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 text-sm rounded-lg resize-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg border border-white/20" style={{ color: 'rgba(255,255,255,0.55)' }}>Cancel</button>
          <button
            onClick={save}
            disabled={!note.trim() || saving}
            className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
            style={{ background: '#C9A24B', color: '#0F1419', fontWeight: 600 }}
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Schedule Follow-Up Mini Modal ──────────────────────────────────────────────
function ScheduleModal({ open, onClose, landlordId }) {
  const [dt, setDt] = useState('');
  const [notes, setNotes] = useState('');
  const [type, setType] = useState('callback');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!dt) return;
    setSaving(true);
    await base44.entities.FollowUp.create({
      landlord_id: landlordId,
      type,
      scheduled_at: new Date(dt).toISOString(),
      status: 'pending',
      notes: notes.trim() || null,
      created_source: 'manual',
    });
    setSaving(false);
    setDt('');
    setNotes('');
    onClose();
    toast.success('Follow-up scheduled');
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-2xl w-full max-w-sm p-5 space-y-3" style={{ background: '#0F1419', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: '#C9A24B' }}>Schedule Follow-Up</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
        >
          <option value="callback">Callback</option>
          <option value="appointment">Appointment</option>
          <option value="task">Task</option>
        </select>
        <input
          type="datetime-local"
          value={dt}
          onChange={e => setDt(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', colorScheme: 'dark' }}
        />
        <textarea
          placeholder="Notes (optional)…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm rounded-lg resize-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg border border-white/20" style={{ color: 'rgba(255,255,255,0.55)' }}>Cancel</button>
          <button
            onClick={save}
            disabled={!dt || saving}
            className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
            style={{ background: '#C9A24B', color: '#0F1419', fontWeight: 600 }}
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Update Stage Mini Modal ────────────────────────────────────────────────────
function UpdateStageModal({ open, onClose, landlord }) {
  const qc = useQueryClient();
  const [stage, setStage] = useState(landlord?.stage || 'initial_contact');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await base44.entities.Landlord.update(landlord.id, { stage });
    qc.invalidateQueries({ queryKey: ['landlords'] });
    setSaving(false);
    onClose();
    toast.success(`Stage updated to ${STAGE_LABELS[stage] || stage}`);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-2xl w-full max-w-xs p-5 space-y-3" style={{ background: '#0F1419', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: '#C9A24B' }}>Update Stage</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <select
          value={stage}
          onChange={e => setStage(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
        >
          {STAGE_OPTIONS.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg border border-white/20" style={{ color: 'rgba(255,255,255,0.55)' }}>Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
            style={{ background: '#C9A24B', color: '#0F1419', fontWeight: 600 }}
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Update
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Template Popover ───────────────────────────────────────────────────────────
function TemplatePopover({ landlord, onSelect, onManage }) {
  const [open, setOpen] = useState(false);
  const [seedDone, setSeedDone] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ['message-templates'],
    queryFn: async () => {
      const all = await base44.entities.MessageTemplate.list('sort_order', 200);
      // Auto-seed if empty
      if (all.length === 0 && !seedDone) {
        setSeedDone(true);
        for (const t of STARTER_TEMPLATES) {
          await base44.entities.MessageTemplate.create({ ...t, variables: [], is_active: true });
        }
        return base44.entities.MessageTemplate.list('sort_order', 200);
      }
      return all;
    },
  });

  const active = templates.filter(t => t.is_active !== false);

  const grouped = TEMPLATE_CATEGORIES.map(cat => ({
    ...cat,
    items: active.filter(t => t.category === cat.key),
  })).filter(g => g.items.length > 0);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 px-2.5 py-2 rounded-lg transition-colors hover:bg-white/10"
        style={{ color: '#C9A24B' }}
        title="Templates"
      >
        <Zap className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(false)} className="flex items-center gap-1 px-2.5 py-2 rounded-lg" style={{ color: '#C9A24B', background: 'rgba(201,162,75,0.15)' }}>
        <Zap className="w-4 h-4" />
      </button>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      <div className="absolute bottom-12 left-0 z-50 w-80 rounded-2xl overflow-hidden" style={{ background: '#1A2230', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: '#C9A24B' }}>⚡ Message Templates</span>
          <button
            onClick={() => { setOpen(false); onManage(); }}
            className="text-[10px] px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            Manage
          </button>
        </div>
        <div className="overflow-y-auto max-h-72 p-2 space-y-1">
          {grouped.map(group => (
            <div key={group.key}>
              <p className="text-[9px] font-semibold uppercase tracking-wider px-2 py-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{group.label}</p>
              {group.items.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onSelect(fillPlaceholders(t.body, landlord));
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl transition-colors hover:bg-white/8 space-y-0.5"
                >
                  <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>{t.title}</p>
                  <p className="text-[10px] line-clamp-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{t.body.slice(0, 80)}…</p>
                </button>
              ))}
            </div>
          ))}
          {grouped.length === 0 && <p className="text-xs text-center text-muted-foreground py-4">No templates yet</p>}
        </div>
      </div>
    </div>
  );
}

// ── Main Thread ────────────────────────────────────────────────────────────────
export default function LandlordWhatsAppThread({ landlord }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [showStage, setShowStage] = useState(false);
  const fileRef = useRef(null);
  const [mediaUploading, setMediaUploading] = useState(false);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['landlord-messages', landlord?.id],
    queryFn: () => base44.entities.Message.filter({ landlord_id: landlord.id }, 'timestamp', 500),
    enabled: !!landlord?.id,
    refetchInterval: 15000,
  });

  const sendMutation = useMutation({
    mutationFn: (msg) => base44.functions.invoke('sendEvolutionMessage', { landlord_id: landlord.id, text: msg }),
    onSuccess: (res) => {
      const data = res?.data ?? res;
      if (data?.error) { toast.error(`Send failed: ${data.error}${data.detail ? ' — ' + data.detail : ''}`); return; }
      setText('');
      qc.invalidateQueries({ queryKey: ['landlord-messages', landlord.id] });
      toast.success('Message sent');
    },
    onError: (e) => toast.error(`Send failed: ${e?.response?.data?.error || e?.message || 'Unknown'}`),
  });

  const stats = useMemo(() => {
    if (!messages.length) return null;
    const gaps = [];
    for (let i = 1; i < messages.length; i++) {
      const prev = messages[i - 1], curr = messages[i];
      if (prev.direction !== curr.direction && prev.timestamp && curr.timestamp) {
        const diff = new Date(curr.timestamp) - new Date(prev.timestamp);
        if (diff > 0 && diff < 86400000 * 3) gaps.push(diff);
      }
    }
    const avgMs = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
    let avgLabel = null;
    if (avgMs !== null) { const mins = Math.round(avgMs / 60000); avgLabel = mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`; }
    return { total: messages.length, avgLabel };
  }, [messages]);

  const fmt = (ts) => {
    try {
      if (!ts) return '';
      return format(new Date(ts), 'd MMM, HH:mm');
    } catch { return ts || ''; }
  };

  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    if (!landlord?.phone) { toast.error('This landlord has no phone number.'); return; }
    sendMutation.mutate(t);
  };

  const draftReply = async () => {
    if (draftLoading) return;
    setDraftLoading(true);
    const last15 = messages.slice(-15).map(m => `${m.direction === 'incoming' ? 'Landlord' : 'Agent'}: ${m.text}`).join('\n');
    const prompt = `You are Ahmad Badreddine, founder of Erudite Property Real Estate in Dubai. Draft a short, natural WhatsApp reply to this landlord conversation. Match the conversation's language (English/Arabic/Russian). Be warm, confident, and concise — 2 to 4 sentences max. Move the conversation toward the next pipeline step. Never sound like a bot.

Landlord: ${landlord.full_name_en || 'Unknown'}
Pipeline Stage: ${STAGE_LABELS[landlord.stage] || landlord.stage || 'Initial Contact'}
Property: ${landlord.project_name || ''} ${landlord.unit_reference || ''}

Recent conversation:
${last15}

Draft reply:`;
    try {
      const res = await base44.integrations.Core.InvokeLLM({ prompt });
      setText(typeof res === 'string' ? res : res?.result || res?.text || '');
    } catch (e) {
      toast.error('AI draft failed: ' + e.message);
    } finally {
      setDraftLoading(false);
    }
  };

  const handleMediaUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const isImage = file.type.startsWith('image/');
      const res = await base44.functions.invoke('sendEvolutionMedia', {
        landlord_id: landlord.id,
        file_url,
        file_name: file.name,
        media_type: isImage ? 'image' : 'document',
      });
      const data = res?.data ?? res;
      if (data?.error) { toast.error(`Media send failed: ${data.error}`); return; }
      qc.invalidateQueries({ queryKey: ['landlord-messages', landlord.id] });
      toast.success('Media sent');
    } catch (err) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setMediaUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col" style={{ height: '520px' }}>
      {/* Quick Actions Bar */}
      <div className="flex items-center gap-2 px-1 pb-2 mb-2 border-b border-white/10 flex-wrap">
        <button
          onClick={() => setShowSchedule(true)}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-colors hover:bg-white/10 border border-white/15"
          style={{ color: 'rgba(255,255,255,0.7)' }}
        >
          <CalendarPlus className="w-3.5 h-3.5" style={{ color: '#C9A24B' }} />
          Schedule Follow-Up
        </button>
        <button
          onClick={() => setShowStage(true)}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-colors hover:bg-white/10 border border-white/15"
          style={{ color: 'rgba(255,255,255,0.7)' }}
        >
          <ChevronDown className="w-3.5 h-3.5" style={{ color: '#C9A24B' }} />
          Update Stage
        </button>
        <button
          onClick={() => setShowNote(true)}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-colors hover:bg-white/10 border border-white/15"
          style={{ color: 'rgba(255,255,255,0.7)' }}
        >
          <StickyNote className="w-3.5 h-3.5" style={{ color: '#C9A24B' }} />
          Log Note
        </button>
        {stats && (
          <div className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <MessageSquare className="w-3 h-3" />
              <span className="font-semibold text-foreground">{stats.total}</span>
            </span>
            {stats.avgLabel && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="w-3 h-3" />
                avg <span className="font-semibold text-foreground">{stats.avgLabel}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Message Thread */}
      <div className="flex-1 overflow-y-auto space-y-2 px-1">
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-8">Loading conversation…</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">No messages yet.</div>
        ) : (
          messages.map((m) => {
            const out = m.direction === 'outgoing';
            return (
              <div key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${out ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                  style={{ background: out ? 'rgba(22,163,74,0.85)' : 'rgba(255,255,255,0.09)' }}>
                  <div className="whitespace-pre-wrap break-words">{m.text}</div>
                  <div className={`mt-1 text-[10px] flex items-center gap-0.5 ${out ? 'justify-end text-white/60' : 'text-muted-foreground'}`}>
                    {fmt(m.timestamp)}
                    <StatusTick status={m.status} isOutgoing={out} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Bar */}
      <form onSubmit={submit} className="flex items-center gap-1.5 pt-2 border-t border-white/10">
        {/* AI Draft */}
        <button
          type="button"
          onClick={draftReply}
          disabled={draftLoading || messages.length === 0}
          className="flex items-center gap-1 px-2.5 py-2 rounded-lg transition-colors hover:bg-white/10 disabled:opacity-40"
          style={{ color: '#a78bfa' }}
          title="AI Draft Reply"
        >
          {draftLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        </button>

        {/* Templates */}
        <TemplatePopover
          landlord={landlord}
          onSelect={(txt) => setText(txt)}
          onManage={() => setShowTemplateManager(true)}
        />

        {/* Media Upload */}
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleMediaUpload} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!landlord?.phone || mediaUploading}
          className="flex items-center px-2.5 py-2 rounded-lg transition-colors hover:bg-white/10 disabled:opacity-40"
          style={{ color: 'rgba(255,255,255,0.5)' }}
          title="Attach file"
        >
          {mediaUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        </button>

        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={landlord?.phone ? 'Type a WhatsApp reply…' : 'No phone number on file'}
          disabled={!landlord?.phone || sendMutation.isPending}
          className="flex-1 text-sm"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit(e); }}
        />
        <Button type="submit" disabled={!text.trim() || sendMutation.isPending} style={{ minWidth: 40, minHeight: 40 }}>
          {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>

      {/* Modals */}
      <TemplateManagerModal open={showTemplateManager} onClose={() => setShowTemplateManager(false)} />
      <ScheduleModal open={showSchedule} onClose={() => setShowSchedule(false)} landlordId={landlord?.id} />
      <LogNoteModal open={showNote} onClose={() => setShowNote(false)} landlordId={landlord?.id} />
      <UpdateStageModal open={showStage} onClose={() => setShowStage(false)} landlord={landlord} />
    </div>
  );
}