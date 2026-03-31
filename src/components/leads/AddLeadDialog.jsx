import React, { useState } from 'react';
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
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setForm(initialForm);
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.project_layer) {
      alert('Please select a project layer');
      return;
    }
    createMutation.mutate({
      ...form,
      budget_aed: form.budget_aed ? Number(form.budget_aed) : undefined,
      stage: 'new_lead',
      lead_score: Math.floor(Math.random() * 40 + 30),
      tags: [],
      project_layer: form.project_layer,
    });
  };

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e?.target?.value ?? e }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Full Name *</Label>
              <Input value={form.name} onChange={set('name')} required placeholder="John Smith" />
            </div>
            <div>
              <Label>Phone *</Label>
              <Input value={form.phone} onChange={set('phone')} required placeholder="+971 50 123 4567" />
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
              {createMutation.isPending ? 'Creating...' : 'Create Lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}