import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Phone, Mail, MapPin, Building2, Hash, Paperclip,
  Plus, X, Save, Loader2, User, ChevronDown, ChevronUp, Edit3,
  Clock, Briefcase, Layers, MessageCircle, Video, Mic
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { format } from 'date-fns';
import { toast } from 'sonner';
import ContactRemindersSection from '@/components/contacts/ContactRemindersSection';
import QualificationScorecard from '@/components/contacts/QualificationScorecard';
import ViewingTracker from '@/components/contacts/ViewingTracker';
import PropertyLeadMatcher from '@/components/matching/PropertyLeadMatcher';
import WhatsAppPanel from '@/components/contacts/WhatsAppPanel';
import WhatsAppPopup from '@/components/whatsapp/WhatsAppPopup';
import VapiCallDialog from '@/components/vapi/VapiCallDialog';
import { usePhotoByPhone } from '@/lib/usePhotoByPhone';

const PROJECT_LAYERS = [
  { id: 'peninsula-three', label: 'Peninsula Three' },
  { id: 'jumeirah-living', label: 'Jumeirah Living' },
  { id: 'six-senses', label: 'Six Senses' },
  { id: 'peninsula-four', label: 'Peninsula Four' },
];

const STAGE_COLORS = {
  new_lead: 'bg-slate-100 text-slate-600',
  contacted: 'bg-blue-100 text-blue-600',
  viewing_scheduled: 'bg-indigo-100 text-indigo-600',
  viewing_done: 'bg-purple-100 text-purple-600',
  negotiation: 'bg-amber-100 text-amber-600',
  offer_made: 'bg-orange-100 text-orange-600',
  closed_won: 'bg-green-100 text-green-600',
  closed_lost: 'bg-red-100 text-red-600',
};

const PHONE_LABELS = ['mobile', 'whatsapp', 'work', 'home', 'other'];
const EMAIL_LABELS = ['personal', 'work', 'other'];
const STAGES = ['new_lead', 'contacted', 'viewing_scheduled', 'viewing_done', 'negotiation', 'offer_made', 'closed_won', 'closed_lost'];

const PHONE_COLORS = {
  mobile: 'bg-blue-50 text-blue-600 border-blue-200',
  whatsapp: 'bg-green-50 text-green-600 border-green-200',
  work: 'bg-purple-50 text-purple-600 border-purple-200',
  home: 'bg-orange-50 text-orange-600 border-orange-200',
  other: 'bg-gray-50 text-gray-500 border-gray-200',
};

