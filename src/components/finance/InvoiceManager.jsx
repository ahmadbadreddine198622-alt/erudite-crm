import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, FileText } from 'lucide-react';
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
  deal_id: '', agent_id: '', payer_name: '', commission_amount: '',
  issue_date: '', due_date: '', status: 'draft'
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
    const payload = {
      ...form,
      commission_amount: commission,
      vat_amount: vat,
      total_amount: total,
    };
    createInvoice.mutate(payload);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
                {['Invoice #', 'Payer', 'Agent', 'Total (AED)', 'Status', 'PDF'].map(h => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
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
                <Label>Commission (AED) *</Label>
                <Input type="number" required placeholder="0" value={form.commission_amount} onChange={e => set('commission_amount', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>VAT 5% (AED)</Label>
                <Input
                  readOnly
                  tabIndex={-1}
                  className="bg-secondary/50 cursor-not-allowed text-muted-foreground"
                  value={form.commission_amount ? (Math.round(parseFloat(form.commission_amount) * 0.05 * 100) / 100).toLocaleString() : ''}
                  placeholder="auto"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Total (AED)</Label>
                <Input
                  readOnly
                  tabIndex={-1}
                  className="bg-secondary/50 cursor-not-allowed font-semibold"
                  value={form.commission_amount ? (() => { const c = parseFloat(form.commission_amount); const v = Math.round(c * 0.05 * 100) / 100; return (Math.round((c + v) * 100) / 100).toLocaleString(); })() : ''}
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