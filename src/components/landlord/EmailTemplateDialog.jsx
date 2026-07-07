// EmailTemplateDialog — create / edit / delete email templates with access control.
// Props:
//   open (bool)        — dialog visibility
//   onClose (fn)       — close handler
//   template (obj|null)— existing template to edit, or null to create new
//   onSaved (fn)       — called after create/update/delete with the result

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { X, Trash2, Save, Globe, Lock, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import TemplateField from '@/components/common/TemplateField';

const CATEGORY_OPTS = [
  ['general', 'General'],
  ['initial_contact', 'Initial Contact'],
  ['price_discovery', 'Price Discovery'],
  ['listing_commitment', 'Listing Commitment'],
  ['form_a', 'Form A'],
  ['viewing', 'Viewing'],
  ['follow_up_general', 'Follow Up'],
  ['renewal', 'Renewal'],
];

const VIS_OPTS = [
  { key: 'private', label: 'Private', icon: Lock, hint: 'Only you can see this template' },
  { key: 'shared', label: 'Everyone', icon: Globe, hint: 'All agents can see this template' },
  { key: 'specific_agents', label: 'Specific agents', icon: Users, hint: 'Only the agents you choose can see this' },
];

const fieldStyle = {
  padding: '8px 11px', borderRadius: 8,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
  color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: "'Inter',sans-serif",
  width: '100%', outline: 'none',
};

const labelStyle = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.45)', marginBottom: 5, display: 'block',
};

