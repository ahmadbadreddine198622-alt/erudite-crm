import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, X, Phone, Mail, Building2 } from 'lucide-react';
import { toast } from 'sonner';

const PHONE_LABELS = ['mobile', 'whatsapp', 'work', 'home', 'other'];
const EMAIL_LABELS = ['personal', 'work', 'other'];
const SOURCES = ['property_finder', 'bayut', 'whatsapp', 'referral', 'website', 'walk_in', 'social_media', 'email', 'import', 'other'];
const RELATIONSHIP_TYPES = ['buyer', 'seller', 'investor', 'tenant', 'landlord', 'agent', 'developer', 'partner', 'other'];

export default function AddContactDialog({ isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    phones: [{ label: 'mobile', number: '', is_primary: true }],
    emails: [{ label: 'personal', address: '', is_primary: true }],
    nationality: '',
    language: '',
    relationship_type: 'buyer',
    source: 'other',
    organization: { name: '', role: '', unit_number: '', floor: '', tower: '' },
    notes: '',
    tags: [],
  });
  const [tagInput, setTagInput] = useState('');

  const mutation = useMutation({
    mutationFn: async (data) => {
      // Build primary phone/email for legacy fields + dedup
      const primaryPhone = data.phones.find(p => p.is_primary) || data.phones[0];
      const primaryEmail = data.emails.find(e => e.is_primary) || data.emails[0];
      const payload = {
        ...data,
        phone: primaryPhone?.number || '',
        email: primaryEmail?.address || '',
      };
      return base44.functions.invoke('createOrUpdateContact', payload);
    },
    onSuccess: (result) => {
      if (result.data?.success !== false) {
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
        queryClient.invalidateQueries({ queryKey: ['folders'] });
        toast.success('Contact created');
        onClose();
        setFormData({
          name: '', phones: [{ label: 'mobile', number: '', is_primary: true }],
          emails: [{ label: 'personal', address: '', is_primary: true }],
          nationality: '', language: '', relationship_type: 'buyer', source: 'other',
          organization: { name: '', role: '', unit_number: '', floor: '', tower: '' },
          notes: '', tags: [],
        });
      }
    },
    onError: () => toast.error('Failed to create contact'),
  });

  const addPhone = () => setFormData(prev => ({
    ...prev, phones: [...prev.phones, { label: 'mobile', number: '', is_primary: false }]
  }));

  const removePhone = (i) => setFormData(prev => ({
    ...prev, phones: prev.phones.filter((_, idx) => idx !== i)
  }));

  const updatePhone = (i, field, value) => setFormData(prev => ({
    ...prev,
    phones: prev.phones.map((p, idx) =>
      idx === i ? { ...p, [field]: value } :
      field === 'is_primary' && value ? { ...p, is_primary: false } : p
    )
  }));

  const addEmail = () => setFormData(prev => ({
    ...prev, emails: [...prev.emails, { label: 'personal', address: '', is_primary: false }]
  }));

  const removeEmail = (i) => setFormData(prev => ({
    ...prev, emails: prev.emails.filter((_, idx) => idx !== i)
  }));

  const updateEmail = (i, field, value) => setFormData(prev => ({
    ...prev,
    emails: prev.emails.map((e, idx) =>
      idx === i ? { ...e, [field]: value } :
      field === 'is_primary' && value ? { ...e, is_primary: false } : e
    )
  }));

  const addTag = () => {
    if (!tagInput.trim()) return;
    setFormData(prev => ({ ...prev, tags: [...(prev.tags || []), tagInput.trim()] }));
    setTagInput('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('Name is required'); return; }
    if (!formData.phones[0]?.number?.trim()) { toast.error('At least one phone number is required'); return; }
    mutation.mutate(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">New Contact</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">

          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Full Name *</label>
            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Ahmed Al Mansouri" className="mt-1" />
          </div>

          {/* Phone Numbers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Phone Numbers *</label>
              <button type="button" onClick={addPhone} className="text-xs text-accent hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
            </div>
            <div className="space-y-2">
              {formData.phones.map((p, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select value={p.label} onValueChange={v => updatePhone(i, 'label', v)}>
                    <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{PHONE_LABELS.map(l => <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={p.number} onChange={e => updatePhone(i, 'number', e.target.value)} placeholder="+971 50 000 0000" className="h-8 text-sm flex-1" />
                  {formData.phones.length > 1 && (
                    <button type="button" onClick={() => removePhone(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Emails */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Emails</label>
              <button type="button" onClick={addEmail} className="text-xs text-accent hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
            </div>
            <div className="space-y-2">
              {formData.emails.map((e, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select value={e.label} onValueChange={v => updateEmail(i, 'label', v)}>
                    <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{EMAIL_LABELS.map(l => <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={e.address} onChange={ev => updateEmail(i, 'address', ev.target.value)} placeholder="email@example.com" type="email" className="h-8 text-sm flex-1" />
                  {formData.emails.length > 1 && (
                    <button type="button" onClick={() => removeEmail(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Organization / Unit */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2"><Building2 className="w-3.5 h-3.5" /> Building / Organization</label>
            <div className="grid grid-cols-2 gap-2">
              <Input value={formData.organization.tower} onChange={e => setFormData(prev => ({ ...prev, organization: { ...prev.organization, tower: e.target.value } }))} placeholder="Tower / Building" className="h-8 text-sm" />
              <Input value={formData.organization.unit_number} onChange={e => setFormData(prev => ({ ...prev, organization: { ...prev.organization, unit_number: e.target.value } }))} placeholder="Unit #" className="h-8 text-sm" />
              <Input value={formData.organization.name} onChange={e => setFormData(prev => ({ ...prev, organization: { ...prev.organization, name: e.target.value } }))} placeholder="Company name" className="h-8 text-sm" />
              <Input value={formData.organization.role} onChange={e => setFormData(prev => ({ ...prev, organization: { ...prev.organization, role: e.target.value } }))} placeholder="Role / Title" className="h-8 text-sm" />
            </div>
          </div>

          {/* Profile */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Relationship Type</label>
              <Select value={formData.relationship_type} onValueChange={v => setFormData({ ...formData, relationship_type: v })}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{RELATIONSHIP_TYPES.map(r => <SelectItem key={r} value={r} className="text-xs capitalize">{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Source</label>
              <Select value={formData.source} onValueChange={v => setFormData({ ...formData, source: v })}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s} className="text-xs">{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Nationality</label>
              <Input value={formData.nationality} onChange={e => setFormData({ ...formData, nationality: e.target.value })} placeholder="e.g. Russian" className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Language</label>
              <Input value={formData.language} onChange={e => setFormData({ ...formData, language: e.target.value })} placeholder="e.g. English" className="mt-1 h-8 text-sm" />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Tags</label>
            <div className="flex gap-2 mt-1">
              <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Add tag and press Enter" className="h-8 text-sm flex-1" />
              <Button type="button" variant="outline" size="sm" onClick={addTag} className="h-8">Add</Button>
            </div>
            {formData.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {formData.tags.map((t, i) => (
                  <span key={i} className="bg-accent/10 text-accent-foreground text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                    {t}
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, tags: prev.tags.filter((_, idx) => idx !== i) }))}><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Notes</label>
            <Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Any additional notes..." className="mt-1 text-sm min-h-16" />
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="flex-1 gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Contact
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}