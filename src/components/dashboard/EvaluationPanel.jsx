import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, Phone } from 'lucide-react';
import { Button } from "@/components/ui/button";

const TABS = ['Outreach', 'Qualify', 'Calls', 'Overview', 'Unit', 'Negotiation', 'Documents'];

const QUALIFICATION_FIELDS = [
  { label: 'Motivation', key: 'motivation' },
  { label: 'Timeline / Urgency', key: 'timeline_urgency' },
  { label: 'Price Expectation', key: 'price_expectation_aed' },
  { label: 'Price vs Valuation', key: 'price_vs_valuation' },
  { label: 'Mandate Openness', key: 'mandate_openness' },
  { label: 'Decision Maker', key: 'is_decision_maker' },
  { label: 'Tenancy', key: 'tenancy_status' },
  { label: 'Mortgage', key: 'mortgage_status' },
  { label: 'Call Outcome', key: 'call_outcome' },
  { label: 'Next Step', key: 'next_step' },
  { label: 'Follow-up', key: 'followup_date' },
];

const formatValue = (value, key) => {
  if (!value) return '—';
  if (key.includes('price') && typeof value === 'number') {
    return 'AED ' + value.toLocaleString();
  }
  if (key.includes('date')) {
    return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return String(value).replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

export default function EvaluationPanel({ landlords = [], onUploadFormA }) {
  const [activeTab, setActiveTab] = React.useState('Qualify');
  
  // Fetch latest CallQualification for the first landlord in the list
  const landlordId = landlords[0]?.id;
  const { data: qualifications = [] } = useQuery({
    queryKey: ['call-qualifications', landlordId],
    queryFn: () => landlordId ? base44.entities.CallQualification.filter({ landlord_id: landlordId }, '-call_date', 1) : Promise.resolve([]),
    enabled: !!landlordId,
  });
  
  const latestQualification = qualifications[0];

  const qualificationData = latestQualification ? {
    motivation: latestQualification.motivation || '—',
    timeline_urgency: latestQualification.timeline_urgency || '—',
    price_expectation_aed: latestQualification.price_expectation_aed,
    price_vs_valuation: latestQualification.price_vs_valuation || '—',
    mandate_openness: latestQualification.mandate_openness || '—',
    is_decision_maker: latestQualification.is_decision_maker || '—',
    tenancy_status: latestQualification.tenancy_status || '—',
    mortgage_status: latestQualification.mortgage_status || '—',
    call_outcome: latestQualification.call_outcome || '—',
    next_step: latestQualification.next_step || '—',
    followup_date: latestQualification.followup_date || '—',
  } : null;

  return (
    <div className="w-full max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Documents & Mandate
          </h2>
        </div>
        <Button
          size="sm"
          onClick={onUploadFormA}
          className="h-8 text-xs gap-1"
          style={{
            background: 'hsl(38 92% 50% / 0.14)',
            border: '1px solid hsl(38 92% 50% / 0.45)',
            color: 'hsl(38 92% 62%)',
          }}
        >
          <FileText className="w-3.5 h-3.5" />
          Upload Form A
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === tab ? 'border' : 'border border-white/10'
            }`}
            style={{
              background: activeTab === tab ? 'hsl(38 92% 50% / 0.14)' : 'transparent',
              border: activeTab === tab ? '1px solid hsl(38 92% 50% / 0.4)' : '1px solid rgba(255,255,255,0.09)',
              color: activeTab === tab ? 'hsl(38 92% 62%)' : 'rgba(255,255,255,0.55)',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Qualification Grid */}
      {activeTab === 'Qualify' && qualificationData && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {QUALIFICATION_FIELDS.map((field, idx) => (
            <div
              key={field.key}
              className="rounded-xl p-3 border"
              style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <p className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {field.label}
              </p>
              <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                {formatValue(qualificationData[field.key], field.key)}
              </p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'Qualify' && !qualificationData && (
        <div className="text-center py-12 rounded-xl border border-dashed" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <p className="text-sm text-muted-foreground">No qualification data yet</p>
        </div>
      )}

      {activeTab !== 'Qualify' && (
        <div className="text-center py-12 rounded-xl border border-dashed" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <p className="text-sm text-muted-foreground">{activeTab} tab content coming soon</p>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="flex items-center justify-between mt-4">
        <div className="w-8 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            className="h-9 w-9 rounded-full p-0"
            style={{
              background: 'hsl(38 92% 50% / 0.15)',
              border: '1px solid hsl(38 92% 50% / 0.3)',
              color: 'hsl(38 92% 55%)',
            }}
          >
            <Phone className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}