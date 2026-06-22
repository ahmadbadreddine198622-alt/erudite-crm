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

import { useNavigate } from 'react-router-dom';

function FormACard({ form }) {
  const navigate = useNavigate();
  const statusColor = STATUS_COLORS[form.status] || 'bg-muted text-muted-foreground';
  const landlordName = form.landlord_name || form.owner_name || 'Unknown';

  return (
    <div 
      className="bg-card border border-border rounded-xl p-4 transition-all hover:border-accent/30 cursor-pointer"
      onClick={() => form.landlord_id && navigate(`/landlord/${form.landlord_id}`)}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold text-foreground">{landlordName}</p>
          <p className="text-xs text-muted-foreground">{form.unit} · {form.broker_office}</p>
        </div>
        {form.status && <Badge className={`text-xs ${statusColor}`}>{form.status}</Badge>}
      </div>
      
      <div className="space-y-2 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Contract:</span>
          <span className="font-mono text-foreground">{form.contract_number}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Asking Price:</span>
          <span className="font-semibold text-foreground">{form.asking_price_aed ? `AED ${form.asking_price_aed.toLocaleString()}` : 'N/A'}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Commission:</span>
          <span className="font-semibold text-accent">{form.commission_pct ? `${form.commission_pct}%` : 'N/A'}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Mandate Type:</span>
          <span className="text-foreground capitalize">{form.mandate_type?.replace('_', ' ') || 'N/A'}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Expires:</span>
          <span className="text-foreground">{form.mandate_expires_at ? new Date(form.mandate_expires_at).toLocaleDateString('en-GB') : 'N/A'}</span>
        </div>
      </div>
      
      {form.pdf_url && (
        <a 
          href={form.pdf_url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex items-center gap-1.5 text-accent text-xs mt-3 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3" /> View PDF
        </a>
      )}
    </div>
  );
}

export default function FormADashboardWidget({ forms = [] }) {
  if (!forms || forms.length === 0) {
    return (
      <div className="w-full">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent" />
          Recent Form A Contracts
        </h3>
        <p className="text-xs text-muted-foreground text-center py-8">No Form A records found.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <FileText className="w-4 h-4 text-accent" />
        Recent Form A Contracts
      </h3>
      <div className="space-y-3">
        {forms.map(form => <FormACard key={form.id} form={form} />)}
      </div>
    </div>
  );
}