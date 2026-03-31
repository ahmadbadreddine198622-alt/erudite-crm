import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import { formatAED } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_STYLES = {
  pending:   'bg-amber-500/10 text-amber-600',
  partial:   'bg-blue-500/10 text-blue-600',
  paid:      'bg-emerald-500/10 text-emerald-600',
  overdue:   'bg-red-500/10 text-red-600',
  cancelled: 'bg-gray-200 text-gray-500',
};

function generateInvoiceNumber(existing) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const seq = (existing.length + 1).toString().padStart(5, '0');
  return `INV-${year}-${month}-${seq}`;
}

export default function InvoiceList({ invoices, leads, properties, commissions }) {
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const queryClient = useQueryClient();

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      const matchSearch = !search || inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
        inv.lead_name?.toLowerCase().includes(search.toLowerCase()) ||
        inv.agent_name?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || inv.payment_status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [invoices, search, filterStatus]);

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Invoice.update(id, { payment_status: status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search invoices…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New Invoice
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {['Invoice #', 'Type', 'Lead', 'Agent', 'Base', 'VAT (5%)', 'Total', 'Status', 'Due Date', 'Action'].map(h => (
                  <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(inv => (
                <TableRow key={inv.id} className="hover:bg-muted/30">
                  <TableCell className="text-xs font-mono font-semibold text-primary">{inv.invoice_number}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] capitalize">{inv.invoice_type?.replace(/_/g, ' ')}</Badge></TableCell>
                  <TableCell className="text-xs">{inv.lead_name || '—'}</TableCell>
                  <TableCell className="text-xs">{inv.agent_name || '—'}</TableCell>
                  <TableCell className="text-xs font-medium">{formatAED(inv.base_amount_aed)}</TableCell>
                  <TableCell className="text-xs text-blue-600">{formatAED(inv.vat_amount_aed)}</TableCell>
                  <TableCell className="text-sm font-bold text-accent">{formatAED(inv.total_amount_aed)}</TableCell>
                  <TableCell>
                    <Badge className={cn("text-[10px] capitalize", STATUS_STYLES[inv.payment_status])}>
                      {inv.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {inv.due_date && format(new Date(inv.due_date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Select value={inv.payment_status} onValueChange={v => updateStatus.mutate({ id: inv.id, status: v })}>
                      <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No invoices found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <CreateInvoiceDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        leads={leads}
        properties={properties}
        existing={invoices}
      />
    </div>
  );
}

function CreateInvoiceDialog({ open, onClose, leads, properties, existing }) {
  const queryClient = useQueryClient();
  const VAT_RATE = 5;

  const [form, setForm] = useState({
    invoice_type: 'commission',
    lead_id: '',
    property_id: '',
    agent_name: '',
    agent_email: '',
    base_amount_aed: '',
    deal_type: 'sale',
    due_date: '',
    payment_method: 'bank_transfer',
    notes: '',
  });

  const baseAmt = Number(form.base_amount_aed) || 0;
  const vatAmt = +(baseAmt * VAT_RATE / 100).toFixed(2);
  const totalAmt = +(baseAmt + vatAmt).toFixed(2);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Invoice.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice created');
      onClose();
      setForm({ invoice_type: 'commission', lead_id: '', property_id: '', agent_name: '', agent_email: '', base_amount_aed: '', deal_type: 'sale', due_date: '', payment_method: 'bank_transfer', notes: '' });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const lead = leads.find(l => l.id === form.lead_id);
    const property = properties.find(p => p.id === form.property_id);
    createMutation.mutate({
      ...form,
      invoice_number: generateInvoiceNumber(existing),
      base_amount_aed: baseAmt,
      vat_rate: VAT_RATE,
      vat_amount_aed: vatAmt,
      total_amount_aed: totalAmt,
      payment_status: 'pending',
      lead_name: lead?.name || '',
      property_title: property?.title || '',
    });
  };

  const set = (f) => (e) => setForm(prev => ({ ...prev, [f]: e?.target?.value ?? e }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Invoice Type</Label>
              <Select value={form.invoice_type} onValueChange={set('invoice_type')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="commission">Commission</SelectItem>
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="rental">Rental</SelectItem>
                  <SelectItem value="service_fee">Service Fee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Deal Type</Label>
              <Select value={form.deal_type} onValueChange={set('deal_type')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="rent">Rent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Lead</Label>
            <Select value={form.lead_id} onValueChange={set('lead_id')}>
              <SelectTrigger><SelectValue placeholder="Select lead (optional)" /></SelectTrigger>
              <SelectContent>
                {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Property</Label>
            <Select value={form.property_id} onValueChange={set('property_id')}>
              <SelectTrigger><SelectValue placeholder="Select property (optional)" /></SelectTrigger>
              <SelectContent>
                {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Agent Name</Label>
              <Input value={form.agent_name} onChange={set('agent_name')} placeholder="Agent name" />
            </div>
            <div>
              <Label>Agent Email</Label>
              <Input value={form.agent_email} onChange={set('agent_email')} placeholder="agent@company.com" />
            </div>
          </div>

          <div>
            <Label>Base Amount (AED) — excl. VAT</Label>
            <Input value={form.base_amount_aed} onChange={set('base_amount_aed')} type="number" required placeholder="e.g. 100000" />
          </div>

          {/* VAT Breakdown */}
          {baseAmt > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Base Amount</span><span className="font-medium">{formatAED(baseAmt)}</span>
              </div>
              <div className="flex justify-between text-blue-600">
                <span>VAT (5%)</span><span className="font-medium">+ {formatAED(vatAmt)}</span>
              </div>
              <div className="flex justify-between font-bold text-primary border-t border-blue-200 pt-1 mt-1">
                <span>Total</span><span>{formatAED(totalAmt)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={set('due_date')} />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={form.payment_method} onValueChange={set('payment_method')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Input value={form.notes} onChange={set('notes')} placeholder="Optional notes" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={createMutation.isPending}>
              Create Invoice
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}