// ── Inline editable field ────────────────────────────────────────────────────
function InlineField({ label, value, onChange, placeholder = '—', type = 'text', disabled = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  useEffect(() => { setDraft(value || ''); }, [value]);

  const commit = () => { onChange(draft); setEditing(false); };

  if (editing && !disabled) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          autoFocus
          type={type}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          className="h-7 text-xs px-2 flex-1"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => !disabled && setEditing(true)}
      className={`text-left text-sm w-full rounded px-1 -ml-1 py-0.5 transition-colors ${
        disabled ? 'cursor-default' : 'hover:bg-indigo-50 cursor-text'
      } ${value ? 'text-[#111827]' : 'text-[#9CA3AF] italic'}`}
    >
      {value || placeholder}
    </button>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[#F3F4F6] last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-[#FAFAFA] transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-[#374151] uppercase tracking-wider">
          {Icon && <Icon className="w-3.5 h-3.5 text-[#9CA3AF]" />}
          {title}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-[#9CA3AF]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF]" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ContactDetailPanel({ contactId, onClose }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(null);
  const [newTag, setNewTag] = useState('');
  const [newCustomKey, setNewCustomKey] = useState('');
  const [newCustomVal, setNewCustomVal] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [showWhatsAppPopup, setShowWhatsAppPopup] = useState(false);

  const { getPhotoForPhone } = usePhotoByPhone();
  const contactPhotoUrl = getPhotoForPhone(primaryPhone);

  const primaryPhone = draft?.phones?.[0]?.number || draft?.phone;

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: async () => {
      const results = await base44.entities.Lead.filter({ id: contactId }, '-created_date', 1);
      return results?.[0] || null;
    },
    enabled: !!contactId,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities', contactId],
    queryFn: () => base44.entities.Activity.filter({ lead_id: contactId }, '-created_date', 10),
    enabled: !!contactId,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['team-users'],
    queryFn: () => base44.entities.User.list('full_name', 200),
    staleTime: 120_000,
  });

  useEffect(() => {
    if (contact) { setDraft({ ...contact }); setIsDirty(false); }
  }, [contact]);

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.update(contactId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsDirty(false);
      toast.success('Contact saved');
    },
  });

  if (!contactId) return null;

  if (isLoading || !draft) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
      </div>
    );
  }

  const set = (field, value) => { setDraft(d => ({ ...d, [field]: value })); setIsDirty(true); };
  const setNested = (parent, field, value) => {
    setDraft(d => ({ ...d, [parent]: { ...(d[parent] || {}), [field]: value } }));
    setIsDirty(true);
  };

  const phones = draft.phones?.length
    ? draft.phones
    : (draft.phone ? [{ label: 'mobile', number: draft.phone, is_primary: true }] : []);

  const emails = draft.emails?.length
    ? draft.emails
    : (draft.email ? [{ label: 'personal', address: draft.email, is_primary: true }] : []);

  const addPhone = () => {
    set('phones', [...phones, { label: 'mobile', number: '', is_primary: false }]);
  };

  const updatePhone = (i, field, value) => {
    const updated = phones.map((p, idx) => idx === i ? { ...p, [field]: value } : p);
    set('phones', updated);
  };

  const removePhone = (i) => set('phones', phones.filter((_, idx) => idx !== i));

  const addEmail = () => {
    set('emails', [...emails, { label: 'personal', address: '', is_primary: false }]);
  };

  const updateEmail = (i, field, value) => {
    const updated = emails.map((e, idx) => idx === i ? { ...e, [field]: value } : e);
    set('emails', updated);
  };

  const removeEmail = (i) => set('emails', emails.filter((_, idx) => idx !== i));

  const addTag = () => {
    if (!newTag.trim()) return;
    set('tags', [...(draft.tags || []), newTag.trim()]);
    setNewTag('');
  };

  const removeTag = (tag) => set('tags', (draft.tags || []).filter(t => t !== tag));

  const addCustomField = () => {
    if (!newCustomKey.trim()) return;
    set('custom_fields', [...(draft.custom_fields || []), { key: newCustomKey.trim(), value: newCustomVal.trim(), type: 'text' }]);
    setNewCustomKey(''); setNewCustomVal('');
  };

  const removeCustomField = (i) => set('custom_fields', draft.custom_fields.filter((_, idx) => idx !== i));

  const hue = draft.name ? (draft.name.charCodeAt(0) * 7) % 360 : 200;
  const initials = draft.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-full bg-white overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-[#F3F4F6]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {contactPhotoUrl ? (
              <img src={contactPhotoUrl} alt="" className="w-12 h-12 rounded-2xl object-cover border border-white/20" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
            ) : null}
            <div
              className={cn('w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0', contactPhotoUrl ? 'hidden' : 'flex')}
              style={{ background: `hsl(${hue}, 60%, 55%)` }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <input
                value={draft.name || ''}
                onChange={e => set('name', e.target.value)}
                className="text-base font-bold text-[#111827] bg-transparent border-0 outline-none w-full focus:bg-indigo-50 rounded px-1 -ml-1 transition-colors"
                placeholder="Full Name"
              />
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <select
                  value={draft.stage || 'new_lead'}
                  onChange={e => set('stage', e.target.value)}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border-0 cursor-pointer outline-none ${STAGE_COLORS[draft.stage] || 'bg-slate-100 text-slate-600'}`}
                >
                  {STAGES.map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                {draft.relationship_type && (
                  <span className="text-[10px] text-[#9CA3AF] capitalize">{draft.relationship_type.replace(/_/g, ' ')}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isDirty && (
              <Button
                size="sm"
                onClick={() => saveMutation.mutate(draft)}
                disabled={saveMutation.isPending}
                className="h-7 text-xs px-3 bg-indigo-500 hover:bg-indigo-600 text-white gap-1"
              >
                {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save
              </Button>
            )}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1">
              <VapiCallDialog lead={draft} />
              <Button
                size="icon"
                variant="ghost"
                className="w-8 h-8 text-green-500 hover:bg-green-50"
                onClick={() => setShowWhatsAppPopup(true)}
                disabled={!primaryPhone}
                title="Open WhatsApp Chat"
              >
                <MessageCircle className="w-4 h-4" />
              </Button>
            </div>
              <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#374151] p-1 rounded-lg hover:bg-[#F3F4F6] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* WhatsApp Popup */}
        <WhatsAppPopup
          isOpen={showWhatsAppPopup}
          onClose={() => setShowWhatsAppPopup(false)}
          phone={primaryPhone}
          leadId={contactId}
          leadName={draft?.name}
        />
      </div>

      {/* ── Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Phones */}
        <Section title="Phone Numbers" icon={Phone}>
          <div className="space-y-2">
            {phones.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={p.label}
                  onChange={e => updatePhone(i, 'label', e.target.value)}
                  className={`text-[10px] font-semibold px-2 py-1 rounded-full border cursor-pointer outline-none ${PHONE_COLORS[p.label] || PHONE_COLORS.other}`}
                >
                  {PHONE_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <Input
                  value={p.number}
                  onChange={e => updatePhone(i, 'number', e.target.value)}
                  placeholder="+971 50 000 0000"
                  className="h-7 text-xs font-mono flex-1"
                />
                {p.is_primary && <span className="text-[9px] text-[#9CA3AF] shrink-0">primary</span>}
                <button onClick={() => removePhone(i)} className="text-[#9CA3AF] hover:text-red-400 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              onClick={addPhone}
              className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-600 font-medium mt-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add phone number
            </button>
          </div>
        </Section>

        {/* Emails */}
        <Section title="Email Addresses" icon={Mail}>
          <div className="space-y-2">
            {emails.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={e.label}
                  onChange={ev => updateEmail(i, 'label', ev.target.value)}
                  className="text-[10px] font-semibold px-2 py-1 rounded-full border bg-purple-50 text-purple-600 border-purple-200 cursor-pointer outline-none"
                >
                  {EMAIL_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <Input
                  value={e.address}
                  onChange={ev => updateEmail(i, 'address', ev.target.value)}
                  placeholder="email@example.com"
                  className="h-7 text-xs flex-1"
                />
                <button onClick={() => removeEmail(i)} className="text-[#9CA3AF] hover:text-red-400 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              onClick={addEmail}
              className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-600 font-medium mt-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add email
            </button>
          </div>
        </Section>

        {/* Assigned Agent */}
        <Section title="Assigned Agent" icon={User}>
          <Select
            value={draft.assigned_agent_email || ''}
            onValueChange={(v) => {
              const u = users.find(u => u.email === v);
              set('assigned_agent_email', v);
              if (u) set('assigned_agent_name', u.full_name || v);
            }}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="— Unassigned —" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>— Unassigned —</SelectItem>
              {users.map(u => (
                <SelectItem key={u.id} value={u.email}>{u.full_name || u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Section>

        {/* Project Layer */}
         <Section title="Project Layer" icon={Layers}>
           <Select value={draft.project_layer || ''} onValueChange={v => set('project_layer', v)}>
             <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select project layer..." /></SelectTrigger>
             <SelectContent>
               {PROJECT_LAYERS.map(layer => (
                 <SelectItem key={layer.id} value={layer.id}>{layer.label}</SelectItem>
               ))}
             </SelectContent>
           </Select>
         </Section>

         {/* Building / Property */}
         <Section title="Building & Property" icon={Building2}>
           <div className="grid grid-cols-2 gap-x-4 gap-y-3">
             {[
               { label: 'Tower / Project', field: 'tower' },
               { label: 'Unit Number', field: 'unit_number' },
               { label: 'Floor', field: 'floor' },
               { label: 'Company', field: 'name' },
               { label: 'Role / Title', field: 'role' },
             ].map(({ label, field }) => (
               <div key={field}>
                 <p className="text-[10px] text-[#9CA3AF] mb-0.5 font-medium">{label}</p>
                 <InlineField
                   value={draft.organization?.[field]}
                   onChange={v => setNested('organization', field, v)}
                   placeholder="—"
                 />
               </div>
             ))}
           </div>
         </Section>

        {/* Location */}
        <Section title="Location" icon={MapPin} defaultOpen={false}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {[
              { label: 'Address', field: 'address' },
              { label: 'City', field: 'city' },
              { label: 'Country', field: 'country' },
            ].map(({ label, field }) => (
              <div key={field}>
                <p className="text-[10px] text-[#9CA3AF] mb-0.5 font-medium">{label}</p>
                <InlineField
                  value={draft.location?.[field]}
                  onChange={v => setNested('location', field, v)}
                  placeholder="—"
                />
              </div>
            ))}
          </div>
        </Section>

        {/* Profile */}
        <Section title="Profile" icon={User} defaultOpen={false}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {[
              { label: 'Nationality', field: 'nationality' },
              { label: 'Language', field: 'language' },
              { label: 'Timezone', field: 'timezone' },
            ].map(({ label, field }) => (
              <div key={field}>
                <p className="text-[10px] text-[#9CA3AF] mb-0.5 font-medium">{label}</p>
                <InlineField
                  value={draft[field]}
                  onChange={v => set(field, v)}
                  placeholder="—"
                />
              </div>
            ))}
          </div>
        </Section>

        {/* Tags */}
        <Section title="Tags" icon={Hash}>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(draft.tags || []).map(tag => (
              <span
                key={tag}
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 font-medium"
              >
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-red-400 transition-colors">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            {(!draft.tags || draft.tags.length === 0) && (
              <span className="text-xs text-[#9CA3AF] italic">No tags yet</span>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="Type tag + Enter"
              className="h-7 text-xs flex-1"
            />
            <Button size="sm" variant="outline" onClick={addTag} className="h-7 text-xs px-2">
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </Section>

        {/* Notes */}
        <Section title="Notes" icon={Edit3}>
          <Textarea
            value={draft.notes || ''}
            onChange={e => set('notes', e.target.value)}
            placeholder="Add notes about this contact…"
            className="min-h-[80px] text-xs resize-none"
          />
        </Section>

        {/* Custom Fields */}
        <Section title="Custom Fields" icon={Briefcase} defaultOpen={false}>
          <div className="space-y-2 mb-2">
            {(draft.custom_fields || []).map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-[#9CA3AF] w-28 shrink-0 font-medium">{f.key}</span>
                <Input
                  value={f.value}
                  onChange={e => {
                    const updated = [...draft.custom_fields];
                    updated[i] = { ...updated[i], value: e.target.value };
                    set('custom_fields', updated);
                  }}
                  className="h-7 text-xs flex-1"
                />
                <button onClick={() => removeCustomField(i)} className="text-[#9CA3AF] hover:text-red-400 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {(!draft.custom_fields || draft.custom_fields.length === 0) && (
              <p className="text-xs text-[#9CA3AF] italic">No custom fields</p>
            )}
          </div>
          <div className="flex gap-2 pt-1 border-t border-[#F3F4F6]">
            <Input value={newCustomKey} onChange={e => setNewCustomKey(e.target.value)} placeholder="Field name" className="h-7 text-xs" />
            <Input value={newCustomVal} onChange={e => setNewCustomVal(e.target.value)} placeholder="Value" className="h-7 text-xs" />
            <Button size="sm" variant="outline" onClick={addCustomField} className="h-7 px-2 shrink-0">
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </Section>

        {/* Property Matching */}
        <PropertyLeadMatcher mode="lead" entityId={contactId} entityData={draft} />

        {/* Qualification Scorecard */}
        <QualificationScorecard contactId={contactId} lead={draft} />

        {/* Viewing Tracker */}
        <ViewingTracker contactId={contactId} contactName={draft.name} />

        {/* WhatsApp */}
        <div className="border-b border-[#F3F4F6]">
          <div className="px-5 py-3 hover:bg-[#FAFAFA] transition-colors">
            <span className="flex items-center gap-2 text-xs font-semibold text-[#374151] uppercase tracking-wider">
              <MessageCircle className="w-3.5 h-3.5 text-[#9CA3AF]" />
              WhatsApp Chat
            </span>
          </div>
          <div className="px-5 pb-4">
            <WhatsAppPanel lead={draft} />
          </div>
        </div>

        {/* Reminders */}
        <ContactRemindersSection contactId={contactId} contactName={draft.name} />

        {/* Activity Log */}
        <Section title="Activity Log" icon={Clock} defaultOpen={false}>
          <div className="space-y-2">
            <div className="flex gap-2 items-center text-xs text-[#9CA3AF]">
              <span className="shrink-0">Added:</span>
              <span className="text-[#374151]">{format(new Date(contact.created_date), 'MMM dd, yyyy')}</span>
            </div>
            {contact.last_contact_date && (
              <div className="flex gap-2 items-center text-xs text-[#9CA3AF]">
                <span className="shrink-0">Last contact:</span>
                <span className="text-[#374151]">{format(new Date(contact.last_contact_date), 'MMM dd, yyyy')}</span>
              </div>
            )}
            {activities.length > 0 && (
              <div className="space-y-1.5 mt-2 max-h-40 overflow-y-auto pr-1">
                {activities.map(a => (
                  <div key={a.id} className="flex items-start gap-2 p-2 rounded-lg bg-[#FAFAFA] border border-[#F3F4F6]">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#374151] truncate">{a.title}</p>
                      <p className="text-[10px] text-[#9CA3AF]">{format(new Date(a.created_date), 'MMM dd, HH:mm')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* Attachments */}
        {contact.attachments?.length > 0 && (
          <Section title="Attachments" icon={Paperclip} defaultOpen={false}>
            <div className="space-y-1.5">
              {contact.attachments.map((a, i) => (
                <a
                  key={i}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-indigo-500 hover:text-indigo-600 hover:underline"
                >
                  <Paperclip className="w-3 h-3" /> {a.name}
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* Bottom padding */}
        <div className="h-6" />
      </div>

      {/* ── Save Bar (sticky) ── */}
      <AnimatePresence>
        {isDirty && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="flex-shrink-0 px-5 py-3 bg-white border-t border-[#E5E7EB] flex items-center justify-between"
          >
            <span className="text-xs text-[#9CA3AF]">Unsaved changes</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setDraft({ ...contact }); setIsDirty(false); }}
                className="h-7 text-xs"
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={() => saveMutation.mutate(draft)}
                disabled={saveMutation.isPending}
                className="h-7 text-xs bg-indigo-500 hover:bg-indigo-600 text-white gap-1"
              >
                {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save Changes
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}