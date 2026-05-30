import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const METHOD_COLORS = {
  bank_transfer: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  cheque: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  cash: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

const EMPTY_FORM = {
  invoice_id: '', amount: '', date_received: '', method: 'bank_transfer', reference: ''
};

export default function PaymentManager() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments-live'],
    queryFn: () => base44.entities.Payment.list('-date_received', 500),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices-live'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 500),
  });

  const createPayment = useMutation({
    mutationFn: (data) => base44.entities.Payment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments-live'] });
      queryClient.invalidateQueries({ queryKey: ['invoices-live'] });
      setOpen(false);
      setForm(EMPTY_FORM);
    }
  });

  const invoiceMap = Object.fromEntries(invoices.map(i => [i.id, i.invoice_number || i.id]));

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      amount: parseFloat(form.amount) || 0,
    };
    if (!payload.reference) delete payload.reference;
    createPayment.mutate(payload);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Payments</h2>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Payment
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : payments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>No payments yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                {['Invoice', 'Amount (AED)', 'Date Received', 'Method', 'Reference'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-mono">{invoiceMap[p.invoice_id] || p.invoice_id || '—'}</td>
                  <td className="px-4 py-3 font-medium">{p.amount?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.date_received || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs border ${METHOD_COLORS[p.method] || ''}`}>
                      {p.method?.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.reference || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label>Invoice *</Label>
              <select
                required
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.invoice_id}
                onChange={e => set('invoice_id', e.target.value)}
              >
                <option value="">Select invoice…</option>
                {invoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number || inv.id} — {inv.payer_name || 'Unknown'}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Amount (AED) *</Label>
                <Input type="number" required placeholder="0" value={form.amount} onChange={e => set('amount', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Date Received *</Label>
                <Input type="date" required value={form.date_received} onChange={e => set('date_received', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Method</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={form.method}
                  onChange={e => set('method', e.target.value)}
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Reference (optional)</Label>
                <Input placeholder="TXN-123" value={form.reference} onChange={e => set('reference', e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createPayment.isPending}>
                {createPayment.isPending ? 'Saving…' : 'Record Payment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}