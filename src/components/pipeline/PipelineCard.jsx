import React from 'react';
import { Phone, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import LeadScoreBadge from '@/components/shared/LeadScoreBadge';
import SourceBadge from '@/components/shared/SourceBadge';
import StageHealthBadge from '@/components/pipeline/StageHealthBadge';
import { formatAED } from '@/lib/constants';

export default function PipelineCard({ lead, isDragging, onClick }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card rounded-xl p-3.5 border border-border cursor-pointer transition-all duration-200",
        isDragging ? "shadow-xl ring-2 ring-accent/30 rotate-1" : "hover:shadow-md hover:border-accent/30"
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">
            {lead.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{lead.name}</p>
            {lead.phone && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Phone className="w-2.5 h-2.5" /> {lead.phone}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {lead.source && <SourceBadge source={lead.source} />}
        <LeadScoreBadge score={lead.lead_score} />
        <StageHealthBadge lead={lead} />
      </div>

      {lead.budget_aed && (
        <p className="text-xs font-medium text-accent mb-1.5">{formatAED(lead.budget_aed)}</p>
      )}

      {lead.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {lead.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
              {tag}
            </span>
          ))}
        </div>
      )}

      {lead.next_follow_up && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
          <Clock className="w-3 h-3" />
          Follow up: {format(new Date(lead.next_follow_up), 'MMM d')}
        </div>
      )}
    </div>
  );
}