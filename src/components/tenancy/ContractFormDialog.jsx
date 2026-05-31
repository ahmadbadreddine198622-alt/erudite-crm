import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const SECTIONS = [
  {
    title: '📋 Contract Info',
    fields: [
      { key: 'contract_date', label: 'Contract Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['draft','generated','signed','registered'] },
    ],
  },
  {
    title: '🏢 Lessor (Owner / Landlord)',
    fields: [
      { key: 'owner_name',              label: 'Owner Name' },
      { key: 'lessor_name',             label: 'Lessor Name' },
      { key: 'lessor_emirates_id',      label: 'Emirates ID' },
      { key: 'lessor_email',            label: 'Email', type: 'email' },
      { key: 'lessor_phone',            label: 'Phone' },
      { key: 'lessor_license_no',       label: 'Trade License No.' },
      { key: 'lessor_licensing_authority', label: 'Licensing Authority' },
    ],
  },
  {
    title: '👤 Tenant',
    fields: [
      { key: 'tenant_name',             label: 'Tenant Name' },
      { key: 'tenant_emirates_id',      label: 'Emirates ID' },
      { key: 'tenant_email',            label: 'Email', type: 'email' },
      { key: 'tenant_phone',            label: 'Phone' },
      { key: 'tenant_license_no',       label: 'Trade License No.' },
      { key: 'tenant_licensing_authority', label: 'Licensing Authority' },
    ],
  },
  {
    title: '🏠 Property Details',
    fields: [
      { key: 'building_name',       label: 'Building Name' },
      { key: 'location',            label: 'Location / Community' },
      { key: 'property_no',         label: 'Property No.' },
      { key: 'plot_no',             label: 'Plot No.' },
      { key: 'makani_no',           label: 'Makani No.' },
      { key: 'property_type',       label: 'Property Type' },
      { key: 'property_area_sqm',   label: 'Area (sqm)', type: 'number' },
      { key: 'dewa_premises_no',    label: 'DEWA Premises No.' },
      { key: 'property_usage',      label: 'Usage', type: 'select', options: ['residential','commercial','industrial'] },
    ],
  },
  {
    title: '💰 Financial Terms',
    fields: [
      { key: 'annual_rent_aed',     label: 'Annual Rent (AED)', type: 'number' },
      { key: 'contract_period_from',label: 'Period From', type: 'date' },
      { key: 'contract_period_to',  label: 'Period To', type: 'date' },
      { key: 'contract_value_aed',  label: 'Contract Value (AED)', type: 'number' },
      { key: 'security_deposit_aed',label: 'Security Deposit (AED)', type: 'number' },
      { key: 'mode_of_payment',     label: 'Mode of Payment' },
    ],
  },
];

export default function ContractFormDialog({ open, onClose, contract }) {
  const queryClient = useQueryClient();
  const isEdit = !!contract?.id;

  const blank = { status: 'draft' };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    setForm(contract && contract.id ? { ...contract } : blank);
  }, [contract, open]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const save = useMutation({
    mutationFn: (data) =>
      isEdit
        ? base44.entities.TenancyContract.update(contract.id, data)
        : base44.entities.TenancyContract.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenancy-contracts'] });
      toast.success(isEdit ? 'Contract updated' : 'Contract created');
      onClose();
    },
    onError: (err) => toast.error(err?.message || 'Save failed'),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {isEdit ? 'Edit Tenancy Contract' : 'New Tenancy Contract'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {SECTIONS.map(section => (
            <div key={section.title}>
              <p className="text-sm font-semibold text-muted-foreground mb-3">{section.title}</p>
              <div className="grid grid-cols-2 gap-3">
                {section.fields.map(f => (
                  <div key={f.key} className={f.type === 'email' || f.key === 'owner_name' ? 'col-span-2' : ''}>
                    <Label className="text-xs text-muted-foreground mb-1 block">{f.label}</Label>
                    {f.type === 'select' ? (
                      <Select value={form[f.key] || ''} onValueChange={v => set(f.key, v)}>
                        <SelectTrigger className="h-8 text-sm glass-input">
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          {f.options.map(o => (
                            <SelectItem key={o} value={o}>{o}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={f.type || 'text'}
                        value={form[f.key] || ''}
                        onChange={e => set(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                        className="h-8 text-sm glass-input"
                        placeholder={f.label}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
            {save.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Contract'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}