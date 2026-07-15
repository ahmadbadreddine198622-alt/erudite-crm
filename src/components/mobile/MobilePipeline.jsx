import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { primeWhatsAppCache } from '@/hooks/useHasWhatsApp';
import {
  PB, champagneInk, isAtRisk, isHot, hasSignals, leadScore,
  formatAEDCompact, daysInStage, nextStepFor,
} from '@/lib/buyerPipelineTokens';
import { AlertTriangle, Flame, Zap, Building2, TrendingUp, ChevronRight, Phone, MessageCircle } from 'lucide-react';
import { normalizePhone, waMeUrl } from '@/lib/phone';

// Ghost hairline chip — same language as the desktop card.
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

function PulseChip({ icon: Icon, label, count, onClick, active, tone = 'gold' }) {
  const zero = !count;
  const toneColor = tone === 'claret' ? PB.CLARET_TEXT : PB.GOLD;
  const activeBg = tone === 'claret' ? PB.CLARET_BG : 'rgba(198,161,91,0.08)';
  const activeBorder = tone === 'claret' ? PB.CLARET_BORDER : 'rgba(198,161,91,0.35)';
  return (
    <button
      type="button"
      onClick={zero ? undefined : onClick}
      disabled={zero}
      title={label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '6px 12px', borderRadius: 999, minHeight: 40,
        background: active ? activeBg : 'transparent',
        border: `1px solid ${active ? activeBorder : PB.HAIR2}`,
        color: active ? toneColor : zero ? PB.SLATE : toneColor,
        fontSize: 11, fontWeight: 600,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        whiteSpace: 'nowrap', cursor: zero ? 'default' : 'pointer',
        opacity: zero ? 0.35 : 1,
        transition: 'border-color 150ms ease, color 150ms ease, background 150ms ease',
        fontVariantNumeric: 'tabular-nums', flex: 'none',
      }}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={1.5} style={{ flex: 'none' }} />
      {label}
      <span style={{ fontWeight: 700 }}>{count}</span>
    </button>
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
  if (offeringType === 'rent') suffix = period === 'month' ? '/mo' : '/yr';
  return `${num} AED${suffix}`;
}