export default function EmailTemplateDialog({ open, onClose, template, onSaved, channel = 'email' }) {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: '', subject: '', body: '', category: 'general',
    visibility: 'private', shared_with_agents: [],
  });
  const [agentEmailInput, setAgentEmailInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEdit = !!template?.id;

  useEffect(() => {
    if (template) {
      setForm({
        title: template.title || '',
        subject: template.subject || '',
        body: template.body || '',
        category: template.category || 'general',
        visibility: template.visibility || 'private',
        shared_with_agents: Array.isArray(template.shared_with_agents) ? template.shared_with_agents : [],
      });
    } else {
      setForm({ title: '', subject: '', body: '', category: 'general', visibility: 'private', shared_with_agents: [] });
    }
    setAgentEmailInput('');
  }, [template, open]);

  // Fetch assignable agents for the specific_agents picker
  const { data: agents = [] } = useQuery({
    queryKey: ['assignableAgents'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAssignableAgents', {});
      return res?.data?.agents || res?.agents || [];
    },
    enabled: open && form.visibility === 'specific_agents',
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addAgentEmail = (email) => {
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    if (form.shared_with_agents.includes(clean)) return;
    set('shared_with_agents', [...form.shared_with_agents, clean]);
    setAgentEmailInput('');
  };

  const removeAgentEmail = (email) => {
    set('shared_with_agents', form.shared_with_agents.filter((e) => e !== email));
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Template name is required'); return; }
    if (!form.body.trim()) { toast.error('Template body is required'); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        subject: form.subject.trim(),
        body: form.body.trim(),
        category: form.category,
        channel: channel,
        visibility: form.visibility,
        shared_with_agents: form.visibility === 'specific_agents' ? form.shared_with_agents : [],
        is_active: true,
        created_by_email: user?.email || '',
        created_by_name: user?.full_name || user?.email || '',
      };
      // Extract variables from body
      const vars = [...new Set([...form.body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
      if (vars.length) payload.variables = vars;

      let result;
      if (isEdit) {
        result = await base44.entities.MessageTemplate.update(template.id, payload);
        toast.success('Template updated');
      } else {
        result = await base44.entities.MessageTemplate.create(payload);
        toast.success('Template created');
      }
      qc.invalidateQueries({ queryKey: ['emailTemplates'] });
      qc.invalidateQueries({ queryKey: ['messageTemplates'] });
      if (onSaved) onSaved(result);
      onClose();
    } catch (e) {
      toast.error(e?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit) return;
    if (!confirm('Delete this template? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await base44.entities.MessageTemplate.delete(template.id);
      qc.invalidateQueries({ queryKey: ['emailTemplates'] });
      qc.invalidateQueries({ queryKey: ['messageTemplates'] });
      toast.success('Template deleted');
      if (onSaved) onSaved({ deleted: true, id: template.id });
      onClose();
    } catch (e) {
      toast.error(e?.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 92vw)', maxHeight: '88vh', overflowY: 'auto',
          borderRadius: 16, background: 'linear-gradient(135deg, rgba(201,162,75,0.06), rgba(11,31,58,0.98))',
          border: '1px solid rgba(201,162,75,0.25)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
          padding: 20,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond','Playfair Display',serif", fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,0.95)' }}>
            {isEdit ? 'Edit Template' : channel === 'imessage' ? 'New iMessage Template' : 'New Email Template'}
          </h3>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}>
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Template Name</label>
            <TemplateField multiline={false} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Asset Proof Intro" style={fieldStyle} autoFocus />
          </div>

          {channel !== 'imessage' && (
            <div>
              <label style={labelStyle}>Subject</label>
              <TemplateField multiline={false} value={form.subject} onChange={(e) => set('subject', e.target.value)} placeholder="Email subject line" style={fieldStyle} />
            </div>
          )}

          <div>
            <label style={labelStyle}>Category</label>
            <select value={form.category} onChange={(e) => set('category', e.target.value)} style={{ ...fieldStyle, cursor: 'pointer', appearance: 'auto' }}>
              {CATEGORY_OPTS.map(([v, l]) => <option key={v} value={v} style={{ background: '#1a2235', color: '#fff' }}>{l}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Body <span style={{ textTransform: 'none', fontWeight: 400, color: 'rgba(255,255,255,0.35)' }}>— use {'{{landlord_name}}, {{property_name}}, {{agent_name}}'}</span></label>
            <TemplateField multiline value={form.body} onChange={(e) => set('body', e.target.value)} rows={6} placeholder={channel === 'imessage' ? 'Write your iMessage body…' : 'Write your email body…'} style={{ ...fieldStyle, resize: 'vertical', minHeight: 120, lineHeight: 1.5 }} />
          </div>

          {/* Access control */}
          <div>
            <label style={labelStyle}>Who can see this template?</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {VIS_OPTS.map((opt) => {
                const on = form.visibility === opt.key;
                const Icon = opt.icon;
                return (
                  <button key={opt.key} onClick={() => set('visibility', opt.key)} title={opt.hint}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      fontFamily: "'Inter',sans-serif",
                      background: on ? 'hsl(38 92% 50% / 0.18)' : 'rgba(255,255,255,0.04)',
                      color: on ? 'hsl(38 92% 64%)' : 'rgba(255,255,255,0.6)',
                      border: '1px solid ' + (on ? 'hsl(38 92% 50% / 0.5)' : 'rgba(255,255,255,0.1)'),
                    }}>
                    <Icon size={13} /> {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Specific agents picker */}
          {form.visibility === 'specific_agents' && (
            <div>
              <label style={labelStyle}>Share with specific agents</label>
              {/* Existing chips */}
              {form.shared_with_agents.length > 0 && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                  {form.shared_with_agents.map((email) => (
                    <span key={email} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: 'rgba(201,162,75,0.12)', border: '1px solid rgba(201,162,75,0.3)', color: 'rgba(255,255,255,0.8)' }}>
                      {email}
                      <button onClick={() => removeAgentEmail(email)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: 0, display: 'flex' }}><X size={10} /></button>
                    </span>
                  ))}
                </div>
              )}
              {/* Quick-pick from agent list */}
              {agents.length > 0 && (
                <div style={{ marginBottom: 8, maxHeight: 100, overflowY: 'auto', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                  {agents
                    .filter((a) => a.email && a.email !== user?.email && !form.shared_with_agents.includes(a.email.toLowerCase()))
                    .map((a) => (
                      <button key={a.email} onClick={() => addAgentEmail(a.email)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 10px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{a.full_name || a.email}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{a.email}</span>
                      </button>
                    ))}
                </div>
              )}
              {/* Manual email entry */}
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={agentEmailInput} onChange={(e) => setAgentEmailInput(e.target.value)} placeholder="agent@email.com" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAgentEmail(agentEmailInput); } }} style={{ ...fieldStyle, flex: 1 }} />
                <button onClick={() => addAgentEmail(agentEmailInput)} disabled={!agentEmailInput.trim()} style={{ padding: '0 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'hsl(38 92% 50% / 0.18)', border: '1px solid hsl(38 92% 50% / 0.4)', color: 'hsl(38 92% 64%)', fontFamily: "'Inter',sans-serif", opacity: agentEmailInput.trim() ? 1 : 0.5 }}>Add</button>
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            {isEdit && (
              <button onClick={handleDelete} disabled={deleting}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontFamily: "'Inter',sans-serif" }}>
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', fontFamily: "'Inter',sans-serif" }}>Cancel</button>
            <button onClick={handleSave} disabled={saving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%))', border: '1px solid hsl(38 92% 50% / 0.5)', color: '#1a1205', fontFamily: "'Inter',sans-serif", opacity: saving ? 0.7 : 1 }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} {isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}