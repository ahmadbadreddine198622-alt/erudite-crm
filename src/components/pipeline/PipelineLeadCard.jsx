import React, { memo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Phone, MessageCircle, Trash2, ExternalLink, Building2, ArrowRight, ChevronRight, Flame, Zap } from 'lucide-react';
import { normalizePhone, waMeUrl } from '@/lib/phone';
import SendToClosingButton from '@/components/closing/SendToClosingButton';
import IntentToggle from '@/components/leads/IntentToggle';
import {
  PB, champagneInk, isAtRisk, daysInStage, isHot, hasSignals, leadScore,
  formatDealValue, formatAEDCompact, nextStepFor,
} from '@/lib/buyerPipelineTokens';

// One chip language — hairline ghost chip. Differentiate by text, not color.
function Chip({ children, dot, style, title }) {
  return (
    <span title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      background: 'transparent', border: `1px solid ${PB.HAIR2}`,
      color: PB.SLATE, fontSize: 9.5, fontWeight: 500,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      whiteSpace: 'nowrap', lineHeight: 1.1, ...style,
    }}>
      {dot}{children}
    </span>
  );
}

// Footer action icon button — 1.5px stroke, muted, rising on hover.
function ActBtn({ onClick, title, disabled, children, danger }) {
  const [h, setH] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26, borderRadius: 7,
        background: 'transparent', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? 'rgba(255,255,255,0.25)' : danger && h ? PB.CLARET_TEXT : h ? PB.NAME : 'rgba(233,237,246,0.45)',
        transition: 'color 150ms ease',
      }}
    >
      {children}
    </button>
  );
}

// Score-ring avatar — 28px, 1.5px hairline track + gold arc (claret when score < 40),
// initial or photo on a gold-tint fill.
function ScoreRing({ score, size = 28, children }) {
  const stroke = 1.5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const s = Math.max(0, Math.min(100, score || 0));
  const arc = (s / 100) * circ;
  const arcColor = s < 40 ? PB.CLARET_TEXT : PB.GOLD;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)', overflow: 'visible' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        {s > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={arcColor} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${arc} ${circ - arc}`} />
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ position: 'absolute', width: size - 6, height: size - 6, borderRadius: 999, background: 'rgba(198,161,91,0.06)' }} />
        <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: size - 8, height: size - 8, borderRadius: 999, overflow: 'hidden' }}>
          {children}
        </span>
      </div>
    </div>
  );
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
    suffix = period === 'month' ? '/mo' : '/yr';
  }
  return `${num} AED${suffix}`;
}

