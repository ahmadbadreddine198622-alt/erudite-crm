import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
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
import { Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';

const SECTIONS = [
  {
    title: '📋 Contract Info',
    fields: [
      { key: 'contract_date', label: 'Contract Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['draft','generated','signed','registered'] },
      { key: 'ejari_registration_no', label: 'Ejari Registration No.', span2: true },
    ],
  },
  {
    title: '🏢 Lessor (Owner / Landlord)',
    fields: [
      { key: 'owner_name', label: 'Owner Name', span2: true },
      { key: 'lessor_name', label: 'Lessor Name', span2: true },
      { key: 'lessor_emirates_id', label: 'Emirates ID' },
      { key: 'lessor_email', label: 'Email', type: 'email' },
      { key: 'lessor_phone', label: 'Phone' },
      { key: 'lessor_license_no', label: 'Trade License No.' },
      { key: 'lessor_licensing_authority', label: 'Licensing Authority' },
    ],
  },
  {
    title: '👤 Tenant',
    fields: [
      { key: 'tenant_name', label: 'Tenant Name', span2: true },
      { key: 'tenant_emirates_id', label: 'Emirates ID' },
      { key: 'tenant_email', label: 'Email', type: 'email' },
      { key: 'tenant_phone', label: 'Phone' },
      { key: 'tenant_license_no', label: 'Trade License No.' },
      { key: 'tenant_licensing_authority', label: 'Licensing Authority' },
    ],
  },
  {
    title: '🏠 Property Details',
    fields: [
      { key: 'building_name', label: 'Building Name', span2: true },
      { key: 'location', label: 'Location / Community', span2: true },
      { key: 'property_no', label: 'Property No.' },
      { key: 'plot_no', label: 'Plot No.' },
      { key: 'makani_no', label: 'Makani No.' },
      { key: 'property_type', label: 'Property Type' },
      { key: 'property_area_sqm', label: 'Area (sqm)', type: 'number' },
      { key: 'dewa_premises_no', label: 'DEWA Premises No.' },
      { key: 'property_usage', label: 'Usage', type: 'select', options: ['residential','commercial','industrial'] },
    ],
  },
  {
    title: '💰 Financial Terms',
    fields: [
      { key: 'annual_rent_aed', label: 'Annual Rent (AED)', type: 'number' },
      { key: 'contract_period_from', label: 'Period From', type: 'date' },
      { key: 'contract_period_to', label: 'Period To', type: 'date' },
      { key: 'contract_value_aed', label: 'Contract Value (AED)', type: 'number' },
      { key: 'security_deposit_aed', label: 'Security Deposit (AED)', type: 'number' },
      { key: 'mode_of_payment', label: 'Mode of Payment', span2: true },
    ],
  },
];

export default function ContractFormDialog({ open, onClose, contract }) {
  const queryClient = useQueryClient();
  const isEdit = !!contract?.id;
  const blank = { status: 'draft' };
  const [form, setForm] = useState(blank);
  const [prefilling, setPrefilling] = useState(false);

  // Fetch deals for pre-fill dropdown
  const { data: deals = [] } = useQuery({
    queryKey: ['deals-list'],
    queryFn: () => base44.entities.Deal.list('-created_date', 100),
    enabled: open,
  });

  useEffect(() => {
    setForm(contract?.id ? { ...contract } : blank);
  }, [contract, open]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // Pre-fill from Deal
  const prefillFromDeal = async (dealId) => {
    if (!dealId) return;
    setPrefilling(true);
    try {
      const deal = await base44.entities.Deal.get(dealId);
      const updates = { deal_id: dealId };

      // Load landlord → lessor fields
      if (deal.landlord_id) {
        try {
          const ll = await base44.entities.Landlord.get(deal.landlord_id);
          if (ll) {
            updates.owner_name = ll.full_name_en || '';
            updates.lessor_name = ll.full_name_en || '';
            updates.lessor_email = ll.email || '';
            updates.lessor_phone = ll.phone || ll.whatsapp || '';
          }
        } catch { /* non-fatal */ }
      }

      // Load lead → tenant fields
      if (deal.lead_id) {
        try {
          const lead = await base44.entities.Lead.get(deal.lead_id);
          if (lead) {
            updates.tenant_name = lead.full_name || lead.name || '';
            updates.tenant_email = lead.email || '';
            updates.tenant_phone = lead.phone || lead.whatsapp || '';
          }
        } catch { /* non-fatal */ }
      }

      // Load property fields
      if (deal.property_id) {
        try {
          const prop = await base44.entities.Property.get(deal.property_id);
          if (prop) {
            updates.building_name = prop.building_name || '';
            updates.location = prop.location || '';
            updates.property_type = prop.property_type || '';
            updates.property_no = prop.unit_no || '';
            updates.property_area_sqm = prop.area_sqft ? Math.round(prop.area_sqft * 0.0929) : undefined;
          }
        } catch { /* non-fatal */ }
      }

      // Deal financial fields
      if (deal.rent_aed) updates.annual_rent_aed = deal.rent_aed;
      if (deal.deal_value) updates.annual_rent_aed = updates.annual_rent_aed || deal.deal_value;

      setForm(f => ({ ...f, ...updates }));
      toast.success('Fields pre-filled from Deal');
    } catch (err) {
      toast.error('Could not load deal data');
    } finally {
      setPrefilling(false);
    }
  };

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

        {/* Pre-fill from Deal */}
        <div className="flex items-center gap-3 p-3 rounded-lg border border-accent/30 bg-accent/5">
          <Zap className="w-4 h-4 text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground mb-1">Pre-fill from Deal</p>
            <Select onValueChange={prefillFromDeal} value={form.deal_id || ''}>
              <SelectTrigger className="h-8 text-sm glass-input">
                <SelectValue placeholder="Select a deal to auto-populate fields…" />
              </SelectTrigger>
              <SelectContent>
                {deals.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.title || d.property_name || d.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {prefilling && <Loader2 className="w-4 h-4 animate-spin text-accent shrink-0" />}
        </div>

        <div className="space-y-6 py-2">
          {SECTIONS.map(section => (
            <div key={section.title}>
              <p className="text-sm font-semibold text-muted-foreground mb-3">{section.title}</p>
              <div className="grid grid-cols-2 gap-3">
                {section.fields.map(f => (
                  <div key={f.key} className={f.span2 ? 'col-span-2' : ''}>
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
                        value={form[f.key] ?? ''}
                        onChange={e => set(f.key, f.type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)}
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