// Four-tier identity header card for the Landlord Detail page.
// Reads the RAW Landlord record (snake_case field names) so values that exist always render
// — fixes the "Asking —" blank and surfaces the rich deal facts we already store.
// Self-contained: no schema changes, no impact on any other section.

import React from 'react';
import IMessageBadge from '@/components/landlord/IMessageBadge';

const GOLD = '#C9A24B';

// ── tiny formatters ──────────────────────────────────────────────────────────
const fmtAED = (n) => {
  if (n == null || isNaN(n)) return null;
  return 'AED ' + Math.round(n).toLocaleString('en-US');
};
const fmtAEDShort = (n) => {
  if (n == null || isNaN(n)) return null;
  if (n >= 1_000_000) return 'AED ' + (n / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'M';
  if (n >= 1_000) return 'AED ' + Math.round(n / 1_000) + 'K';
  return 'AED ' + Math.round(n);
};
const has = (v) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
const titleize = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Country name → emoji flag (covers the common nationalities; falls back to no flag).
const FLAGS = {
  russia: '🇷🇺', russian: '🇷🇺', uae: '🇦🇪', emirati: '🇦🇪', india: '🇮🇳', indian: '🇮🇳',
  china: '🇨🇳', chinese: '🇨🇳', uk: '🇬🇧', british: '🇬🇧', usa: '🇺🇸', american: '🇺🇸',
  france: '🇫🇷', french: '🇫🇷', germany: '🇩🇪', german: '🇩🇪', pakistan: '🇵🇰', pakistani: '🇵🇰',
  egypt: '🇪🇬', egyptian: '🇪🇬', lebanon: '🇱🇧', lebanese: '🇱🇧', canada: '🇨🇦', canadian: '🇨🇦',
  saudi: '🇸🇦', 'saudi arabia': '🇸🇦', italy: '🇮🇹', italian: '🇮🇹', spain: '🇪🇸', spanish: '🇪🇸',
};
const flagFor = (nat) => FLAGS[String(nat || '').trim().toLowerCase()] || null;

const LANG_LABEL = { en: 'EN', ar: 'AR', ru: 'RU', zh: 'ZH', hi: 'HI' };

const ARCHETYPE_LABEL = {
  professional_investor: 'Pro Investor',
  individual_end_user_relocating: 'Relocating',
  distressed_seller: 'Distressed',
  inherited_owner: 'Inherited',
  developer_resale: 'Developer',
  overseas_owner: 'Overseas',
  first_time_seller: 'First-time Seller',
  portfolio_optimizer: 'Portfolio',
  accidental_landlord: 'Accidental',
  speculator_flipping: 'Speculator',
};
const STAGE_LABEL = {
  initial_contact: 'Initial Contact', price_discovery: 'Price Discovery', listing_commitment: 'Listing Commitment',
  form_a_initiation: 'Form A Initiation', form_a_signing: 'Form A Signing', owner_documents: 'Owner Documents',
  photos_videos: 'Photos & Videos', photographer_scheduling: 'Photographer Scheduling', listing_creation: 'Listing Creation',
  internal_verification: 'Internal Verification', listing_publication: 'Listing Publication', final_confirmation: 'Final Confirmation',
  marketing_agents: 'Marketing — Agents', marketing_network: 'Marketing — Network', open_house: 'Open House',
  client_blast: 'Client Blast', deal_closed: 'Deal Closed',
};
const LEAD_TYPE_LABEL = { landlord_sale: 'For Sale', landlord_rent: 'For Rent', landlord_both: 'Sale / Rent' };
const SOURCE_LABEL = { dld_lookup: 'DLD', fsbo_portal: 'FSBO', linkedin_outreach: 'LinkedIn', warm_intro: 'Warm Intro', building_manager: 'Building Mgr', expired_listing: 'Expired' };
const MANDATE_STATUS_LABEL = { none: 'None', verbal: 'Verbal', form_a_drafted: 'Drafted', form_a_signed: 'Signed', expired: 'Expired', cancelled: 'Cancelled' };
const MANDATE_TYPE_LABEL = { exclusive: 'Exclusive', non_exclusive: 'Non-exclusive', off_market: 'Off-market', open_listing: 'Open', pocket: 'Pocket' };

// Rapport → pill palette.
const RAPPORT_META = {
  cold: { label: 'Cold', color: '#94a3b8', bg: 'rgba(148,163,184,0.14)', border: 'rgba(148,163,184,0.32)' },
  warming: { label: 'Warming', color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.14)', border: 'hsl(38 92% 50% / 0.34)' },
  rapport_built: { label: 'Rapport built', color: '#93c5fd', bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.34)' },
  trust_established: { label: 'Trust established', color: '#34d399', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.34)' },
  champion: { label: 'Champion', color: GOLD, bg: 'rgba(201,162,75,0.16)', border: 'rgba(201,162,75,0.4)' },
};
// Momentum → pill palette (matched on keywords so free-text ai_momentum still colors sensibly).
const momentumMeta = (m) => {
  const s = String(m || '').toLowerCase();
  if (/stall|stuck|cold|dormant/.test(s)) return { color: 'hsl(38 92% 60%)', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.28)', dim: true };
  if (/hot|surge|accelerat|strong/.test(s)) return { color: '#34d399', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.34)', dim: false };
  return { color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.14)', border: 'hsl(38 92% 50% / 0.34)', dim: false };
};

// ── shared pill ──────────────────────────────────────────────────────────────
function Pill({ children, color, bg, border, title, outline }) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        height: 24, padding: '0 11px', borderRadius: 999,
        fontSize: 11, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap',
        fontFamily: "'Montserrat','Inter',sans-serif",
        color: color || 'rgba(255,255,255,0.85)',
        background: outline ? 'transparent' : (bg || 'rgba(255,255,255,0.06)'),
        border: '1px solid ' + (border || 'rgba(255,255,255,0.14)'),
      }}
    >
      {children}
    </span>
  );
}

