import React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { GenerateTenancyPDFButton } from './TenancyContractPDF';

const Row = ({ label, value }) => (
  value ? (
    <div className="flex justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground w-44 shrink-0">{label}</span>
      <span className="text-xs text-foreground text-right">{value}</span>
    </div>
  ) : null
);

const Section = ({ title, rows }) => {
  const filled = rows.filter(r => r.value);
  if (!filled.length) return null;
  return (
    <div>
      <p className="text-xs font-bold text-accent uppercase tracking-wide mb-2">{title}</p>
      <div className="glass-card p-3 mb-3">
        {filled.map(r => <Row key={r.label} {...r} />)}
      </div>
    </div>
  );
};

export default function ContractPreviewDialog({ open, onClose, contract }) {
  if (!contract) return null;
  const fmt = (n) => n != null ? `AED ${Number(n).toLocaleString('en-AE')}` : null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle>Contract Preview</DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          <Section title="Contract Info" rows={[
            { label: 'Contract Date', value: contract.contract_date },
            { label: 'Status', value: contract.status },
            { label: 'Ejari Registration No.', value: contract.ejari_registration_no },
          ]} />
          <Section title="Lessor" rows={[
            { label: 'Owner Name', value: contract.owner_name },
            { label: 'Lessor Name', value: contract.lessor_name },
            { label: 'Emirates ID', value: contract.lessor_emirates_id },
            { label: 'Email', value: contract.lessor_email },
            { label: 'Phone', value: contract.lessor_phone },
            { label: 'License No.', value: contract.lessor_license_no },
          ]} />
          <Section title="Tenant" rows={[
            { label: 'Tenant Name', value: contract.tenant_name },
            { label: 'Emirates ID', value: contract.tenant_emirates_id },
            { label: 'Email', value: contract.tenant_email },
            { label: 'Phone', value: contract.tenant_phone },
            { label: 'License No.', value: contract.tenant_license_no },
          ]} />
          <Section title="Property" rows={[
            { label: 'Building', value: contract.building_name },
            { label: 'Location', value: contract.location },
            { label: 'Property No.', value: contract.property_no },
            { label: 'Plot No.', value: contract.plot_no },
            { label: 'Makani No.', value: contract.makani_no },
            { label: 'Type', value: contract.property_type },
            { label: 'Area (sqm)', value: contract.property_area_sqm },
            { label: 'DEWA Premises No.', value: contract.dewa_premises_no },
            { label: 'Usage', value: contract.property_usage },
          ]} />
          <Section title="Financial Terms" rows={[
            { label: 'Annual Rent', value: fmt(contract.annual_rent_aed) },
            { label: 'Contract Value', value: fmt(contract.contract_value_aed) },
            { label: 'Security Deposit', value: fmt(contract.security_deposit_aed) },
            { label: 'Period From', value: contract.contract_period_from },
            { label: 'Period To', value: contract.contract_period_to },
            { label: 'Mode of Payment', value: contract.mode_of_payment },
          ]} />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <GenerateTenancyPDFButton contract={contract} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}