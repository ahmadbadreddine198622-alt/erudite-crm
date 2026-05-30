import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, DollarSign, TrendingUp, Clock, CheckCircle2, Wallet, PiggyBank, Coins } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { format } from 'date-fns';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import { formatAED } from '@/lib/constants';
import { cn } from '@/lib/utils';

const statusStyles = {
  pending: 'bg-amber-500/10 text-amber-600',
  approved: 'bg-blue-500/10 text-blue-600',
  paid: 'bg-emerald-500/10 text-emerald-600',
  cancelled: 'bg-red-500/10 text-red-600',
};

export default function Commissions() {
  const [showAdd, setShowAdd] = useState(false);
  const queryClient = useQueryClient();

  const { data: commissions = [] } = useQuery({
    queryKey: ['commissions'],
    queryFn: () => base44.entities.Commission.list('-created_date', 200),
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 500),
  });

  const totalPending = commissions.filter(c => c.status === 'pending').reduce((s, c) => s + (c.commission_amount_aed || 0), 0);
  const totalPaid = commissions.filter(c => c.status === 'paid').reduce((s, c) => s + (c.commission_amount_aed || 0), 0);
  const totalApproved = commissions.filter(c => c.status === 'approved').reduce((s, c) => s + (c.commission_amount_aed || 0), 0);
  const totalDeals = commissions.filter(c => c.status !== 'cancelled').length;
  const totalPipeline = commissions.filter(c => ['pending', 'approved'].includes(c.status)).reduce((s, c) => s + (c.commission_amount_aed || 0), 0);
  const avgDealSize = totalDeals > 0 ? (totalPending + totalApproved + totalPaid) / totalDeals : 0;

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Commission.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['commissions'] }),
  });

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Commissions" subtitle="Deal tracking and earnings intelligence">
        <Button size="sm" onClick={() => setShowAdd(true)} style={{ background: 'hsl(38 92% 50%)', color: 'hsl(222 47% 11%)', border: 'none' }}>
          <Plus className="w-4 h-4 mr-1" /> Add Commission
        </Button>
      </PageHeader>

      {/* Management Intelligence Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div
          className="rounded-xl p-4"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Total Deals</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>{totalDeals}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Active commissions</p>
        </div>
        
        <div
          className="rounded-xl p-4"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Pending</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{formatAED(totalPending)}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Awaiting approval</p>
        </div>
        
        <div
          className="rounded-xl p-4"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Approved</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{formatAED(totalApproved)}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Ready for payment</p>
        </div>
        
        <div
          className="rounded-xl p-4"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Paid Out</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{formatAED(totalPaid)}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Total earnings</p>
        </div>
        
        <div
          className="rounded-xl p-4"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Pipeline</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{formatAED(totalPipeline)}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Pending + Approved</p>
        </div>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ background: 'rgba(8,11,18,0.75)', borderBottom: '2px solid rgba(245,159,10,0.2)' }}>
                <TableHead className="text-xs" style={{ color: 'hsl(38 92% 50%)' }}>Agent</TableHead>
                <TableHead className="text-xs" style={{ color: 'hsl(38 92% 50%)' }}>Deal Value</TableHead>
                <TableHead className="text-xs" style={{ color: 'hsl(38 92% 50%)' }}>Rate</TableHead>
                <TableHead className="text-xs" style={{ color: 'hsl(38 92% 50%)' }}>Commission</TableHead>
                <TableHead className="text-xs" style={{ color: 'hsl(38 92% 50%)' }}>Type</TableHead>
                <TableHead className="text-xs" style={{ color: 'hsl(38 92% 50%)' }}>Status</TableHead>
                <TableHead className="text-xs" style={{ color: 'hsl(38 92% 50%)' }}>Date</TableHead>
                <TableHead className="text-xs" style={{ color: 'hsl(38 92% 50%)' }}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.map(c => (
                <TableRow key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <TableCell className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.95)' }}>{c.agent_name || 'Unassigned'}</TableCell>
                  <TableCell className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{formatAED(c.deal_value_aed)}</TableCell>
                  <TableCell className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{c.commission_rate}%</TableCell>
                  <TableCell className="text-sm font-semibold" style={{ color: 'hsl(38 92% 50%)' }}>{formatAED(c.commission_amount_aed)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="text-[10px] capitalize"
                      style={{
                        background: c.deal_type === 'sale' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
                        border: `1px solid ${c.deal_type === 'sale' ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}`,
                        color: c.deal_type === 'sale' ? 'rgba(16,185,129,0.95)' : 'rgba(59,130,246,0.95)',
                      }}
                    >
                      {c.deal_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className="text-[10px] capitalize"
                      style={{
                        background: statusStyles[c.status]?.split(' ')[0] || 'rgba(255,255,255,0.1)',
                        color: statusStyles[c.status]?.split(' ')[1] || 'rgba(255,255,255,0.7)',
                        border: '1px solid transparent',
                      }}
                    >
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {c.closing_date && format(new Date(c.closing_date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Select value={c.status} onValueChange={(v) => updateStatus.mutate({ id: c.id, status: v })}>
                      <SelectTrigger
                        className="h-7 w-28 text-xs"
                        style={{
                          background: 'rgba(255,255,255,0.07)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          color: 'rgba(255,255,255,0.95)',
                        }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {commissions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    No commissions recorded yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AddCommissionDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        leads={leads}
      />
    </div>
  );
}

function AddCommissionDialog({ open, onClose, leads }) {
  const [form, setForm] = useState({
    lead_id: '', agent_name: '', deal_value_aed: '', commission_rate: '2',
    deal_type: 'sale', closing_date: '', notes: '',
  });
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Commission.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const dealValue = Number(form.deal_value_aed) || 0;
    const rate = Number(form.commission_rate) || 0;
    createMutation.mutate({
      ...form,
      deal_value_aed: dealValue,
      commission_rate: rate,
      commission_amount_aed: dealValue * (rate / 100),
      status: 'pending',
    });
  };

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e?.target?.value ?? e }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Commission</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Lead</Label>
            <Select value={form.lead_id} onValueChange={set('lead_id')}>
              <SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger>
              <SelectContent>
                {leads.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Agent Name</Label>
            <Input value={form.agent_name} onChange={set('agent_name')} placeholder="Agent name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Deal Value (AED)</Label>
              <Input value={form.deal_value_aed} onChange={set('deal_value_aed')} type="number" required />
            </div>
            <div>
              <Label>Commission Rate (%)</Label>
              <Input value={form.commission_rate} onChange={set('commission_rate')} type="number" step="0.1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <Label>Closing Date</Label>
              <Input value={form.closing_date} onChange={set('closing_date')} type="date" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={createMutation.isPending}>
              Add Commission
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}