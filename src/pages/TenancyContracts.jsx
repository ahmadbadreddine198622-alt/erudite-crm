import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Eye, Pencil, Trash2, FileText, Send, BookOpen } from 'lucide-react';
import ContractFormDialog from '@/components/tenancy/ContractFormDialog';
import ContractPreviewDialog from '@/components/tenancy/ContractPreviewDialog';
import ContractSendDialog from '@/components/tenancy/ContractSendDialog';
import TermsAndConditionsDialog from '@/components/tenancy/TermsAndConditionsDialog';
import { GenerateTenancyPDFButton, ViewTenancyPDFLink } from '@/components/tenancy/TenancyContractPDF';
import SetupEjariAssets from '@/components/tenancy/SetupEjariAssets';
import { toast } from 'sonner';

const STATUS_PILL = {
  draft:      'jewel-slate',
  generated:  'jewel-blue',
  signed:     'jewel-emerald',
  registered: 'jewel-gold',
};

export default function TenancyContracts() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['tenancy-contracts'],
    queryFn: () => base44.entities.TenancyContract.list('-created_date', 100),
  });

  const remove = useMutation({
    mutationFn: (id) => base44.entities.TenancyContract.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenancy-contracts'] });
      toast.success('Contract deleted');
    },
  });

  const openForm = (c = null) => { setSelected(c); setFormOpen(true); };
  const openPreview = (c) => { setSelected(c); setPreviewOpen(true); };
  const openSend = (c) => { setSelected(c); setSendOpen(true); };
  const openTerms = (c) => { setSelected(c); setTermsOpen(true); };

  return (
    <div className="page-root">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title text-2xl">Tenancy Contracts</h1>
          <p className="page-subtitle mt-1">Dubai Ejari Unified Tenancy Contracts</p>
        </div>
        <Button className="gap-2" onClick={() => openForm()}>
          <Plus className="w-4 h-4" /> New Contract
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading…</div>
      ) : contracts.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center gap-3">
          <FileText className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">No tenancy contracts yet. Click <strong>New Contract</strong> to get started.</p>
        </div>
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="glass-table w-full">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Lessor</th>
                <th>Property</th>
                <th>Period</th>
                <th>Annual Rent</th>
                <th>Ejari No.</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map(c => (
                <tr key={c.id}>
                  <td className="font-medium">{c.tenant_name || '—'}</td>
                  <td>{c.lessor_name || '—'}</td>
                  <td>{[c.building_name, c.location].filter(Boolean).join(', ') || '—'}</td>
                  <td className="text-xs">
                    {c.contract_period_from && c.contract_period_to
                      ? `${c.contract_period_from} → ${c.contract_period_to}`
                      : '—'}
                  </td>
                  <td className="tabular-nums">
                    {c.annual_rent_aed != null
                      ? `AED ${Number(c.annual_rent_aed).toLocaleString('en-AE')}`
                      : '—'}
                  </td>
                  <td className="text-xs text-muted-foreground">{c.ejari_registration_no || '—'}</td>
                  <td>
                    <span className={`jewel-pill ${STATUS_PILL[c.status] || 'jewel-slate'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Preview" onClick={() => openPreview(c)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <GenerateTenancyPDFButton contract={c} />
                      <ViewTenancyPDFLink contract={c} />
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Terms & Conditions" onClick={() => openTerms(c)}>
                        <BookOpen className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Send" onClick={() => openSend(c)}>
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Edit" onClick={() => openForm(c)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        title="Delete"
                        onClick={() => { if (confirm('Delete this contract?')) remove.mutate(c.id); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SetupEjariAssets />

      <ContractFormDialog open={formOpen} onClose={() => setFormOpen(false)} contract={selected} />
      <ContractPreviewDialog open={previewOpen} onClose={() => setPreviewOpen(false)} contract={selected} />
      <TermsAndConditionsDialog open={termsOpen} onClose={() => setTermsOpen(false)} contractId={selected?.id} />
      <ContractSendDialog open={sendOpen} onClose={() => setSendOpen(false)} contract={selected} />
    </div>
  );
}