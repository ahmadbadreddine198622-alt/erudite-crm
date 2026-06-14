import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ProjectBadge } from '@/lib/projectColors.jsx';
import { STAGES, DEFAULT_HEALTH_THRESHOLDS } from '@/lib/pipeline';
import { cn } from '@/lib/utils';
import { Phone, MessageCircle, Trash2, ExternalLink } from 'lucide-react';
import { normalizePhone, waMeUrl } from '@/lib/phone';
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

  const e164 = normalizePhone(lead.phone);

  const handleCall = (e) => {
    e.stopPropagation();
    if (e164) window.open(`tel:${e164}`, '_self');
  };

  const handleWhatsApp = (e) => {
    e.stopPropagation();
    if (e164) window.open(waMeUrl(e164), '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={onClick}
      className={cn('rounded-xl p-1.5 cursor-pointer transition-all duration-200', isDragging ? 'shadow-2xl rotate-1' : 'hover:shadow-lg')}
      style={{
        background: isDragging ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.07)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: isDragging ? '2px solid rgba(245,159,10,0.6)' : '1px solid rgba(255,255,255,0.12)',
        borderTopColor: isDragging ? 'rgba(245,159,10,0.8)' : 'rgba(255,255,255,0.18)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      {/* Header: avatar + name */}
      <div className="flex items-center gap-1.5">
        <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent shrink-0">
          {lead.full_name?.[0]?.toUpperCase() || '?'}
        </div>
        <p className="text-[11px] font-semibold truncate flex-1" style={{ color: 'rgba(255,255,255,0.95)' }} title={lead.full_name || lead.phone || 'Unknown'}>
          {lead.full_name || lead.phone || 'Unknown'}
        </p>
      </div>

      {/* Badges: source + stage + health + finance */}
      <div className="flex items-center gap-1 mt-1 flex-wrap">
        {lead.source && (
          <span className="inline-flex items-center px-1 py-0.5 rounded text-[7px] font-bold border bg-accent/10 text-accent border-accent/20">
            {lead.source.replace(/_/g, ' ')}
          </span>
        )}
        <span className="inline-flex items-center px-1 py-0.5 rounded text-[7px] font-bold border bg-slate-500/10 text-slate-300 border-slate-500/30">
          {lead.stage?.replace(/_/g, ' ') || 'unknown'}
        </span>
        {healthStatus === 'stalled' && (
          <span className="inline-flex items-center px-1 py-0.5 rounded text-[7px] font-bold border bg-red-500/15 text-red-400 border-red-500/30">STALLED</span>
        )}
        {healthStatus === 'attention' && (
          <span className="inline-flex items-center px-1 py-0.5 rounded text-[7px] font-bold border bg-amber-500/15 text-amber-400 border-amber-500/30">ATTENTION</span>
        )}
        {lead.financing_type && FINANCE_BADGE[lead.financing_type] && (
          <span className={`inline-flex items-center px-1 py-0.5 rounded text-[7px] font-bold border ${FINANCE_BADGE[lead.financing_type].style}`}>
            {FINANCE_BADGE[lead.financing_type].label}
          </span>
        )}
      </div>

      {/* Intent toggle */}
      <div className="mt-1">
        <IntentToggle lead={lead} size="sm" />
      </div>

      {/* Project + listing offering */}
      {(projectName || hasListingBlock) && (
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {projectName && <ProjectBadge name={projectName} />}
          {showOfferingBadge && (
            <span className={cn('inline-flex items-center px-1 py-0.5 rounded text-[7px] font-bold border', OFFERING_BADGE_COLORS[offering])}>
              {offering}
            </span>
          )}
          {price && <span className="text-[8px] font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>{price}</span>}
        </div>
      )}

      {/* Deal value + agent */}
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        {lead.deal_value_aed > 0 && (
          <span className="text-[10px] font-bold" style={{ color: 'hsl(38 92% 50%)' }}>
            {formatDealValue(lead.deal_value_aed)}
          </span>
        )}
        {lead.assigned_agent_email && (
          <span className="text-[7px] px-1 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.15)', color: 'hsl(38 92% 60%)' }}>
            👤 {lead.assigned_agent_email.split('@')[0]}
          </span>
        )}
      </div>

      {/* Send to Closing — only at closing_dld stage */}
      {lead.stage === 'closing_dld' && (
        <div className="mt-1.5" onClick={e => e.stopPropagation()}>
          <SendToClosingButton leadId={lead.id} propertyRef={lead.closing_property_ref} projectId={lead.closing_project_id} size="xs" />
        </div>
      )}

      {/* Footer: time in stage + compact actions */}
      <div className="flex items-center justify-between gap-1 mt-1.5 pt-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} onClick={e => e.stopPropagation()}>
        <span className="text-[7px] font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {timeInStage || 'New'}
        </span>
        <div className="flex items-center gap-0.5">
          {users.length > 0 && (
            <select
              title="Assign"
              value={lead.assigned_agent_email || ''}
              onClick={e => e.stopPropagation()}
              onChange={e => { e.stopPropagation(); onAssign?.(lead.id, e.target.value); }}
              className="text-[7px] rounded px-0.5 py-0.5 max-w-[60px]"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)' }}
            >
              <option value="">Assign</option>
              {users.map(u => (
                <option key={u.id} value={u.email}>{u.full_name?.split(' ')[0] || u.email.split('@')[0]}</option>
              ))}
            </select>
          )}
          <button type="button" onClick={handleCall} disabled={!e164}
            className="flex items-center justify-center w-5 h-5 rounded hover:bg-blue-500/15 transition-colors disabled:opacity-40"
            title="Call" style={{ color: '#3b82f6' }}>
            <Phone className="w-2.5 h-2.5" />
          </button>
          <button type="button" onClick={handleWhatsApp} disabled={!e164}
            className="flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/15 transition-colors disabled:opacity-40"
            title="WhatsApp">
            <MessageCircle className="w-2.5 h-2.5" />
          </button>
          <a href={`/whatsapp?leadId=${lead.id}`} onClick={e => e.stopPropagation()}
            className="flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-green-400 hover:bg-green-500/15 transition-colors"
            title="Open in CRM">
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <button type="button"
            onClick={() => { if (window.confirm(`Delete ${lead.full_name || lead.phone || 'this lead'}? This can't be undone.`)) onDelete?.(lead.id); }}
            className="flex items-center justify-center w-5 h-5 rounded text-red-400 hover:bg-red-500/15 transition-colors"
            title="Delete">
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
    </div>
  );
}