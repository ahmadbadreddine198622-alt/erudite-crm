import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GeneratePDFButton, ViewPDFLink } from './TaxInvoicePDF';

const STATUS_COLORS = {
  draft: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  issued: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  partially_paid: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const EMPTY_FORM = {
  deal_id: '', agent_id: '', payer_name: '', payer_email: '', payer_phone: '', payer_trn: '',
  commission_amount: '',
  property_source: 'manual',
  property_details: { unit_number: '', building_name: '', community: '', property_type: '', reference_no: '', address: '' },
};

export default function InvoiceManager() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices-live'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 500),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['deals-for-invoice'],
    queryFn: () => base44.entities.Deal.list('-created_date', 200),
  });

  const [dealSearch, setDealSearch] = useState('');
  const [loadingDealProps, setLoadingDealProps] = useState(false);

  const handleDealSelect = async (dealId) => {
    setForm(f => ({ ...f, deal_id: dealId, property_details: { ...f.property_details } }));
    if (!dealId) return;
    setLoadingDealProps(true);
    try {
      const deal = await base44.entities.Deal.get(dealId);
      if (deal?.property_id) {
        const prop = await base44.entities.Property.get(deal.property_id);
        if (prop) {
          setForm(f => ({
            ...f,
            deal_id: dealId,
            property_details: {
              unit_number: f.property_details.unit_number || '',
              building_name: prop.building_name || '',
              community: prop.location || '',
              property_type: prop.property_type ? prop.property_type.replace(/_/g, ' ') : '',
              reference_no: prop.permit_number || '',
              address: prop.address || '',
            },
          }));
        }
      }
    } catch { /* non-fatal */ }
    setLoadingDealProps(false);
  };

  const setPD = (k, v) => setForm(f => ({ ...f, property_details: { ...f.property_details, [k]: v } }));

  const createInvoice = useMutation({
    mutationFn: (data) => base44.entities.Invoice.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices-live'] });
      setOpen(false);
      setForm(EMPTY_FORM);
    }
  });

  const agentMap = Object.fromEntries(users.map(u => [u.id, u.full_name || u.email]));

  const handleSubmit = (e) => {
    e.preventDefault();
    const commission = parseFloat(form.commission_amount) || 0;
    const vat = Math.round(commission * 0.05 * 100) / 100;
    const total = Math.round((commission + vat) * 100) / 100;
    const cleanPD = Object.fromEntries(Object.entries(form.property_details).filter(([, v]) => v));
    // eslint-disable-next-line no-unused-vars
    const { property_source, property_details: _pd, ...rest } = form;
    const payload = {
      ...rest,
      commission_amount: commission,
      vat_amount: vat,
      total_amount: total,
      ...(Object.keys(cleanPD).length ? { property_details: cleanPD } : {}),
    };
    createInvoice.mutate(payload);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const [deleteTarget, setDeleteTarget] = useState(null); // { invoice, payments, incomeRecords }
  const [deleting, setDeleting] = useState(false);

  const handleDeleteClick = async (inv) => {
    const [payments, incomeRecords] = await Promise.all([
      base44.entities.Payment.filter({ invoice_id: inv.id }),
      base44.entities.IncomeRecord.filter({ invoice_id: inv.id }),
    ]);
    setDeleteTarget({ invoice: inv, payments, incomeRecords });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { invoice, payments, incomeRecords } = deleteTarget;
    await Promise.all([
      ...payments.map(p => base44.entities.Payment.delete(p.id)),
      ...incomeRecords.map(r => base44.entities.IncomeRecord.delete(r.id)),
    ]);
    await base44.entities.Invoice.delete(invoice.id);
    queryClient.invalidateQueries({ queryKey: ['invoices-live'] });
    setDeleteTarget(null);
    setDeleting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Invoices</h2>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Invoice
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>No invoices yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                {['Invoice #', 'Payer', 'Agent', 'Total (AED)', 'Status', 'PDF', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium">{inv.invoice_number || '—'}</td>
                  <td className="px-4 py-3">{inv.payer_name || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{agentMap[inv.agent_id] || inv.agent_id || '—'}</td>
                  <td className="px-4 py-3 font-medium">{inv.total_amount?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs border ${STATUS_COLORS[inv.status] || ''}`}>
                      {inv.status?.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <GeneratePDFButton invoice={inv} />
                      <ViewPDFLink invoice={inv} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDeleteClick(inv)}
                      className="text-muted-foreground hover:text-red-400 transition-colors p-1 rounded"
                      title="Delete invoice"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Invoice?</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                This will permanently delete invoice <span className="font-semibold text-foreground">{deleteTarget.invoice.invoice_number || deleteTarget.invoice.id}</span>. This cannot be undone.
              </p>
              {(deleteTarget.payments.length > 0 || deleteTarget.incomeRecords.length > 0) && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
                  Related records will also be deleted:
                  {deleteTarget.payments.length > 0 && <div>• {deleteTarget.payments.length} payment(s)</div>}
                  {deleteTarget.incomeRecords.length > 0 && <div>• {deleteTarget.incomeRecords.length} income record(s)</div>}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Invoice</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Deal ID</Label>
                <Input placeholder="deal_id" value={form.deal_id} onChange={e => set('deal_id', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Agent ID</Label>
                <Input placeholder="agent_id" value={form.agent_id} onChange={e => set('agent_id', e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Payer Name</Label>
                <Input placeholder="Payer name" value={form.payer_name} onChange={e => set('payer_name', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Client Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="email" placeholder="client@email.com" value={form.payer_email} onChange={e => set('payer_email', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Client Phone <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input placeholder="+971…" value={form.payer_phone} onChange={e => set('payer_phone', e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Client TRN <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input placeholder="Tax Registration Number" value={form.payer_trn} onChange={e => set('payer_trn', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Commission (AED) *</Label>
                <Input type="number" required placeholder="0" value={form.commission_amount} onChange={e => set('commission_amount', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>VAT 5% (AED)</Label>
                <Input
                  readOnly
                  tabIndex={-1}
                  className="bg-secondary/50 cursor-not-allowed text-muted-foreground"
                  value={form.commission_amount ? (Math.round(parseFloat(form.commission_amount) * 0.05 * 100) / 100).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                  placeholder="auto"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Total (AED)</Label>
                <Input
                  readOnly
                  tabIndex={-1}
                  className="bg-secondary/50 cursor-not-allowed font-semibold"
                  value={form.commission_amount ? (() => { const c = parseFloat(form.commission_amount); const v = Math.round(c * 0.05 * 100) / 100; return (Math.round((c + v) * 100) / 100).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); })() : ''}
                  placeholder="auto"
                />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={form.status}
                  onChange={e => set('status', e.target.value)}
                >
                  {['draft', 'issued', 'partially_paid', 'paid', 'cancelled'].map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Issue Date *</Label>
                <Input type="date" required value={form.issue_date} onChange={e => set('issue_date', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Due Date *</Label>
                <Input type="date" required value={form.due_date} onChange={e => set('due_date', e.target.value)} />
              </div>
            </div>
            {/* ── Property Details ── */}
            <div className="col-span-2 border-t border-border pt-3 space-y-3">
              <div className="flex items-center gap-2">
                <Label className="shrink-0">Property Source</Label>
                <div className="flex gap-1">
                  {[['manual', 'Manual Entry'], ['crm', 'From Deal (CRM)']].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => set('property_source', val)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors border ${
                        form.property_source === val
                          ? 'bg-accent text-accent-foreground border-accent'
                          : 'border-border text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {form.property_source === 'crm' && (
                <div className="space-y-2">
                  <Label>Select Deal</Label>
                  <Input
                    placeholder="Search deals by lead name…"
                    value={dealSearch}
                    onChange={e => setDealSearch(e.target.value)}
                  />
                  <select
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    value={form.deal_id}
                    onChange={e => { setDealSearch(''); handleDealSelect(e.target.value); }}
                  >
                    <option value="">— pick a deal —</option>
                    {deals
                      .filter(d => !dealSearch || (d.lead_name || '').toLowerCase().includes(dealSearch.toLowerCase()))
                      .map(d => (
                        <option key={d.id} value={d.id}>
                          {d.lead_name || d.id} · {d.stage} {d.deal_value ? `· AED ${d.deal_value.toLocaleString()}` : ''}
                        </option>
                      ))}
                  </select>
                  {loadingDealProps && <p className="text-xs text-muted-foreground">Loading property data…</p>}
                  {form.deal_id && !loadingDealProps && (
                    <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-secondary/30 p-3">
                      {[['Unit No.', 'unit_number'], ['Building/Tower', 'building_name'], ['Community', 'community'], ['Type', 'property_type'], ['Permit/Ref', 'reference_no'], ['Address', 'address']].map(([label, key]) => (
                        <div key={key} className="space-y-0.5">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                          {key === 'unit_number' ? (
                            <Input
                              className="h-7 text-xs"
                              placeholder="Enter manually"
                              value={form.property_details.unit_number}
                              onChange={e => setPD('unit_number', e.target.value)}
                            />
                          ) : (
                            <p className="text-sm font-medium">{form.property_details[key] || <span className="text-muted-foreground">—</span>}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {form.property_source === 'manual' && (
                <div className="grid grid-cols-2 gap-2">
                  {[['Unit No.', 'unit_number'], ['Building/Tower', 'building_name'], ['Community', 'community'], ['Property Type', 'property_type'], ['Permit/Ref No.', 'reference_no'], ['Address', 'address']].map(([label, key]) => (
                    <div key={key} className={`space-y-1 ${key === 'address' ? 'col-span-2' : ''}`}>
                      <Label>{label} <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <Input
                        placeholder={label}
                        value={form.property_details[key]}
                        onChange={e => setPD(key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label>Notes / Remarks <span className="text-muted-foreground">(optional)</span></Label>
              <textarea
                className="w-full min-h-[72px] rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none"
                placeholder="Any remarks to appear on the invoice PDF…"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createInvoice.isPending}>
                {createInvoice.isPending ? 'Creating…' : 'Create Invoice'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}