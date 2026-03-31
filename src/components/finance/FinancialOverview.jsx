import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, Receipt, TrendingUp, Percent } from 'lucide-react';
import { formatAED } from '@/lib/constants';

const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444'];

export default function FinancialOverview({ invoices, commissions }) {
  const metrics = useMemo(() => {
    const activeInv = invoices.filter(i => i.payment_status !== 'cancelled');
    const totalRevenue = activeInv.reduce((s, i) => s + (i.total_amount_aed || 0), 0);
    const totalBase = activeInv.reduce((s, i) => s + (i.base_amount_aed || 0), 0);
    const totalVAT = activeInv.reduce((s, i) => s + (i.vat_amount_aed || 0), 0);
    const totalPaid = activeInv.filter(i => i.payment_status === 'paid').reduce((s, i) => s + (i.total_amount_aed || 0), 0);
    const totalOutstanding = activeInv.filter(i => ['pending', 'partial', 'overdue'].includes(i.payment_status)).reduce((s, i) => s + (i.total_amount_aed || 0), 0);
    const totalCommissions = commissions.filter(c => c.status !== 'cancelled').reduce((s, c) => s + (c.commission_amount_aed || 0), 0);

    // Monthly revenue (last 6 months)
    const now = new Date();
    const monthly = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      monthly[key] = { name: key, revenue: 0, vat: 0 };
    }
    activeInv.forEach(inv => {
      const d = new Date(inv.created_date);
      const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      if (monthly[key]) {
        monthly[key].revenue += inv.base_amount_aed || 0;
        monthly[key].vat += inv.vat_amount_aed || 0;
      }
    });

    // Invoice type breakdown
    const byType = {};
    activeInv.forEach(i => { byType[i.invoice_type] = (byType[i.invoice_type] || 0) + (i.total_amount_aed || 0); });

    return {
      totalRevenue, totalBase, totalVAT, totalPaid, totalOutstanding, totalCommissions,
      monthly: Object.values(monthly),
      byType: Object.entries(byType).map(([name, value]) => ({ name, value })),
    };
  }, [invoices, commissions]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: formatAED(metrics.totalRevenue), sub: `Base: ${formatAED(metrics.totalBase)}`, icon: DollarSign, color: 'text-accent' },
          { label: 'VAT Collected (5%)', value: formatAED(metrics.totalVAT), sub: 'Tax liability', icon: Percent, color: 'text-blue-600' },
          { label: 'Paid Invoices', value: formatAED(metrics.totalPaid), sub: 'Collected', icon: Receipt, color: 'text-emerald-600' },
          { label: 'Outstanding', value: formatAED(metrics.totalOutstanding), sub: 'Pending + overdue', icon: TrendingUp, color: 'text-red-500' },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{k.label}</p>
                  <p className={`text-xl font-bold mt-1 ${k.color}`}>{k.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{k.sub}</p>
                </div>
                <k.icon className={`w-5 h-5 ${k.color} opacity-70`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm">Monthly Revenue & VAT (Last 6 Months)</CardTitle></CardHeader>
          <CardContent>
            {metrics.monthly.some(m => m.revenue > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={metrics.monthly} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v, n) => [formatAED(v), n === 'revenue' ? 'Base Revenue' : 'VAT']} />
                  <Bar dataKey="revenue" fill="#f59e0b" name="revenue" radius={[4,4,0,0]} />
                  <Bar dataKey="vat" fill="#3b82f6" name="vat" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">No invoice data yet</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Revenue by Type</CardTitle></CardHeader>
          <CardContent>
            {metrics.byType.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={metrics.byType} cx="50%" cy="50%" outerRadius={85} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {metrics.byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => formatAED(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">No data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* VAT Summary Box */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-3">
            <Percent className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-blue-800">VAT Compliance Summary</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Taxable Base</p>
              <p className="font-bold text-blue-700">{formatAED(metrics.totalBase)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">VAT Due (5%)</p>
              <p className="font-bold text-blue-700">{formatAED(metrics.totalVAT)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Incl. VAT</p>
              <p className="font-bold text-blue-700">{formatAED(metrics.totalRevenue)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}