function MobileLeadCard({ lead, listing }) {
  const [foldOpen, setFoldOpen] = useState(false);
  const score = leadScore(lead);
  const dInStage = daysInStage(lead);
  const atRisk = isAtRisk(lead);
  const hot = isHot(lead);
  const signals = lead.ai_buying_signals || [];
  const e164 = normalizePhone(lead.phone);
  const nextStep = nextStepFor(lead);

  const listingRef = listing && (listing.reference_number || listing.pf_listing_id || listing.title || listing.building_name || 'Listing');
  const listingPrice = listing && formatCompactPrice(listing.price, listing.offering_type || listing.listing_type, listing.price_period);
  const listingBeds = listing && listing.bedrooms != null ? (listing.bedrooms === 0 ? 'Studio' : `${listing.bedrooms}BR`) : '';

  return (
    <div
      className="rounded-xl p-3"
      style={{ background: PB.CARD, border: `1px solid ${PB.HAIR}`, boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}
    >
      {/* Top row: avatar + name + HOT chip */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-none" style={{ background: 'rgba(198,161,91,0.06)', border: `1px solid ${PB.HAIR2}` }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: PB.GOLD }}>{lead.full_name?.[0]?.toUpperCase() || '?'}</span>
        </div>
        <p className="text-sm font-semibold truncate flex-1" style={{ color: PB.NAME }}>{lead.full_name || lead.name || lead.phone || 'Unknown'}</p>
        {hot && (
          <Chip dot={<Flame className="w-2.5 h-2.5" strokeWidth={1.5} style={{ color: PB.GOLD, flex: 'none' }} />} style={{ color: PB.GOLD, borderColor: 'rgba(198,161,91,0.35)' }}>HOT</Chip>
        )}
      </div>

      {/* Chips */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {lead.stage && <Chip>{lead.stage.replace(/_/g, ' ')}</Chip>}
        {lead.source && <Chip>{lead.source.replace(/_/g, ' ')}</Chip>}
        {hasSignals(lead) && (
          <Chip dot={<Zap className="w-2.5 h-2.5" strokeWidth={1.5} style={{ color: PB.GOLD, flex: 'none' }} />} style={{ color: PB.GOLD, borderColor: 'rgba(198,161,91,0.3)' }} title={`Signals: ${signals.join(', ')}`}>
            {signals.length} SIGNAL{signals.length !== 1 ? 'S' : ''}
          </Chip>
        )}
      </div>

      {/* NEXT well */}
      {nextStep && (
        <div className="flex items-start gap-1.5 mb-2 pl-2.5 pr-2 py-1.5 rounded-md relative" style={{ background: PB.WELL, border: `1px solid ${atRisk ? 'rgba(180,70,63,0.25)' : PB.HAIR}` }}>
          <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: atRisk ? 'rgba(180,70,63,0.65)' : 'rgba(198,161,91,0.55)', borderRadius: '2px 0 0 2px' }} />
          <span className="shrink-0" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: PB.GOLD }}>Next</span>
          <span className="text-[12px] leading-snug" style={{ color: '#D7DDEA', lineHeight: 1.5 }}>{nextStep}</span>
        </div>
      )}

      {/* Listing fold — tap to toggle */}
      {listing && (
        <div className="mb-2">
          <button
            type="button"
            onClick={() => setFoldOpen((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 8px', borderRadius: 8, background: PB.WELL, border: `1px solid ${PB.HAIR}`, cursor: 'pointer', textAlign: 'left' }}
            title={foldOpen ? 'Tap to fold' : 'Tap to expand listing'}
          >
            <Building2 className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} style={{ color: PB.SLATE }} />
            <span style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: PB.SLATE, fontVariantNumeric: 'tabular-nums', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {listingRef}
            </span>
            {listingPrice && <span style={{ fontSize: 11, color: PB.NAME, fontVariantNumeric: 'tabular-nums', fontWeight: 600, flex: 'none' }}>{listingPrice}</span>}
            <ChevronRight className="shrink-0" strokeWidth={1.5} style={{ width: 14, height: 14, color: PB.SLATE, transform: foldOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 180ms ease' }} />
          </button>
          <div style={{ maxHeight: foldOpen ? 300 : 0, opacity: foldOpen ? 1 : 0, overflow: 'hidden', transition: 'max-height 180ms ease, opacity 180ms ease' }}>
            <div className="mt-1 px-2 py-1.5 rounded-md" style={{ background: PB.WELL, border: `1px solid ${PB.HAIR}` }}>
              <span className="text-[11px] font-semibold" style={{ color: PB.NAME }}>{listing.title || listingRef}</span>
              {listingBeds && <span className="text-[10px] ml-2" style={{ color: PB.SLATE }}>{listingBeds}</span>}
              {listing.area_sqft != null && <span className="text-[10px] ml-2" style={{ color: PB.SLATE, fontVariantNumeric: 'tabular-nums' }}>{listing.area_sqft.toLocaleString()} sqft</span>}
            </div>
          </div>
        </div>
      )}

      {/* Deal value + score */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {lead.deal_value_aed > 0 && (
          <span className="text-sm font-bold" style={champagneInk}>{formatAEDCompact(lead.deal_value_aed)}</span>
        )}
        {score != null && (
          <Chip style={score >= 80 ? { color: PB.GOLD, borderColor: 'rgba(198,161,91,0.4)' } : undefined}>L{Math.round(score)}</Chip>
        )}
        <Chip
          style={atRisk && dInStage != null && dInStage >= 14 ? { color: PB.CLARET_TEXT, borderColor: PB.CLARET_BORDER, background: PB.CLARET_BG } : undefined}
        >
          {dInStage != null ? `${dInStage}D` : 'New'}
        </Chip>
      </div>

      {/* Actions — tap targets ≥ 40px */}
      <div className="flex items-center gap-2 pt-2" style={{ borderTop: `1px solid ${PB.HAIR}` }}>
        {lead.phone && (
          <>
            <a
              href={`tel:${e164 || lead.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center rounded-lg"
              style={{ width: 40, height: 40, background: 'transparent', border: `1px solid ${PB.HAIR2}`, color: PB.GOLD, flex: 'none' }}
            >
              <Phone className="w-4 h-4" strokeWidth={1.5} />
            </a>
            <a
              href={waMeUrl(e164 || lead.phone)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center rounded-lg"
              style={{ width: 40, height: 40, background: 'transparent', border: `1px solid ${PB.HAIR2}`, color: PB.GOLD, flex: 'none' }}
            >
              <MessageCircle className="w-4 h-4" strokeWidth={1.5} />
            </a>
          </>
        )}
        {lead.assigned_agent_email && (
          <Chip title={lead.assigned_agent_email} style={{ marginLeft: 'auto' }}>
            {lead.assigned_agent_email.split('@')[0]}
          </Chip>
        )}
      </div>
    </div>
  );
}

export default function MobilePipeline() {
  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 200),
  });

  const { data: listings = [] } = useQuery({
    queryKey: ['pipeline-listings'],
    queryFn: () => base44.entities.PFListing.list('-updated_date', 500),
    staleTime: 60_000,
  });

  useEffect(() => {
    const phones = leads.map((l) => l.phone).filter(Boolean);
    if (phones.length > 0) primeWhatsAppCache(phones);
  }, [leads]);

  const [pulseFilter, setPulseFilter] = useState(null);

  // Listing lookup — shared query key with desktop so it's cached across views.
  const getListing = useMemo(() => {
    const byId = {};
    const byRef = {};
    for (const l of listings) {
      if (l.listing_id) byId[l.listing_id] = l;
      if (l.listing_reference) byRef[l.listing_reference] = l;
    }
    return (lead) => {
      const meta = lead.source_metadata || {};
      if (meta.listing_id && byId[meta.listing_id]) return byId[meta.listing_id];
      if (meta.listing_reference && byRef[meta.listing_reference]) return byRef[meta.listing_reference];
      return null;
    };
  }, [listings]);

  const stages = [
    'new_lead', 'contacted', 'viewing_scheduled', 'viewing_done',
    'negotiation', 'offer_made', 'closed_won', 'closed_lost',
  ];
  const stageLabels = {
    new_lead: 'New', contacted: 'Contacted', viewing_scheduled: 'Viewing',
    viewing_done: 'Viewed', negotiation: 'Negotiating', offer_made: 'Offer',
    closed_won: 'Won', closed_lost: 'Lost',
  };

  const pulsePredicate = (l) => {
    if (pulseFilter === 'risk') return isAtRisk(l);
    if (pulseFilter === 'hot') return isHot(l);
    if (pulseFilter === 'signals') return hasSignals(l);
    return true;
  };

  const pulseCounts = useMemo(() => ({
    risk: leads.filter(isAtRisk).length,
    hot: leads.filter(isHot).length,
    signals: leads.filter(hasSignals).length,
    expected: leads.reduce((s, l) => s + ((l.ai_conversion_probability || 0) * (l.deal_value_aed || 0)), 0),
  }), [leads]);

  const toggle = (key) => setPulseFilter((p) => (p === key ? null : key));

  return (
    <div className="space-y-4 pb-6" style={{ background: PB.BASE, minHeight: '100dvh' }}>
      {/* Pulse chips — horizontally scrollable */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 pipeline-mobile-scroll" style={{ scrollbarWidth: 'none' }}>
        <style>{`.pipeline-mobile-scroll::-webkit-scrollbar{display:none}`}</style>
        <PulseChip icon={AlertTriangle} label="AT RISK" count={pulseCounts.risk} onClick={() => toggle('risk')} active={pulseFilter === 'risk'} tone="claret" />
        <PulseChip icon={Flame} label="HOT" count={pulseCounts.hot} onClick={() => toggle('hot')} active={pulseFilter === 'hot'} tone="gold" />
        <PulseChip icon={Zap} label="SIGNALS" count={pulseCounts.signals} onClick={() => toggle('signals')} active={pulseFilter === 'signals'} tone="gold" />
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-none"
          style={{ background: 'transparent', border: `1px solid ${PB.HAIR2}`, fontVariantNumeric: 'tabular-nums', minHeight: 40 }}
          title="Probability-weighted pipeline"
        >
          <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.5} style={{ color: PB.GOLD, flex: 'none' }} />
          <span className="text-[11px] font-semibold" style={{ color: PB.SLATE, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Expected</span>
          <span className="text-[12px] font-bold" style={champagneInk}>{formatAEDCompact(pulseCounts.expected)}</span>
        </div>
      </div>

      {stages.map((stage) => {
        let stageLeads = leads.filter((l) => l.stage === stage);
        if (pulseFilter) stageLeads = stageLeads.filter(pulsePredicate);
        if (stageLeads.length === 0) return null;
        return (
          <div key={stage}>
            <div className="flex items-center justify-between px-1 mb-2">
              <h3 className="text-sm font-semibold" style={{ color: PB.NAME, letterSpacing: '0.04em' }}>{stageLabels[stage]}</h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'transparent', border: `1px solid ${PB.HAIR2}`, color: PB.SLATE, fontVariantNumeric: 'tabular-nums' }}>
                {stageLeads.length}
              </span>
            </div>
            <div className="space-y-2">
              {stageLeads.slice(0, 5).map((lead) => (
                <MobileLeadCard key={lead.id} lead={lead} listing={getListing(lead)} />
              ))}
              {stageLeads.length > 5 && (
                <p className="text-xs px-1 py-2" style={{ color: PB.SLATE }}>+{stageLeads.length - 5} more</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}