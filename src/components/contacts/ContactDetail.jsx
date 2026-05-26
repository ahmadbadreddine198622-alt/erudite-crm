import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, Plus, Phone, Mail, MapPin, Building2, Calendar, Globe, User, Paperclip, Edit2, Save, Hash, Languages, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import WhatsAppPanel from '@/components/contacts/WhatsAppPanel';
import WhatsAppPhone from '@/components/WhatsAppPhone';

const PHONE_LABEL_COLORS = {
  mobile: 'bg-blue-500/10 text-blue-600',
  whatsapp: 'bg-emerald-500/10 text-emerald-600',
  work: 'bg-purple-500/10 text-purple-600',
  home: 'bg-orange-500/10 text-orange-600',
  other: 'bg-gray-500/10 text-gray-600',
};

function Section({ title, icon: Icon, children }) {
  return (
    <div className="border rounded-xl p-4 bg-card space-y-3">
      <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function ContactDetail({ contactId, onClose }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [editedContact, setEditedContact] = useState(null);
  const [newCustomKey, setNewCustomKey] = useState('');
  const [newCustomVal, setNewCustomVal] = useState('');
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'whatsapp'

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => base44.entities.Lead.read(contactId),
  });

  const { data: history = [] } = useQuery({
    queryKey: ['contact-history', contactId],
    queryFn: () => base44.entities.ContactHistory.filter({ lead_id: contactId }, '-created_date', 20),
  });

  const updateMutation = useMutation({
    mutationFn: (updates) => base44.entities.Lead.update(contactId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
      setIsEditing(false);
      setEditedContact(null);
      toast.success('Contact updated');
    },
  });

  if (isLoading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (!contact) return <div className="text-center py-8 text-muted-foreground">Contact not found</div>;

  const c = editedContact || contact;
  const set = (field, value) => setEditedContact(prev => ({ ...(prev || contact), [field]: value }));
  const setNested = (parent, field, value) => setEditedContact(prev => ({
    ...(prev || contact),
    [parent]: { ...((prev || contact)[parent] || {}), [field]: value }
  }));

  const phones = c.phones?.length ? c.phones : (c.phone ? [{ label: 'mobile', number: c.phone, is_primary: true }] : []);
  const emails = c.emails?.length ? c.emails : (c.email ? [{ label: 'personal', address: c.email, is_primary: true }] : []);

  const addCustomField = () => {
    if (!newCustomKey.trim()) return;
    const updated = [...(c.custom_fields || []), { key: newCustomKey.trim(), value: newCustomVal.trim(), type: 'text' }];
    set('custom_fields', updated);
    setNewCustomKey(''); setNewCustomVal('');
  };

  const removeCustomField = (i) => set('custom_fields', c.custom_fields.filter((_, idx) => idx !== i));

  const addTag = () => {
    if (!newTag.trim()) return;
    set('tags', [...(c.tags || []), newTag.trim()]);
    setNewTag('');
  };

  const removeTag = (tag) => set('tags', c.tags.filter(t => t !== tag));

  return (
    <div className="flex flex-col h-full max-h-[85vh]">
      {/* Header */}
      <div className="flex flex-col border-b shrink-0">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center font-bold text-accent">
              {contact.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              {isEditing ? (
                <Input value={c.name} onChange={e => set('name', e.target.value)} className="h-7 text-base font-semibold w-48" />
              ) : (
                <h2 className="text-base font-semibold">{contact.name}</h2>
              )}
              <p className="text-xs text-muted-foreground capitalize">{contact.relationship_type?.replace(/_/g, ' ') || contact.type || 'Contact'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <Button size="sm" variant="outline" onClick={() => { setIsEditing(true); setEditedContact({ ...contact }); }} className="gap-1.5 h-8">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={() => updateMutation.mutate(editedContact)} disabled={updateMutation.isPending} className="gap-1.5 h-8 bg-accent hover:bg-accent/90 text-accent-foreground">
                  {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setIsEditing(false); setEditedContact(null); }} className="h-8">Cancel</Button>
              </>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-1"><X className="w-5 h-5" /></button>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 px-4 pb-0 border-t">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-accent text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'whatsapp'
                ? 'border-accent text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'details' ? (
          <div className="p-4 space-y-4">

        {/* Phones */}
        <Section title="Phone Numbers" icon={Phone}>
          <div className="space-y-2">
            {phones.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PHONE_LABEL_COLORS[p.label] || 'bg-gray-100 text-gray-600'}`}>{p.label}</span>
                {isEditing ? (
                  <Input value={p.number} onChange={e => {
                    const updated = [...(c.phones || phones)];
                    updated[i] = { ...updated[i], number: e.target.value };
                    set('phones', updated);
                  }} className="h-7 text-sm flex-1 font-mono" />
                ) : (
                  <WhatsAppPhone phone={p.number} name={contact.name} leadId={contactId} size="xs" doNotContact={c.do_not_contact} />
                )}
                {p.is_primary && <span className="text-[10px] text-muted-foreground">primary</span>}
              </div>
            ))}
            {isEditing && (
              <Button type="button" variant="ghost" size="sm" className="text-xs gap-1 h-7" onClick={() => set('phones', [...(c.phones || phones), { label: 'mobile', number: '', is_primary: false }])}>
                <Plus className="w-3 h-3" /> Add Phone
              </Button>
            )}
          </div>
        </Section>

        {/* Emails */}
        <Section title="Email Addresses" icon={Mail}>
          <div className="space-y-2">
            {emails.length > 0 ? emails.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600">{e.label}</span>
                {isEditing ? (
                  <Input value={e.address} onChange={ev => {
                    const updated = [...(c.emails || emails)];
                    updated[i] = { ...updated[i], address: ev.target.value };
                    set('emails', updated);
                  }} className="h-7 text-sm flex-1" />
                ) : (
                  <span className="text-sm">{e.address}</span>
                )}
              </div>
            )) : <p className="text-xs text-muted-foreground">No emails</p>}
            {isEditing && (
              <Button type="button" variant="ghost" size="sm" className="text-xs gap-1 h-7" onClick={() => set('emails', [...(c.emails || emails), { label: 'personal', address: '', is_primary: false }])}>
                <Plus className="w-3 h-3" /> Add Email
              </Button>
            )}
          </div>
        </Section>

        {/* Organization / Building */}
        {(c.organization?.tower || c.organization?.unit_number || c.organization?.name || isEditing) && (
          <Section title="Building & Organization" icon={Building2}>
            {isEditing ? (
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[10px] text-muted-foreground">Tower</label><Input value={c.organization?.tower || ''} onChange={e => setNested('organization', 'tower', e.target.value)} className="h-7 text-sm mt-0.5" /></div>
                <div><label className="text-[10px] text-muted-foreground">Unit #</label><Input value={c.organization?.unit_number || ''} onChange={e => setNested('organization', 'unit_number', e.target.value)} className="h-7 text-sm mt-0.5" /></div>
                <div><label className="text-[10px] text-muted-foreground">Company</label><Input value={c.organization?.name || ''} onChange={e => setNested('organization', 'name', e.target.value)} className="h-7 text-sm mt-0.5" /></div>
                <div><label className="text-[10px] text-muted-foreground">Role</label><Input value={c.organization?.role || ''} onChange={e => setNested('organization', 'role', e.target.value)} className="h-7 text-sm mt-0.5" /></div>
              </div>
            ) : (
              <div className="space-y-1.5 text-sm">
                {c.organization?.tower && <div className="flex gap-2"><span className="text-muted-foreground text-xs w-16">Tower</span><span className="font-medium">{c.organization.tower}</span></div>}
                {c.organization?.unit_number && <div className="flex gap-2"><span className="text-muted-foreground text-xs w-16">Unit</span><span className="font-medium">{c.organization.unit_number}</span></div>}
                {c.organization?.name && <div className="flex gap-2"><span className="text-muted-foreground text-xs w-16">Company</span><span>{c.organization.name}</span></div>}
                {c.organization?.role && <div className="flex gap-2"><span className="text-muted-foreground text-xs w-16">Role</span><span>{c.organization.role}</span></div>}
              </div>
            )}
          </Section>
        )}

        {/* Profile */}
        <Section title="Profile" icon={User}>
          {isEditing ? (
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[10px] text-muted-foreground">Nationality</label><Input value={c.nationality || ''} onChange={e => set('nationality', e.target.value)} className="h-7 text-sm mt-0.5" /></div>
              <div><label className="text-[10px] text-muted-foreground">Language</label><Input value={c.language || ''} onChange={e => set('language', e.target.value)} className="h-7 text-sm mt-0.5" /></div>
              <div><label className="text-[10px] text-muted-foreground">Timezone</label><Input value={c.timezone || ''} onChange={e => set('timezone', e.target.value)} placeholder="e.g. Asia/Dubai" className="h-7 text-sm mt-0.5" /></div>
            </div>
          ) : (
            <div className="space-y-1.5 text-sm">
              {c.nationality && <div className="flex gap-2 items-center"><Globe className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-muted-foreground text-xs">Nationality</span><span>{c.nationality}</span></div>}
              {c.language && <div className="flex gap-2 items-center"><Languages className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-muted-foreground text-xs">Language</span><span>{c.language}</span></div>}
              {!c.nationality && !c.language && <p className="text-xs text-muted-foreground">No profile info</p>}
            </div>
          )}
        </Section>

        {/* Tags */}
        <Section title="Tags" icon={Hash}>
          <div className="flex flex-wrap gap-1.5">
            {c.tags?.map(tag => (
              <span key={tag} className="bg-accent/10 text-accent-foreground text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                {tag}
                {isEditing && <button onClick={() => removeTag(tag)}><X className="w-2.5 h-2.5" /></button>}
              </span>
            ))}
            {!c.tags?.length && !isEditing && <p className="text-xs text-muted-foreground">No tags</p>}
          </div>
          {isEditing && (
            <div className="flex gap-2 pt-1">
              <Input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Add tag..." className="h-7 text-xs flex-1" />
              <Button size="sm" variant="outline" onClick={addTag} className="h-7 text-xs">Add</Button>
            </div>
          )}
        </Section>

        {/* Notes */}
        <Section title="Notes">
          <Textarea value={c.notes || ''} onChange={e => isEditing && set('notes', e.target.value)} disabled={!isEditing} placeholder="No notes yet..." className="min-h-20 text-sm" />
        </Section>

        {/* Custom Fields */}
        <Section title="Custom Fields">
          <div className="space-y-2">
            {c.custom_fields?.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground text-xs w-24 shrink-0">{f.key}</span>
                {isEditing ? (
                  <>
                    <Input value={f.value} onChange={e => {
                      const updated = [...c.custom_fields];
                      updated[i] = { ...updated[i], value: e.target.value };
                      set('custom_fields', updated);
                    }} className="h-7 text-sm flex-1" />
                    <button onClick={() => removeCustomField(i)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                  </>
                ) : (
                  <span className="font-medium">{f.value}</span>
                )}
              </div>
            ))}
            {!c.custom_fields?.length && !isEditing && <p className="text-xs text-muted-foreground">No custom fields</p>}
            {isEditing && (
              <div className="flex gap-2 pt-1 border-t">
                <Input value={newCustomKey} onChange={e => setNewCustomKey(e.target.value)} placeholder="Field name" className="h-7 text-xs" />
                <Input value={newCustomVal} onChange={e => setNewCustomVal(e.target.value)} placeholder="Value" className="h-7 text-xs" />
                <Button size="sm" variant="outline" onClick={addCustomField} className="h-7 shrink-0"><Plus className="w-3 h-3" /></Button>
              </div>
            )}
          </div>
        </Section>

        {/* Attachments */}
        {c.attachments?.length > 0 && (
          <Section title="Attachments" icon={Paperclip}>
            <div className="space-y-1.5">
              {c.attachments.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-accent hover:underline">
                  <Paperclip className="w-3.5 h-3.5" />{a.name}
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* Timeline */}
        <Section title="Timeline" icon={Calendar}>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Added:</span>
              <span>{format(new Date(contact.created_date), 'MMM dd, yyyy')}</span>
            </div>
            {contact.last_contact_date && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Last Contact:</span>
                <span>{format(new Date(contact.last_contact_date), 'MMM dd, yyyy')}</span>
              </div>
            )}
            {history.length > 0 && (
              <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
                {history.map(entry => (
                  <div key={entry.id} className="p-2 bg-background rounded border border-border">
                    <div className="font-medium capitalize">{entry.change_type?.replace(/_/g, ' ')}</div>
                    <div className="text-muted-foreground text-[10px] mt-0.5">{entry.changed_by} • {format(new Date(entry.created_date), 'MMM dd, yyyy HH:mm')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>
          </div>
        ) : (
          <WhatsAppPanel lead={contact} />
        )}
      </div>
    </div>
  );
}