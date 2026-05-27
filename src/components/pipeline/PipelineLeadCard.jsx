import React from 'react';
import SourceBadge from '@/components/shared/SourceBadge';
import WhatsAppPhone from '@/components/shared/WhatsAppPhone';
import { STAGES, DEFAULT_HEALTH_THRESHOLDS } from '@/lib/pipeline';
import { cn } from '@/lib/utils';

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

      {/* Bottom row: time in stage + health dot */}
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {timeInStage ? `In stage · ${timeInStage}` : ''}
        </span>
        {healthDot && (
          <span
            className={cn('w-2 h-2 rounded-full shrink-0', HEALTH_DOT_COLORS[healthDot])}
            title={`Stage health: ${healthDot}`}
          />
        )}
      </div>
    </div>
  );
}
