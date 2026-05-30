import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { BookOpen } from 'lucide-react';

const STATUS_COLORS = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  recognized: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  reconciled: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

export default function IncomeRecordTable() {
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['income-records'],
    queryFn: () => base44.entities.IncomeRecord.list('-created_date', 500),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices-live'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 500),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const invoiceMap = Object.fromEntries(invoices.map(i => [i.id, i.invoice_number || i.id]));
  const agentMap = Object.fromEntries(users.map(u => [u.id, u.full_name || u.email]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Income Records</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Auto-generated when payments are recorded</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : records.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>No income records yet — they appear automatically when payments are recorded</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                {['Invoice', 'Agent', 'Recognized (AED)', 'Period', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map(r => (
                <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-mono">{invoiceMap[r.invoice_id] || r.invoice_id || '—'}</td>
                  <td className="px-4 py-3">{agentMap[r.agent_id] || r.agent_id || '—'}</td>
                  <td className="px-4 py-3 font-medium">{r.recognized_amount?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono">{r.period || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs border ${STATUS_COLORS[r.status] || ''}`}>
                      {r.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}