function PipelineLeadCard({ lead, listing, isDragging, onClick, users = [], onAssign, onDelete, getPhotoForPhone, isColumnSiren = true, trackStages = [] }) {
  const queryClient = useQueryClient();
  const [hovered, setHovered] = useState(false);
  const [photoBroken, setPhotoBroken] = useState(false);
  const [listingFoldOpen, setListingFoldOpen] = useState(false);

  const projects = queryClient.getQueryData(['projects']) || [];
  const project = projects.find((p) => p.id === lead.project_id);
  const projectName = project?.name;

  const score = leadScore(lead);
  const e164 = normalizePhone(lead.phone);
  const photoUrl = !photoBroken && getPhotoForPhone ? getPhotoForPhone(lead.phone || lead.whatsapp) : null;

  const atRisk = isAtRisk(lead);
  const dInStage = daysInStage(lead);
  const hot = isHot(lead);
  const signals = lead.ai_buying_signals || [];
  const showSiren = atRisk && isColumnSiren;
  const nextStep = nextStepFor(lead);

  // Journey hairline — stage position across the active track.
  const stageIndex = trackStages.findIndex((s) => s.key === lead.stage);
  const total = trackStages.length || 1;
  const journeyN = Math.min(Math.max(stageIndex + 1, 1), total);
  const journeyFill = total > 1 ? Math.min(Math.max(stageIndex, 0), total - 1) / (total - 1) * 100 : 0;

  // Listing fold summary
  const hasListing = !!listing;
  const listingRef = listing && (listing.reference_number || listing.pf_listing_id || listing.title || listing.building_name || 'Listing');
  const listingPrice = listing && formatCompactPrice(listing.price, listing.offering_type || listing.listing_type, listing.price_period);
  const listingBeds = listing && listing.bedrooms != null
    ? (listing.bedrooms === 0 ? 'Studio' : `${listing.bedrooms}BR`)
    : '';

  const handleCall = (e) => {
    e.stopPropagation();
    if (e164) window.open(`tel:${e164}`, '_self');
  };
  const handleWhatsApp = (e) => {
    e.stopPropagation();
    if (e164) window.open(waMeUrl(e164), '_blank', 'noopener,noreferrer');
  };

  // Root shadow / border / transform — motionless luxury, light does the work.
  const baseShadow = '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.35)';
  let boxShadow = showSiren ? `inset 2px 0 0 0 ${PB.CLARET}, ${baseShadow}` : baseShadow;
  if (isDragging) boxShadow = '0 24px 48px rgba(0,0,0,0.55)';
  else if (hovered) boxShadow = (showSiren ? `inset 2px 0 0 0 ${PB.CLARET}, ` : '') + '0 12px 32px rgba(0,0,0,0.45)';
  const border = isDragging
    ? 'rgba(198,161,91,0.3)'
    : hovered
      ? 'rgba(198,161,91,0.22)'
      : PB.HAIR;

  return (
    <div
      onClick={onClick}
      className={cn('rounded-2xl p-2 cursor-pointer block')}
      style={{
        background: PB.CARD,
        border: `1px solid ${border}`,
        borderRadius: 14,
        boxShadow,
        position: 'relative',
        transform: isDragging ? 'rotate(1.2deg)' : hovered ? 'translateY(-1px)' : 'none',
        transition: 'transform 180ms ease-out, border-color 180ms ease-out, box-shadow 180ms ease-out',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hover gold top-edge gradient line */}
      <div style={{
        position: 'absolute', top: 0, left: 14, right: 14, height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(198,161,91,0.55), transparent)',
        opacity: hovered ? 1 : 0, transition: 'opacity 180ms ease',
        pointerEvents: 'none', borderRadius: '14px 14px 0 0',
      }} />

      {/* Top row: score ring + name + phone + HOT chip */}
      <div className="flex items-center gap-1.5">
        <ScoreRing score={score ?? 0}>
          {photoUrl ? (
            <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 999 }} onError={() => setPhotoBroken(true)} />
          ) : (
            <span style={{ fontSize: 11, fontWeight: 600, color: PB.GOLD, fontFamily: "'Montserrat',sans-serif" }}>
              {lead.full_name?.[0]?.toUpperCase() || '?'}
            </span>
          )}
        </ScoreRing>
        <p className="text-[12px] truncate flex-1" style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: PB.NAME }} title={lead.full_name || lead.phone || 'Unknown'}>
          {lead.full_name || lead.phone || 'Unknown'}
        </p>
        {hot && (
          <Chip dot={<Flame className="w-2.5 h-2.5" strokeWidth={1.5} style={{ color: PB.GOLD, flex: 'none' }} />} style={{ color: PB.GOLD, borderColor: 'rgba(198,161,91,0.35)' }} title="High conversion probability (≥70%)">
            HOT
          </Chip>
        )}
        {lead.phone && (
          <span className="shrink-0 text-[9px] flex items-center gap-0.5" style={{ color: PB.SLATE, fontVariantNumeric: 'tabular-nums' }} title={`Primary: ${lead.phone}`}>
            <Phone className="w-2.5 h-2.5" strokeWidth={1.5} />
            {lead.phone}
          </span>
        )}
      </div>

      {/* Chips row — one chip language, ghost hairline */}
      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
        {lead.source && (
          <Chip title={lead.source}>{lead.source.replace(/_/g, ' ')}</Chip>
        )}
        <Chip
          dot={<span style={{ width: 6, height: 6, borderRadius: 999, background: PB.GOLD, flex: 'none', boxShadow: '0 0 6px rgba(198,161,91,0.7)' }} />}
        >
          {lead.stage?.replace(/_/g, ' ') || 'unknown'}
        </Chip>
        {lead.financing_type && (
          <Chip title={`Finance: ${lead.financing_type}`}>{lead.financing_type}</Chip>
        )}
        {hasSignals(lead) && (
          <Chip
            dot={<Zap className="w-2.5 h-2.5" strokeWidth={1.5} style={{ color: PB.GOLD, flex: 'none' }} />}
            style={{ color: PB.GOLD, borderColor: 'rgba(198,161,91,0.3)' }}
            title={`Buying signals: ${signals.join(', ')}`}
          >
            {signals.length} SIGNAL{signals.length !== 1 ? 'S' : ''}
          </Chip>
        )}
      </div>

      {/* Intent toggle */}
      <div className="mt-1" onClick={(e) => e.stopPropagation()}>
        <IntentToggle lead={lead} size="sm" />
      </div>

      {/* NEXT action ledger — gold "Next" tag + action text in a hairline well, 2px inner-left rail (claret when at risk). */}
      {nextStep && (
        <div className="flex items-start gap-1.5 mt-1.5 pl-2.5 pr-2 py-1.5 rounded-md relative" style={{ background: PB.WELL, border: `1px solid ${atRisk ? 'rgba(180,70,63,0.25)' : PB.HAIR}` }}>
          <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: atRisk ? 'rgba(180,70,63,0.65)' : 'rgba(198,161,91,0.55)', borderRadius: '2px 0 0 2px' }} />
          <span className="shrink-0" style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: PB.GOLD }}>Next</span>
          <span className="text-[11px] leading-snug line-clamp-2" style={{ color: '#D7DDEA', lineHeight: 1.5 }}>{nextStep}</span>
          <ArrowRight
            className="w-3.5 h-3.5"
            strokeWidth={1.5}
            style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: PB.GOLD, opacity: hovered ? 0.7 : 0, transition: 'opacity 180ms ease', flex: 'none' }}
          />
        </div>
      )}

      {/* Project (ghost chip) */}
      {projectName && (
        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
          <Chip title={projectName}>{projectName}</Chip>
        </div>
      )}

      {/* Deal intelligence fold — matched listing collapsed to one hairline summary line. */}
      {hasListing && (
        <div className="mt-1.5">
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); setListingFoldOpen((v) => !v); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setListingFoldOpen((v) => !v); } }}
            title={listingFoldOpen ? 'Click to fold' : 'Click to expand listing'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', borderRadius: 8, background: PB.WELL, border: `1px solid ${PB.HAIR}`, cursor: 'pointer' }}
          >
            <Building2 className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: PB.SLATE }} />
            <span style={{ fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: PB.SLATE, fontVariantNumeric: 'tabular-nums' }}>
              {listingRef}
            </span>
            {listingPrice && (
              <span style={{ fontSize: 9.5, color: PB.NAME, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {listingPrice}
              </span>
            )}
            {listingBeds && (
              <span style={{ fontSize: 9, color: PB.SLATE, fontVariantNumeric: 'tabular-nums' }}>
                {listingBeds}
              </span>
            )}
            <ChevronRight
              className="shrink-0"
              strokeWidth={1.5}
              style={{ marginLeft: 'auto', width: 13, height: 13, color: PB.SLATE, transform: listingFoldOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 180ms ease' }}
            />
          </div>
          <div style={{ maxHeight: listingFoldOpen ? 400 : 0, opacity: listingFoldOpen ? 1 : 0, overflow: 'hidden', transition: 'max-height 180ms ease, opacity 180ms ease' }}>
            <div className="mt-1 px-2 py-1.5 rounded-md" style={{ background: PB.WELL, border: `1px solid ${PB.HAIR}` }}>
              <div className="flex items-center justify-between gap-1">
                <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: PB.NAME, fontVariantNumeric: 'tabular-nums' }}>
                  <Building2 className="w-3 h-3" strokeWidth={1.5} style={{ color: PB.GOLD }} />
                  {listing.title || listingRef}
                </span>
                {(listing.offering_type || listing.listing_type) && (
                  <Chip style={{ fontSize: 8.5, padding: '1px 6px' }}>
                    {listing.offering_type || listing.listing_type}
                  </Chip>
                )}
              </div>
              {listingPrice && (
                <p className="text-[10px] mt-1" style={{ color: PB.NAME, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {listingPrice}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {listingBeds && <span className="text-[9px]" style={{ color: PB.SLATE }}>{listingBeds}</span>}
                {listing.area_sqft != null && <span className="text-[9px]" style={{ color: PB.SLATE, fontVariantNumeric: 'tabular-nums' }}>{listing.area_sqft.toLocaleString()} sqft</span>}
                {listing.location && <span className="text-[9px]" style={{ color: PB.SLATE }}>{listing.location}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AT RISK siren chip — only the column's single most at-risk card. */}
      {showSiren && (
        <div className="mt-1.5">
          <Chip
            style={{ color: PB.CLARET_TEXT, borderColor: PB.CLARET_BORDER, background: PB.CLARET_BG, fontSize: 9 }}
            title="High churn risk or stale beyond critical threshold"
          >
            AT RISK{dInStage != null ? ` · ${dInStage}D` : ''}
          </Chip>
        </div>
      )}

      {/* Money + agent + L-score row — deal value in champagne gradient ink. */}
      <div className="flex items-center gap-2 mt-1.5 flex-wrap" style={{ borderTop: `1px solid ${PB.HAIR}`, paddingTop: '0.4rem' }}>
        {lead.deal_value_aed > 0 && (
          <span className="text-[11px] font-bold" style={champagneInk}>
            {formatDealValue(lead.deal_value_aed)}
          </span>
        )}
        {score != null && (
          <Chip style={score >= 80 ? { color: PB.GOLD, borderColor: 'rgba(198,161,91,0.4)' } : undefined}>
            L{Math.round(score)}
          </Chip>
        )}
        {lead.assigned_agent_email && (
          <Chip title={lead.assigned_agent_email}>
            {lead.assigned_agent_email.split('@')[0]}
          </Chip>
        )}
      </div>

      {/* Send to Closing — only at closing_dld stage */}
      {lead.stage === 'closing_dld' && (
        <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
          <SendToClosingButton leadId={lead.id} propertyRef={lead.closing_property_ref} projectId={lead.closing_project_id} size="xs" />
        </div>
      )}

      {/* Footer: aging chip (+ quiet claret dot for non-siren at-risk cards) + actions */}
      <div className="flex items-center justify-between gap-1 mt-1.5 pt-1.5" style={{ borderTop: `1px solid ${PB.HAIR}` }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <Chip
            style={
              atRisk && dInStage != null && dInStage >= 14
                ? { color: PB.CLARET_TEXT, borderColor: PB.CLARET_BORDER, background: PB.CLARET_BG }
                : undefined
            }
            title="Days in stage"
          >
            {dInStage != null ? `${dInStage}D` : 'New'}
          </Chip>
          {/* Quiet claret dot — downgraded urgency signal for non-siren at-risk cards. */}
          {atRisk && !showSiren && (
            <span
              title={`At risk${dInStage != null ? ` · ${dInStage}D in stage` : ''} — the most at-risk card in this column carries the full alert`}
              style={{ width: 6, height: 6, borderRadius: 999, background: PB.CLARET, flex: 'none', boxShadow: '0 0 6px rgba(180,70,63,0.4)' }}
            />
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {users.length > 0 && (
            <select
              title="Assign"
              value={lead.assigned_agent_email || ''}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => { e.stopPropagation(); onAssign?.(lead.id, e.target.value); }}
              className="text-[9px] rounded-full px-1.5 py-1 max-w-[64px] cursor-pointer"
              style={{ background: 'transparent', border: `1px solid ${PB.HAIR2}`, color: PB.SLATE }}
            >
              <option value="">Assign</option>
              {users.map((u) => (
                <option key={u.id} value={u.email}>{(u.full_name)?.split(' ')[0] || u.email.split('@')[0]}</option>
              ))}
            </select>
          )}
          <ActBtn onClick={handleCall} disabled={!e164} title={e164 ? 'Call' : 'No phone number'}>
            <Phone className="w-3.5 h-3.5" strokeWidth={1.5} />
          </ActBtn>
          <ActBtn onClick={handleWhatsApp} disabled={!e164} title="WhatsApp">
            <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
          </ActBtn>
          <a
            href={`/whatsapp?leadId=${lead.id}`}
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, color: 'rgba(233,237,246,0.45)', transition: 'color 150ms ease', textDecoration: 'none' }}
            className="hover:!text-[#E9EDF6]"
            title="Open in CRM"
          >
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
          </a>
          <ActBtn
            onClick={() => { if (window.confirm(`Delete ${lead.full_name || lead.phone || 'this lead'}? This can't be undone.`)) onDelete?.(lead.id); }}
            title="Delete"
            danger
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </ActBtn>
        </div>
      </div>

      {/* Journey hairline — stage position across the active track, gold fill + n/total label. */}
      <div className="flex items-center gap-1.5 mt-1.5">
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 1, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${journeyFill}%`, background: showSiren ? PB.CLARET : PB.GOLD, borderRadius: 1, transition: 'width 180ms ease' }} />
        </div>
        <span style={{ fontSize: 9, color: PB.SLATE, fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{journeyN}/{total}</span>
      </div>
    </div>
  );
}

// Memoized so a drag (which re-renders the board on every pointer move) only repaints the
// card whose props actually changed — not all cards.
export default memo(PipelineLeadCard, (prev, next) => {
  const a = prev.lead, b = next.lead;
  return (
    a === b &&
    prev.listing === next.listing &&
    prev.isDragging === next.isDragging &&
    prev.isColumnSiren === next.isColumnSiren &&
    prev.trackStages === next.trackStages &&
    prev.users === next.users &&
    prev.getPhotoForPhone === next.getPhotoForPhone &&
    prev.onAssign === next.onAssign &&
    prev.onDelete === next.onDelete
  );
});