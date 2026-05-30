import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, Receipt, TrendingUp, Percent } from 'lucide-react';
import { formatAED } from '@/lib/constants';

const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444'];

const GLASS = {
  background: 'rgba(255,255,255,0.035)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderTopColor: 'rgba(255,255,255,0.14)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
};

const TOOLTIP_STYLE = {
  background: 'rgba(8,11,18,0.92)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: 'rgba(255,255,255,0.85)',
};

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

  const kpis = [
    { label: 'Total Revenue', value: formatAED(metrics.totalRevenue), sub: `Base: ${formatAED(metrics.totalBase)}`, icon: DollarSign, color: 'hsl(38 92% 50%)' },
    { label: 'VAT Collected (5%)', value: formatAED(metrics.totalVAT), sub: 'Tax liability', icon: Percent, color: '#60a5fa' },
    { label: 'Paid Invoices', value: formatAED(metrics.totalPaid), sub: 'Collected', icon: Receipt, color: '#34d399' },
    { label: 'Outstanding', value: formatAED(metrics.totalOutstanding), sub: 'Pending + overdue', icon: TrendingUp, color: '#f87171' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl p-5" style={GLASS}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>{k.label}</p>
                <p className="text-xl font-bold mt-1" style={{ color: k.color, fontVariantNumeric: 'tabular-nums' }}>{k.value}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{k.sub}</p>
              </div>
              <k.icon className="w-5 h-5 opacity-60" style={{ color: k.color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl p-5" style={GLASS}>
          <p className="text-sm font-medium mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>Monthly Revenue &amp; VAT (Last 6 Months)</p>
          {metrics.monthly.some(m => m.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={metrics.monthly} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                <XAxis dataKey="name" fontSize={11} tick={{ fill: 'rgba(255,255,255,0.4)' }} />
                <YAxis fontSize={11} tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fill: 'rgba(255,255,255,0.4)' }} />
                <Tooltip
                  formatter={(v, n) => [formatAED(v), n === 'revenue' ? 'Base Revenue' : 'VAT']}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Bar dataKey="revenue" fill="hsl(38 92% 50%)" name="revenue" radius={[4,4,0,0]} />
                <Bar dataKey="vat" fill="#60a5fa" name="vat" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No invoice data yet</div>
          )}
        </div>

        <div className="rounded-xl p-5" style={GLASS}>
          <p className="text-sm font-medium mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>Revenue by Type</p>
          {metrics.byType.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={metrics.byType} cx="50%" cy="50%" outerRadius={85} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {metrics.byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => formatAED(v)} contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No data</div>
          )}
        </div>
      </div>

      {/* VAT Summary Box */}
      <div
        className="rounded-xl p-5"
        style={{
          background: 'rgba(59,130,246,0.08)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(59,130,246,0.20)',
          borderTopColor: 'rgba(59,130,246,0.30)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Percent className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-blue-300">VAT Compliance Summary</h3>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Taxable Base</p>
            <p className="font-bold text-blue-300" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatAED(metrics.totalBase)}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>VAT Due (5%)</p>
            <p className="font-bold text-blue-300" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatAED(metrics.totalVAT)}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Total Incl. VAT</p>
            <p className="font-bold text-blue-300" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatAED(metrics.totalRevenue)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}