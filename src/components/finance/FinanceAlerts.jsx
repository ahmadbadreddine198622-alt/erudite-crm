import React from 'react';
import { AlertTriangle, Clock, Receipt, Users, CheckCircle2 } from 'lucide-react';
import { formatAED } from '@/lib/constants';
import { format, isPast } from 'date-fns';

export default function FinanceAlerts({ invoices, commissions, leads }) {
  const alerts = [];

  // Unpaid / overdue invoices
  const overdueInv = invoices.filter(inv =>
    inv.due_date && isPast(new Date(inv.due_date)) && ['pending', 'partial'].includes(inv.payment_status)
  );
  if (overdueInv.length > 0) {
    alerts.push({
      type: 'overdue',
      severity: 'critical',
      icon: Clock,
      title: `${overdueInv.length} Overdue Invoice${overdueInv.length > 1 ? 's' : ''}`,
      body: overdueInv.map(i => `${i.invoice_number} — ${formatAED(i.total_amount_aed)} (due ${i.due_date && format(new Date(i.due_date), 'MMM d')})`).join('\n'),
      total: overdueInv.reduce((s, i) => s + (i.total_amount_aed || 0), 0),
    });
  }

  // Pending invoices (not overdue)
  const pendingInv = invoices.filter(inv =>
    inv.payment_status === 'pending' && (!inv.due_date || !isPast(new Date(inv.due_date)))
  );
  if (pendingInv.length > 0) {
    alerts.push({
      type: 'pending',
      severity: 'warning',
      icon: Receipt,
      title: `${pendingInv.length} Pending Invoice${pendingInv.length > 1 ? 's' : ''}`,
      body: `Total outstanding: ${formatAED(pendingInv.reduce((s, i) => s + (i.total_amount_aed || 0), 0))}`,
    });
  }

  // Commissions without invoices
  const commWithoutInvoice = commissions.filter(c => {
    if (['cancelled'].includes(c.status)) return false;
    return !invoices.some(inv => inv.commission_id === c.id || (inv.lead_id === c.lead_id && inv.agent_email === c.agent_email));
  });
  if (commWithoutInvoice.length > 0) {
    alerts.push({
      type: 'no_invoice',
      severity: 'warning',
      icon: AlertTriangle,
      title: `${commWithoutInvoice.length} Commission${commWithoutInvoice.length > 1 ? 's' : ''} Without Invoice`,
      body: `These commissions are missing linked invoices. Create invoices to ensure proper VAT tracking.`,
    });
  }

  // Invoices missing VAT
  const noVAT = invoices.filter(i => !i.vat_amount_aed && i.payment_status !== 'cancelled');
  if (noVAT.length > 0) {
    alerts.push({
      type: 'no_vat',
      severity: 'critical',
      icon: AlertTriangle,
      title: `${noVAT.length} Invoice${noVAT.length > 1 ? 's' : ''} Missing VAT`,
      body: `These invoices were created without VAT calculation. Review for compliance.`,
    });
  }

  // Commissions not assigned
  const unassignedComm = commissions.filter(c => !c.agent_email && !c.agent_name && c.status !== 'cancelled');
  if (unassignedComm.length > 0) {
    alerts.push({
      type: 'unassigned',
      severity: 'medium',
      icon: Users,
      title: `${unassignedComm.length} Commission${unassignedComm.length > 1 ? 's' : ''} Without Agent`,
      body: 'Assign agents to these commissions for proper performance tracking.',
    });
  }

  const SEVERITY = {
    critical: { bg: 'bg-red-50 border-red-200', icon: 'text-red-500', badge: 'text-red-600 bg-red-100' },
    warning:  { bg: 'bg-amber-50 border-amber-200', icon: 'text-amber-500', badge: 'text-amber-600 bg-amber-100' },
    medium:   { bg: 'bg-blue-50 border-blue-200', icon: 'text-blue-500', badge: 'text-blue-600 bg-blue-100' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Financial Alerts</h3>
        {alerts.length === 0 && (
          <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> All clear
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="p-8 border border-emerald-200 bg-emerald-50 rounded-xl text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="font-semibold text-emerald-700">No financial alerts</p>
          <p className="text-sm text-emerald-600 mt-1">All invoices are properly tracked and VAT compliant.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, i) => {
            const style = SEVERITY[alert.severity];
            const Icon = alert.icon;
            return (
              <div key={i} className={`p-4 border rounded-xl ${style.bg}`}>
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 ${style.icon} shrink-0 mt-0.5`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold">{alert.title}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${style.badge}`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-line">{alert.body}</p>
                    {alert.total && (
                      <p className="text-sm font-bold text-red-600 mt-1">Total at risk: {formatAED(alert.total)}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}