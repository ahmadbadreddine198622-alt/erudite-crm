import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const STATUS_COLORS = {
  Active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  Expired: 'bg-red-500/15 text-red-400 border-red-500/25',
  Draft: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
};

function FormACard({ form }) {
  const statusColor = STATUS_COLORS[form.status] || 'bg-muted text-muted-foreground';

  return (
    <div className="bg-card border border-border rounded-xl p-4 transition-all hover:border-accent/30">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-foreground">{form.owner_name}</p>
          <p className="text-xs text-muted-foreground">{form.broker_office}</p>
        </div>
        {form.status && <Badge className={`text-xs ${statusColor}`}>{form.status}</Badge>}
      </div>
      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Contract:</span>
          <span className="font-mono text-foreground">{form.contract_number}</span>
        </div>
        <div className="flex justify-between">
          <span>Price:</span>
          <span className="font-medium text-foreground">{form.sell_price_aed ? `AED ${form.sell_price_aed.toLocaleString()}` : 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span>Expires:</span>
          <span className="font-medium text-foreground">{form.end_date ? new Date(form.end_date).toLocaleDateString('en-GB') : 'N/A'}</span>
        </div>
      </div>
      {form.pdf_url && (
        <a href={form.pdf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-accent text-xs mt-3 hover:underline">
          View PDF <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

export default function FormADashboardWidget() {
  const { data: forms = [], isLoading } = useQuery({
    queryKey: ['form-a-dashboard'],
    queryFn: () => base44.entities.FormA.list('-created_date', 5),
  });

  if (isLoading) {
    return <div>Loading Form A data...</div>;
  }

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <FileText className="w-4 h-4 text-accent" />
        Recent Form A Contracts
      </h3>
      {forms.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">No Form A records found.</p>
      ) : (
        <div className="space-y-3">
          {forms.map(form => <FormACard key={form.id} form={form} />)}
        </div>
      )}
    </div>
  );
}