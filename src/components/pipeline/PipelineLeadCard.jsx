import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ProjectBadge } from '@/lib/projectColors.jsx';
import SourceBadge from '@/components/shared/SourceBadge';
import WhatsAppPhone from '@/components/shared/WhatsAppPhone';
import { STAGES, DEFAULT_HEALTH_THRESHOLDS } from '@/lib/pipeline';
import { cn } from '@/lib/utils';
import { Calendar, Trash2, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import SendToClosingButton from '@/components/closing/SendToClosingButton';
import IntentToggle from '@/components/leads/IntentToggle';

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

const FINANCE_BADGE = {
  cash:        { label: 'Cash',     style: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  mortgage:    { label: 'Mortgage', style: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  pre_approved:{ label: 'Pre-app',  style: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  mixed:       { label: 'Mixed',    style: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
};

export default function PipelineLeadCard({ lead, listing, isDragging, onClick, users = [], onAssign, onDelete }) {
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
        'rounded-lg p-2.5 cursor-pointer transition-all duration-200',
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
      <div className="flex items-start gap-1.5 mb-1.5">
        <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center text-xs font-bold text-accent shrink-0">
          {lead.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-0.5">
            <p className="text-sm font-bold leading-tight truncate" style={{ color: 'rgba(255,255,255,0.95)' }}>{lead.name || 'Unknown'}</p>
            {healthStatus && (
              <span className={`shrink-0 px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider ${healthColors[healthStatus]} text-white`}>
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
        <div className="mb-1.5">
          <p className="text-sm font-bold" style={{ color: 'hsl(38 92% 50%)' }}>
            {formatDealValue(lead.deal_value_aed)}
          </p>
        </div>
      )}

      {/* LEVEL 3: Property / Project */}
      {projectName && (
        <div className="mb-1.5">
          <ProjectBadge name={projectName} />
        </div>
      )}

      {/* Listing enrichment (only if PFListing matched) */}
      {hasListingBlock && (
        <div className="mb-1.5 flex items-center gap-1.5">
          {listing.image_url && (
            <img
              src={listing.image_url}
              alt=""
              loading="lazy"
              className="w-10 h-10 rounded-lg object-cover bg-muted shrink-0 border border-white/10"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            {listing.title && (
              <p className="text-[11px] font-medium truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>{listing.title}</p>
            )}
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              {showOfferingBadge && (
                <span
                  className={cn(
                    'inline-flex items-center px-1 py-0.5 rounded text-[7px] font-bold border uppercase tracking-wider',
                    OFFERING_BADGE_COLORS[offering],
                  )}
                >
                  {offering}
                </span>
              )}
              {price && <span className="text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>{price}</span>}
            </div>
          </div>
        </div>
      )}

      {/* LEVEL 4: Next Appointment + Days in Stage */}
      {(lead.next_appointment_at || timeInStage) && (
        <div className="mb-1.5 flex items-center gap-1 flex-wrap">
          {lead.next_appointment_at && (
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/25 inline-flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5" />
              {format(new Date(lead.next_appointment_at), 'MMM d, h:mm a')}
            </span>
          )}
          {timeInStage && (
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-white/5 text-white/60 border border-white/10">
              {timeInStage} in stage
            </span>
          )}
        </div>
      )}

      {/* LEVEL 5: Intent toggle + Source + Tags */}
      <div className="flex items-center gap-1 flex-wrap pt-1.5 border-t border-white/8">
        <IntentToggle lead={lead} size="sm" />
        {lead.source && (
          <SourceBadge source={lead.source} />
        )}
        {lead.financing_type && FINANCE_BADGE[lead.financing_type] && (
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider ${FINANCE_BADGE[lead.financing_type].style}`}>
            {FINANCE_BADGE[lead.financing_type].label}
          </span>
        )}
        {STAGES[lead.stage]?.required_documents?.length > 0 && (
          <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/25 shrink-0">
            {STAGES[lead.stage].required_documents.length} docs
          </span>
        )}
      </div>

      {/* Send to Closing — only at closing_dld stage */}
      {lead.stage === 'closing_dld' && (
        <div className="pt-1.5 mt-1" onClick={e => e.stopPropagation()}>
          <SendToClosingButton
            leadId={lead.id}
            propertyRef={lead.closing_property_ref}
            projectId={lead.closing_project_id}
            size="xs"
          />
        </div>
      )}

      {/* LEVEL 6: Assign + Delete */}
      <div className="flex items-center gap-1.5 pt-1.5 mt-1 border-t border-white/8" onClick={e => e.stopPropagation()}>
        {users.length > 0 && (
          <select
            title="Assign agent"
            value={lead.assigned_agent_email || ''}
            onChange={e => onAssign?.(lead.id, e.target.value)}
            className="flex-1 text-[9px] rounded-md px-1.5 py-1 min-w-0"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}
          >
            <option value="">Assign agent…</option>
            {users.map(u => (
              <option key={u.id} value={u.email}>{u.full_name?.split(' ')[0] || u.email.split('@')[0]}</option>
            ))}
          </select>
        )}
        <button
          type="button"
          title="Delete lead"
          onClick={() => {
            if (window.confirm(`Delete ${lead.name || 'this lead'}? This can't be undone.`)) {
              onDelete?.(lead.id);
            }
          }}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-red-400 hover:bg-red-500/15 transition-colors shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}