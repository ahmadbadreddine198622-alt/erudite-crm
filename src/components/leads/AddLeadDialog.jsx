import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { SOURCE_LABELS, LEAD_TYPE_LABELS } from '@/lib/constants';

const PROJECT_LAYERS = [
  { id: 'peninsula-three', label: 'Peninsula Three' },
  { id: 'jumeirah-living', label: 'Jumeirah Living' },
  { id: 'six-senses', label: 'Six Senses' },
  { id: 'peninsula-four', label: 'Peninsula Four' },
];

const initialForm = {
  name: '', email: '', phone: '', source: 'website',
  type: 'buyer', budget_aed: '', notes: '', nationality: '', project_layer: '',
};

export default function AddLeadDialog({ open, onClose }) {
  const [form, setForm] = useState(initialForm);
  const [duplicateWarning, setDuplicateWarning] = useState([]);
  const [validationErrors, setValidationErrors] = useState({});
  const [autoTagSuggestion, setAutoTagSuggestion] = useState(null);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setForm(initialForm);
      setDuplicateWarning([]);
      setValidationErrors({});
      setAutoTagSuggestion(null);
      onClose();
    },
  });

  // Phone duplicate check on blur
  const checkDuplicatePhone = async (phone) => {
    if (!phone || phone.length < 7) return;
    const res = await base44.functions.invoke('detectDuplicates', { action: 'check_phone', phone }).catch(() => ({ data: { duplicates: [] } }));
    setDuplicateWarning(res.data?.duplicates || []);
  };

  // Auto-tag analysis when name/phone changes
  useEffect(() => {
    if (!form.name && !form.phone) return;
    const timer = setTimeout(() => {
      base44.functions.invoke('autoTagLead', { action: 'analyze', lead_data: { name: form.name, phone: form.phone } })
        .then(r => {
          const s = r.data;
          if (s && (s.suggested_tags?.length || s.suggested_nationality)) setAutoTagSuggestion(s);
          else setAutoTagSuggestion(null);
        }).catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [form.name, form.phone]);

  const validate = () => {
    const errors = {};
    const name = form.name?.trim();
    if (!name || name.length < 2) errors.name = 'Name must be at least 2 characters';
    if (/^unknown$/i.test(name)) errors.name = 'Please use a real name';
    if (!form.phone && !form.email) errors.phone = 'Phone or email is required';
    return errors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) { setValidationErrors(errors); return; }
    if (!form.project_layer) { setValidationErrors({ project_layer: 'Please select a project layer' }); return; }
    const tags = autoTagSuggestion?.suggested_tags || [];
    createMutation.mutate({
      ...form,
      budget_aed: form.budget_aed ? Number(form.budget_aed) : undefined,
      stage: 'new_lead',
      lead_score: Math.floor(Math.random() * 40 + 30),
      tags,
      nationality: form.nationality || autoTagSuggestion?.suggested_nationality || undefined,
      relationship_type: autoTagSuggestion?.suggested_type || undefined,
      project_layer: form.project_layer,
    });
  };

  const set = (field) => (e) => {
    setValidationErrors(prev => ({ ...prev, [field]: undefined }));
    setForm(f => ({ ...f, [field]: e?.target?.value ?? e }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Duplicate warning */}
          {duplicateWarning.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2 text-orange-700">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-semibold">Possible duplicate — {duplicateWarning.length} existing lead(s) with this phone:</span>
              </div>
              {duplicateWarning.map(d => (
                <p key={d.id} className="text-xs text-orange-600 ml-6">{d.name} — {d.phone} ({d.stage})</p>
              ))}
            </div>
          )}
          {/* Auto-tag suggestion */}
          {autoTagSuggestion?.suggested_tags?.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
              <p className="text-xs text-blue-700">
                <strong>Auto-detected:</strong>{' '}
                {autoTagSuggestion.suggested_tags.map(t => `#${t}`).join(', ')}
                {autoTagSuggestion.suggested_nationality ? ` · Nationality: ${autoTagSuggestion.suggested_nationality}` : ''}
                {autoTagSuggestion.suggested_type === 'agent' ? ' · This looks like a broker/agent' : ''}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Full Name *</Label>
              <Input value={form.name} onChange={set('name')} placeholder="John Smith" className={validationErrors.name ? 'border-red-400' : ''} />
              {validationErrors.name && <p className="text-xs text-red-500 mt-1">{validationErrors.name}</p>}
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={set('phone')}
                onBlur={e => checkDuplicatePhone(e.target.value)}
                placeholder="+971 50 123 4567"
                className={validationErrors.phone ? 'border-red-400' : ''}
              />
              {validationErrors.phone && <p className="text-xs text-red-500 mt-1">{validationErrors.phone}</p>}
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={set('email')} type="email" placeholder="john@email.com" />
            </div>
            <div>
              <Label>Source</Label>
              <Select value={form.source} onValueChange={set('source')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={set('type')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAD_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Budget (AED)</Label>
              <Input value={form.budget_aed} onChange={set('budget_aed')} type="number" placeholder="1,500,000" />
            </div>
            <div>
              <Label>Project Layer *</Label>
              <Select value={form.project_layer} onValueChange={set('project_layer')}>
                <SelectTrigger><SelectValue placeholder="Select layer..." /></SelectTrigger>
                <SelectContent>
                  {PROJECT_LAYERS.map(layer => (
                    <SelectItem key={layer.id} value={layer.id}>{layer.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nationality</Label>
              <Input value={form.nationality} onChange={set('nationality')} placeholder="UAE" />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={set('notes')} placeholder="Additional details..." rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={createMutation.isPending}>
              {createMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Creating...</> : 'Create Lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}