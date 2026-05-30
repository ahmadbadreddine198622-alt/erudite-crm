import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, TrendingUp, Users, BarChart3, AlertCircle, CreditCard, BookOpen, DollarSign, Clock, Percent, Activity } from 'lucide-react';
import InvoiceList from '@/components/finance/InvoiceList';
import AgentCommissionReport from '@/components/finance/AgentCommissionReport';
import FinancialOverview from '@/components/finance/FinancialOverview';
import FinanceAlerts from '@/components/finance/FinanceAlerts';
import InvoiceManager from '@/components/finance/InvoiceManager';
import PaymentManager from '@/components/finance/PaymentManager';
import IncomeRecordTable from '@/components/finance/IncomeRecordTable';

const TABS = [
  { id: 'overview',      label: 'Overview',       icon: BarChart3 },
  { id: 'invoices',      label: 'Invoices',       icon: FileText },
  { id: 'payments',      label: 'Payments',       icon: CreditCard },
  { id: 'income',        label: 'Income Records', icon: BookOpen },
  { id: 'commissions',   label: 'Commissions',    icon: TrendingUp },
  { id: 'alerts',        label: 'Alerts',         icon: AlertCircle },
];

export default function Finance() {
  const [activeTab, setActiveTab] = useState('overview');

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 500),
  });
  const { data: commissions = [] } = useQuery({
    queryKey: ['commissions'],
    queryFn: () => base44.entities.Commission.list('-created_date', 500),
  });
  
  // Management intelligence calculations
  const financeMetrics = React.useMemo(() => {
    const activeInv = invoices.filter(i => i.payment_status !== 'cancelled');
    const totalReceivable = activeInv.filter(i => ['pending', 'partial', 'overdue'].includes(i.payment_status)).reduce((s, i) => s + (i.total_amount_aed || 0), 0);
    const totalPaid = activeInv.filter(i => i.payment_status === 'paid').reduce((s, i) => s + (i.total_amount_aed || 0), 0);
    const overdue = activeInv.filter(i => i.payment_status === 'overdue').reduce((s, i) => s + (i.total_amount_aed || 0), 0);
    const collectionRate = totalPaid + totalReceivable > 0 ? (totalPaid / (totalPaid + totalReceivable)) * 100 : 0;
    const avgDaysOutstanding = (() => {
      const outstanding = activeInv.filter(i => ['pending', 'partial', 'overdue'].includes(i.payment_status) && i.created_date);
      if (outstanding.length === 0) return 0;
      const now = new Date().getTime();
      const totalDays = outstanding.reduce((sum, i) => sum + ((now - new Date(i.created_date).getTime()) / (1000 * 60 * 60 * 24)), 0);
      return Math.round(totalDays / outstanding.length);
    })();
    return { totalReceivable, totalPaid, overdue, collectionRate, avgDaysOutstanding };
  }, [invoices]);
  const { data: leads = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Lead.list('-created_date', 500),
  });
  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list('-created_date', 200),
  });

  return (
    <div
      className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6 min-h-screen"
      style={{
        background: 'radial-gradient(ellipse at 30% 10%, rgba(20,30,60,0.55) 0%, rgba(8,11,18,0.92) 45%, rgba(6,8,14,0.98) 100%)',
      }}
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img
            src="https://media.base44.com/images/public/69cabceaeeb8bb5e3a62ead3/af0e24497_EruditeLogoblack-Recovered2.png"
            alt="Erudite Property"
            className="h-12 w-auto object-contain"
          />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Financial Engine</h1>
            <p className="text-sm text-muted-foreground">Invoices · VAT · Commissions · Revenue Reporting</p>
          </div>
        </div>
      </div>

      {/* Management Intelligence Strip */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div
          className="rounded-xl p-3"
          style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Total Receivable</span>
          </div>
          <p className="text-2xl font-bold truncate" style={{ color: 'hsl(38 92% 50%)' }}>
            {financeMetrics.totalReceivable >= 1_000_000 ? `AED ${(financeMetrics.totalReceivable / 1_000_000).toFixed(1)}M` : financeMetrics.totalReceivable >= 1_000 ? `AED ${(financeMetrics.totalReceivable / 1_000).toFixed(0)}K` : `AED ${financeMetrics.totalReceivable}`}
          </p>
        </div>
        <div
          className="rounded-xl p-3"
          style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Avg DSO</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{financeMetrics.avgDaysOutstanding}d</p>
        </div>
        <div
          className="rounded-xl p-3"
          style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Collection Rate</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{financeMetrics.collectionRate.toFixed(1)}%</p>
        </div>
        <div
          className="rounded-xl p-3"
          style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Percent className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Overdue %</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>
            {financeMetrics.totalReceivable > 0 ? ((financeMetrics.overdue / financeMetrics.totalReceivable) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all -mb-px"
              style={{
                borderBottom: activeTab === tab.id ? '2px solid hsl(38 92% 50%)' : '2px solid transparent',
                color: activeTab === tab.id ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.65)',
              }}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <FinancialOverview invoices={invoices} commissions={commissions} />
      )}
      {activeTab === 'invoices' && (
        <InvoiceManager />
      )}
      {activeTab === 'payments' && (
        <PaymentManager />
      )}
      {activeTab === 'income' && (
        <IncomeRecordTable />
      )}
      {activeTab === 'commissions' && (
        <AgentCommissionReport commissions={commissions} invoices={invoices} />
      )}
      {activeTab === 'alerts' && (
        <FinanceAlerts invoices={invoices} commissions={commissions} leads={leads} />
      )}
    </div>
  );
}