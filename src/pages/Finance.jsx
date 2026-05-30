import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, TrendingUp, Users, BarChart3, AlertCircle, CreditCard, BookOpen } from 'lucide-react';
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
  const { data: leads = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Lead.list('-created_date', 500),
  });
  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list('-created_date', 200),
  });

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
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