// One label/value pair on the deal-facts baseline.
function Fact({ label, value, valueColor, title }) {
  if (!has(value)) return null;
  return (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontFamily: "'Montserrat',sans-serif" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: valueColor || 'rgba(255,255,255,0.88)', fontFamily: "'Montserrat',sans-serif" }}>{value}</span>
    </span>
  );
}

const Dot = () => <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>·</span>;

export default function LandlordIdentityHeader({ landlord, unit, imessageChecking, onCheckIMessage }) {
  const L = landlord || {};
  const U = unit || {};
  const name = L.full_name_en || L.full_name || 'Unnamed landlord';
  const initials = String(name).trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const flag = flagFor(L.nationality);
  const lang = LANG_LABEL[L.preferred_language];
  const extraPhones = Array.isArray(L.additional_phones) ? L.additional_phones.filter(Boolean) : [];

  // Tier 2 — property facts. Beds/sqft live on the linked Property (passed via `unit`); the rest
  // (project, unit ref, asking) live on the Landlord record. Only render what exists.
  const beds = U.bedrooms != null ? `${U.bedrooms} Bed` : null;
  const sqft = U.area_sqft ? `${U.area_sqft} sqft` : null;
  const projectName = L.project_name || U.building_name || null;
  const unitRef = L.unit_reference || U.unit_no || null;
  const askingFull = fmtAED(L.asking_price_aed != null ? L.asking_price_aed : U.price_aed);
  const reserve = fmtAEDShort(L.reserve_price);

  // Tier 4 — deal facts
  const rapport = RAPPORT_META[L.rapport_level] || null;
  const mom = has(L.ai_momentum) ? momentumMeta(L.ai_momentum) : null;
  const commissionPct = has(L.commission_pct_negotiated) ? `${L.commission_pct_negotiated}%` : null;
  const estComm = fmtAEDShort(L.estimated_commission_aed);
  const winRaw = L.mandate_win_probability;
  const winPct = winRaw != null ? Math.round(winRaw <= 1 ? winRaw * 100 : winRaw) : null;
  const winColor = winPct == null ? null : winPct < 34 ? '#f87171' : winPct < 67 ? 'hsl(38 92% 62%)' : '#34d399';

  // Mandate expiry countdown
  const expiry = (() => {
    if (!has(L.mandate_expires_at)) return null;
    const days = Math.ceil((new Date(L.mandate_expires_at).getTime() - Date.now()) / 86400000);
    if (isNaN(days)) return null;
    if (days < 0) return { text: `expired ${Math.abs(days)}d ago`, color: '#f87171' };
    return { text: `expires in ${days}d`, color: days < 30 ? 'hsl(38 92% 62%)' : 'rgba(255,255,255,0.88)' };
  })();

  const mandateLine = [MANDATE_TYPE_LABEL[L.mandate_type] || (has(L.mandate_type) ? titleize(L.mandate_type) : null),
    MANDATE_STATUS_LABEL[L.mandate_status] || null].filter(Boolean).join(' · ');

  const residency = typeof L.is_resident_uae === 'boolean' ? (L.is_resident_uae ? 'Resident' : 'Non-resident') : null;
  const source = has(L.source) ? (SOURCE_LABEL[L.source] || titleize(L.source)) : null;
  const daysInStage = has(L.days_in_stage) ? `${L.days_in_stage}d in stage` : null;

  // iMessage micro-line
  const handles = Array.isArray(L.imessage_handles) ? L.imessage_handles : [];
  const availCount = handles.filter((h) => h && h.imessage_status === 'available').length;
  const checkedShort = L.imessage_checked_at
    ? new Date(L.imessage_checked_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null;

  return (
    <div
      style={{
        borderRadius: 16,
        background: '#0B1F3A',
        border: '1px solid rgba(201,162,75,0.18)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
        padding: '16px 18px',
        animation: 'ld-rise 0.4s cubic-bezier(0.22,1,0.36,1) both',
      }}
    >
      {/* TIER 1 — Identity */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ flex: 'none', width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: GOLD, background: 'rgba(201,162,75,0.12)', border: '1px solid rgba(201,162,75,0.32)' }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontFamily: "'Cormorant Garamond','Playfair Display',serif", fontWeight: 600, fontSize: 28, letterSpacing: '-0.01em', color: 'rgba(255,255,255,0.97)', lineHeight: 1.05 }}>{name}</h1>
              {flag && <span style={{ fontSize: 18, lineHeight: 1 }} title={L.nationality}>{flag}</span>}
              {lang && <Pill color="rgba(255,255,255,0.7)">{lang}</Pill>}
            </div>
            {has(L.phone) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
                <a href={`tel:${L.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: GOLD, textDecoration: 'none' }}>
                  📞 {L.phone}
                </a>
                {extraPhones.length > 0 && (
                  <span title={extraPhones.join(', ')} style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>(+{extraPhones.length})</span>
                )}
              </div>
            )}
          </div>
          {has(L.full_name_ar) && (
            <div dir="rtl" style={{ marginTop: 2, fontFamily: "'Cormorant Garamond',serif", fontSize: 16, color: 'rgba(255,255,255,0.6)' }}>{L.full_name_ar}</div>
          )}

          <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(201,162,75,0.25), transparent)', margin: '10px 0' }} />

          {/* TIER 2 — Property + price */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5, color: 'rgba(255,255,255,0.6)' }}>
            {[beds, sqft, projectName, has(unitRef) ? `Unit ${unitRef}` : null]
              .filter(has)
              .map((part, i, arr) => (
                <React.Fragment key={i}>
                  <span>{part}</span>
                  {i < arr.length - 1 && <Dot />}
                </React.Fragment>
              ))}
            {askingFull && (
              <>
                {(beds || sqft || projectName || unitRef) && <Dot />}
                <span style={{ fontWeight: 700, color: GOLD }}>Asking {askingFull}</span>
              </>
            )}
            {reserve && <span style={{ color: 'rgba(255,255,255,0.45)' }}>· Reserve {reserve}</span>}
          </div>

          {/* TIER 3 — Status chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 11 }}>
            {has(L.landlord_archetype) && (
              <Pill color="#93c5fd" bg="rgba(59,130,246,0.12)" border="rgba(59,130,246,0.3)">
                {ARCHETYPE_LABEL[L.landlord_archetype] || titleize(L.landlord_archetype)}
              </Pill>
            )}
            {has(L.lead_type) && (
              <Pill color="#5eead4" bg="rgba(20,184,166,0.12)" border="rgba(20,184,166,0.3)">
                {LEAD_TYPE_LABEL[L.lead_type] || titleize(L.lead_type)}
              </Pill>
            )}
            {has(L.stage) && (
              <Pill outline color={GOLD} border="rgba(201,162,75,0.45)" title={has(L.sub_stage) ? titleize(L.sub_stage) : undefined}>
                ◷ {STAGE_LABEL[L.stage] || titleize(L.stage)}
              </Pill>
            )}
            {rapport && (
              <Pill color={rapport.color} bg={rapport.bg} border={rapport.border}>{rapport.label}</Pill>
            )}
            {mom && (
              <Pill color={mom.color} bg={mom.bg} border={mom.border}>⚡ {titleize(L.ai_momentum)}</Pill>
            )}
          </div>

          {/* TIER 4 — Deal facts strip */}
          {(mandateLine || commissionPct || winPct != null || has(L.form_a_contract_number) || expiry || daysInStage || source || residency || has(L.phone)) && (
            <div style={{ marginTop: 12, paddingTop: 11, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {/* Row A — mandate / money / win */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
                <Fact label="Mandate" value={mandateLine || null} />
                <Fact
                  label="Comm"
                  value={commissionPct ? `${commissionPct}${estComm ? ` (~${estComm})` : ''}` : null}
                  valueColor={GOLD}
                />
                <Fact label="Form A" value={has(L.form_a_contract_number) ? L.form_a_contract_number : null} />
              </div>
              {/* Row B — expiry / stage age / source / residency */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
                {expiry && <Fact label="Expiry" value={expiry.text} valueColor={expiry.color} />}
                <Fact label="Stage" value={daysInStage} />
                <Fact label="Source" value={source} />
                <Fact label="Residency" value={residency} />
              </div>
              {/* Row C — channel micro-line (keeps Resolve iMessage behavior) */}
              {has(L.phone) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                  <span style={{ fontWeight: 600 }}>{L.imessage_status === 'available' ? 'iMessage' : 'SMS only'}</span>
                  <Dot />
                  <IMessageBadge
                    status={L.imessage_status || 'unknown'}
                    checkedAt={L.imessage_checked_at}
                    checking={imessageChecking}
                    onCheck={onCheckIMessage}
                    handle={L.imessage_handle}
                    handles={handles}
                  />
                  {checkedShort && <span style={{ color: 'rgba(255,255,255,0.4)' }}>checked {checkedShort}</span>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}