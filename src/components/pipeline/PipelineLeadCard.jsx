import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ProjectBadge } from '@/lib/projectColors.jsx';
import SourceBadge from '@/components/shared/SourceBadge';
import WhatsAppPhone from '@/components/shared/WhatsAppPhone';
import { STAGES, DEFAULT_HEALTH_THRESHOLDS } from '@/lib/pipeline';
import { cn } from '@/lib/utils';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';

function formatTimeInStage(stageEnteredAt) {
  if (!stageEnteredAt) return '';
  const ms = Date.now() - new Date(stageEnteredAt).getTime();
  if (isNaN(ms) || ms < 0) return '';
  const minutes = ms / 60_000;
  const hours = minutes / 60;
  const days = hours / 24;
  if (days >= 7) return `${Math.floor(days / 7)}w`;
  if (days >= 1) return `${Math.floor(days)}d`;
  if (hours >= 1) return `${Math.floor(hours)}h`;
  if (minutes >= 1) return `${Math.floor(minutes)}m`;
  return 'just now';
}

function getHealthDot(stageKey, stageEnteredAt) {
  if (!stageEnteredAt) return null;
  const meta = STAGES[stageKey];
  const thresholds = (meta && meta.health_thresholds) || DEFAULT_HEALTH_THRESHOLDS;
  const hoursInStage = (Date.now() - new Date(stageEnteredAt).getTime()) / 3_600_000;
  if (isNaN(hoursInStage) || hoursInStage < 0) return null;
  if (hoursInStage < thresholds.stalling_hours) return 'green';
  if (hoursInStage < thresholds.critical_hours) return 'yellow';
  return 'red';
}

function formatCompactPrice(price, offeringType, period) {
  if (!price || typeof price !== 'number') return '';
  let num;
  if (price >= 1_000_000) {
    const m = price / 1_000_000;
    num = `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, '')}M`;
  } else if (price >= 1_000) {
    num = `${Math.round(price / 1_000)}K`;
  } else {
    num = String(price);
  }
  let suffix = '';
  if (offeringType === 'rent') {
    if (period === 'month') suffix = '/mo';
    else suffix = '/yr';
  }
  return `${num} AED${suffix}`;
}

function formatDealValue(val) {
  if (!val || val <= 0) return '';
  if (val >= 1_000_000) {
    const m = val / 1_000_000;
    return `AED ${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (val >= 1_000) return `AED ${Math.round(val / 1_000)}K`;
  return `AED ${val}`;
}

const HEALTH_DOT_COLORS = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
};

const OFFERING_BADGE_COLORS = {
  sale: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  rent: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
};

export default function PipelineLeadCard({ lead, listing, isDragging, onClick }) {
  const queryClient = useQueryClient();
  const projects = queryClient.getQueryData(['projects']) || [];
  const project = projects.find((p) => p.id === lead.project_id);
  const projectName = project?.name;
  const timeInStage = formatTimeInStage(lead.stage_entered_at || lead.created_date);
  const healthDot = getHealthDot(lead.stage, lead.stage_entered_at || lead.created_date);
  const offering = listing && listing.offering_type;
  const showOfferingBadge = offering === 'sale' || offering === 'rent';
  const price = listing && formatCompactPrice(listing.price, offering, listing.price_period);
  const hasListingBlock = listing && (listing.image_url || showOfferingBadge || price);

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-card rounded-xl p-3 border border-border cursor-pointer transition-all duration-200',
        isDragging
          ? 'shadow-xl ring-2 ring-accent/30 rotate-1'
          : 'hover:shadow-md hover:border-accent/30',
      )}
    >
      {/* Top row: avatar + name + source */}
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent shrink-0">
          {lead.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold leading-tight truncate">{lead.name || 'Unknown'}</p>
            {lead.source && (
              <span className="shrink-0">
                <SourceBadge source={lead.source} />
              </span>
            )}
          </div>
          {lead.phone && (
            <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
              <WhatsAppPhone
                phone={lead.phone}
                name={lead.name}
                leadId={lead.id}
                size="xs"
                disabled={lead.do_not_contact}
                disabledReason={lead.do_not_contact ? 'Lead is opted out of contact' : undefined}
              />
            </div>
          )}
        </div>
      </div>

      {/* Listing enrichment block (only if PFListing matched) */}
      {hasListingBlock && (
        <div className="mt-2.5 flex items-center gap-2">
          {listing.image_url && (
            <img
              src={listing.image_url}
              alt=""
              loading="lazy"
              className="w-10 h-10 rounded-lg object-cover bg-muted shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {showOfferingBadge && (
                <span
                  className={cn(
                    'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border uppercase tracking-wider',
                    OFFERING_BADGE_COLORS[offering],
                  )}
                >
                  {offering}
                </span>
              )}
              {price && <span className="text-xs font-semibold text-foreground truncate">{price}</span>}
            </div>
            {listing.title && (
              <p className="text-[10px] text-muted-foreground truncate">{listing.title}</p>
            )}
          </div>
        </div>
      )}

      {/* Project badge */}
      {projectName && (
        <div className="mt-1.5">
          <ProjectBadge name={projectName} />
        </div>
      )}

      {/* Deal value + appointment signals */}
      {(lead.deal_value_aed > 0 || lead.next_appointment_at) && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {lead.deal_value_aed > 0 && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20">
              {formatDealValue(lead.deal_value_aed)}
            </span>
          )}
          {lead.next_appointment_at && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 border border-purple-500/20 inline-flex items-center gap-0.5">
              <Calendar className="w-2.5 h-2.5" />
              {format(new Date(lead.next_appointment_at), 'MMM d')}
            </span>
          )}
        </div>
      )}
      {/* Bottom row: time in stage + health dot + docs */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">
          {timeInStage ? `In stage · ${timeInStage}` : ''}
        </span>
        <div className="flex items-center gap-1.5">
          {STAGES[lead.stage]?.required_documents?.length > 0 && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0">
              {STAGES[lead.stage].required_documents.length} docs
            </span>
          )}
          {healthDot && (
            <span
              className={cn('w-2 h-2 rounded-full shrink-0', HEALTH_DOT_COLORS[healthDot])}
              title={`Stage health: ${healthDot}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}