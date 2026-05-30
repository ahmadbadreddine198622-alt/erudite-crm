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

function getHealthColor(stageKey, stageEnteredAt) {
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

const OFFERING_BADGE_COLORS = {
  sale: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  rent: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

export default function PipelineLeadCard({ lead, listing, isDragging, onClick }) {
  const queryClient = useQueryClient();
  const projects = queryClient.getQueryData(['projects']) || [];
  const project = projects.find((p) => p.id === lead.project_id);
  const projectName = project?.name;
  const timeInStage = formatTimeInStage(lead.stage_entered_at || lead.created_date);
  const healthColor = getHealthColor(lead.stage, lead.stage_entered_at || lead.created_date);
  const offering = listing && listing.offering_type;
  const showOfferingBadge = offering === 'sale' || offering === 'rent';
  const price = listing && formatCompactPrice(listing.price, offering, listing.price_period);
  const hasListingBlock = listing && (listing.image_url || showOfferingBadge || price);

  // Health status mapping
  const healthStatus = healthColor === 'green' ? 'active' : healthColor === 'yellow' ? 'attention' : healthColor === 'red' ? 'stalled' : null;
  const healthColors = { active: 'bg-emerald-500', attention: 'bg-amber-500', stalled: 'bg-red-500' };

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl p-4 cursor-pointer transition-all duration-200',
      )}
      style={{
        background: isDragging ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.07)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: isDragging ? '2px solid rgba(245,159,10,0.6)' : '1px solid rgba(255,255,255,0.12)',
        borderTopColor: isDragging ? 'rgba(245,159,10,0.8)' : 'rgba(255,255,255,0.18)',
        boxShadow: isDragging
          ? '0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(245,159,10,0.15)'
          : '0 4px 16px rgba(0,0,0,0.4)',
        transform: isDragging ? 'scale(1.03)' : 'scale(1)',
      }}
    >
      {/* Top row: health status + avatar + name */}
      <div className="flex items-start gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-sm font-bold text-accent shrink-0">
          {lead.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-base font-bold leading-tight truncate" style={{ color: 'rgba(255,255,255,0.95)' }}>{lead.name || 'Unknown'}</p>
            {healthStatus && (
              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${healthColors[healthStatus]} text-white`}>
                {healthStatus}
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

      {/* LEVEL 2: Deal Value (dominant business metric) */}
      {lead.deal_value_aed > 0 && (
        <div className="mb-2">
          <p className="text-lg font-bold" style={{ color: 'hsl(38 92% 50%)' }}>
            {formatDealValue(lead.deal_value_aed)}
          </p>
        </div>
      )}

      {/* LEVEL 3: Property / Project */}
      {projectName && (
        <div className="mb-2">
          <ProjectBadge name={projectName} />
        </div>
      )}

      {/* Listing enrichment (only if PFListing matched) */}
      {hasListingBlock && (
        <div className="mb-2 flex items-center gap-2">
          {listing.image_url && (
            <img
              src={listing.image_url}
              alt=""
              loading="lazy"
              className="w-12 h-12 rounded-xl object-cover bg-muted shrink-0 border border-white/10"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            {listing.title && (
              <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>{listing.title}</p>
            )}
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {showOfferingBadge && (
                <span
                  className={cn(
                    'inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider',
                    OFFERING_BADGE_COLORS[offering],
                  )}
                >
                  {offering}
                </span>
              )}
              {price && <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>{price}</span>}
            </div>
          </div>
        </div>
      )}

      {/* LEVEL 4: Next Appointment + Days in Stage */}
      {(lead.next_appointment_at || timeInStage) && (
        <div className="mb-2 flex items-center gap-2 flex-wrap">
          {lead.next_appointment_at && (
            <span className="text-xs font-medium px-2 py-1 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/25 inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {format(new Date(lead.next_appointment_at), 'MMM d, h:mm a')}
            </span>
          )}
          {timeInStage && (
            <span className="text-xs font-medium px-2 py-1 rounded-lg bg-white/5 text-white/60 border border-white/10">
              {timeInStage} in stage
            </span>
          )}
        </div>
      )}

      {/* LEVEL 5: Source + Tags */}
      <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-white/8">
        {lead.source && (
          <SourceBadge source={lead.source} />
        )}
        {STAGES[lead.stage]?.required_documents?.length > 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/25 shrink-0">
            {STAGES[lead.stage].required_documents.length} docs
          </span>
        )}
      </div>
    </div>
  );
}