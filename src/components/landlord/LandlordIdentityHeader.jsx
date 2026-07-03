// Four-tier identity header card for the Landlord Detail page.
// Reads the RAW Landlord record (snake_case field names) so values that exist always render.
// Now also renders the FULL contact list (all phones + emails) and, per contact, a row of
// icon-only communication channels (Twilio, Vapi, Aircall, Call, WhatsApp, Email) — replaces
// the separate PhoneNumbersPanel / Email sidebar cards, which have been folded into this card.

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import IMessageBadge from '@/components/landlord/IMessageBadge';
import StraightDivider from '@/components/landlord/StraightDivider';
import { Download, Phone, PhoneCall, Mail, MessageCircle, Plus, X, Loader2 } from 'lucide-react';
import TwilioCallDialog from '@/components/twilio/TwilioCallDialog';
import VapiCallDialog from '@/components/vapi/VapiCallDialog';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { usePhotoByPhone } from '@/lib/usePhotoByPhone';

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

// Rapport → pill palette (more vibrant).
const RAPPORT_META = {
  cold: { label: 'Cold', color: '#60a5fa', bg: 'rgba(59,130,246,0.18)', border: 'rgba(59,130,246,0.4)' },
  warming: { label: 'Warming', color: '#fbbf24', bg: 'rgba(245,158,11,0.18)', border: 'rgba(245,158,11,0.45)' },
  rapport_built: { label: 'Rapport built', color: '#818cf8', bg: 'rgba(99,102,241,0.18)', border: 'rgba(99,102,241,0.4)' },
  trust_established: { label: 'Trust established', color: '#4ade80', bg: 'rgba(34,197,94,0.18)', border: 'rgba(34,197,94,0.4)' },
  champion: { label: 'Champion', color: '#fcd34d', bg: 'rgba(245,158,11,0.22)', border: 'rgba(245,158,11,0.5)', boxShadow: '0 0 12px rgba(245,158,11,0.3)' },
};
// Momentum → pill palette (matched on keywords so free-text ai_momentum still colors sensibly).
const momentumMeta = (m) => {
  const s = String(m || '').toLowerCase();
  if (/stall|stuck|cold|dormant/.test(s)) return { color: 'hsl(38 92% 60%)', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.28)', dim: true };
  if (/hot|surge|accelerat|strong/.test(s)) return { color: '#34d399', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.34)', dim: false };
  return { color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.14)', border: 'hsl(38 92% 50% / 0.34)', dim: false };
};

// ── shared pill ──────────────────────────────────────────────────────────────
function Pill({ children, color, bg, border, title, outline, boxShadow }) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        height: 24, padding: '0 11px', borderRadius: 999,
        fontSize: 11, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap',
        fontFamily: "'Montserrat','Inter',sans-serif",
        color: color || '#ffffff',
        background: outline ? 'transparent' : (bg || 'rgba(255,255,255,0.08)'),
        border: '1px solid ' + (border || 'rgba(255,255,255,0.18)'),
        boxShadow: boxShadow || (outline ? 'none' : '0 2px 8px rgba(0,0,0,0.2)'),
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
      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', fontFamily: "'Montserrat',sans-serif" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: valueColor || '#ffffff', fontFamily: "'Montserrat',sans-serif", textShadow: '0 1px 8px rgba(0,0,0,0.3)' }}>{value}</span>
    </span>
  );
}

const Dot = () => <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>·</span>;

// One phone or email row — value + Primary/Secondary label.
function ContactRow({ icon: Icon, value, label, href }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <Icon size={12} style={{ color: GOLD, flex: 'none' }} />
      <a href={href} style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.92)', textDecoration: 'none' }}>{value}</a>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>{label}</span>
    </div>
  );
}

// Shared pill icon-button used inline next to a phone/email — fully rounded to match the
// channel pill design (call, aircall, message icons).
function ChIcon({ href, title, color, bg, border, children, size = 26 }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: 999, flex: 'none',
        background: bg, border: '1px solid ' + border, color, textDecoration: 'none', cursor: 'pointer',
      }}
    >
      {children}
    </a>
  );
}

// Icon+label pill used by Twilio/Vapi channel buttons.
function ChPill({ icon, label, color, bg, border, href, onClick }) {
  const Tag = href ? 'a' : 'div';
  return (
    <Tag
      href={href}
      target={href ? '_blank' : undefined}
      rel={href ? 'noopener noreferrer' : undefined}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        height: 26, padding: '0 11px', borderRadius: 999,
        background: bg, border: '1px solid ' + border, color, textDecoration: 'none', cursor: 'pointer',
        fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
      }}
    >
      {icon}{label}
    </Tag>
  );
}

// Combined row for ONE phone number — the number itself on the left, and the channel pills
// (Call, Aircall, Twilio, Vapi, WhatsApp) sitting right next to it on the right.
function PhoneContactRow({ phone, landlord }) {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  const cleanTel = phone.replace(/[\s\-()]/g, '');
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'nowrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <ChIcon href={`https://wa.me/${digits}`} title={`WhatsApp ${phone}`} color="#4ade80" bg="rgba(37,211,102,0.14)" border="rgba(37,211,102,0.3)" size={20} iconSize={10}>
          <MessageCircle size={10} />
        </ChIcon>
        <a href={`tel:${phone}`} style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.92)', textDecoration: 'none' }}>{phone}</a>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'nowrap' }}>
        <ChIcon href={`tel:${phone}`} title={`Call ${phone}`} color="#60a5fa" bg="rgba(59,130,246,0.14)" border="rgba(59,130,246,0.3)">
          <Phone size={12} />
        </ChIcon>
        <ChIcon href={`tel:${cleanTel}`} title={`Aircall: Call ${phone}`} color="#00beff" bg="rgba(0,190,255,0.14)" border="rgba(0,190,255,0.3)">
          <PhoneCall size={12} />
        </ChIcon>
        <TwilioCallDialog landlord={landlord} phoneOverride={phone}>
          <ChPill label="T" color="#4ade80" bg="rgba(34,197,94,0.14)" border="rgba(34,197,94,0.3)" />
        </TwilioCallDialog>
        <VapiCallDialog landlord={{ ...landlord, phone, whatsapp: phone }} iconOnly />
      </div>
    </div>
  );
}

// Combined row for ONE email — the address on the left, mail icon pill on the right.
function EmailContactRow({ email }) {
  if (!email) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'nowrap' }}>
      <a href={`mailto:${email}`} style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.92)', textDecoration: 'none' }}>{email}</a>
      <ChIcon href={`mailto:${email}`} title={`Email ${email}`} color="hsl(38 92% 62%)" bg="hsl(38 92% 50% / 0.14)" border="hsl(38 92% 50% / 0.3)">
        <Mail size={12} />
      </ChIcon>
    </div>
  );
}

const addPillStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', background: 'rgba(201,162,75,0.1)', border: '1px dashed rgba(201,162,75,0.4)', color: GOLD };
const addBtnStyle = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 9px', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer', background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.4)', color: '#34d399' };
const cancelBtnStyle = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 6px', borderRadius: 7, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' };
const smallInputStyle = { fontSize: 11, padding: '4px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' };

export default function LandlordIdentityHeader({ landlord, unit, imessageChecking, onCheckIMessage, landlordId }) {
  const L = landlord || {};
  const U = unit || {};
  const queryClient = useQueryClient();
  const { getPhotoForPhone } = usePhotoByPhone();
  const photoUrl = getPhotoForPhone(L.phone || L.whatsapp);
  const [addingPhone, setAddingPhone] = useState(false);
  const [addingEmail, setAddingEmail] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [addingUnit, setAddingUnit] = useState(false);
  const [addingBuilding, setAddingBuilding] = useState(false);
  const [newUnit, setNewUnit] = useState('');
  const [newBuilding, setNewBuilding] = useState('');
  const [saving, setSaving] = useState(false);

  const allPhones = [
    ...(has(L.phone) ? [{ value: L.phone, label: 'Primary' }] : []),
    ...(Array.isArray(L.additional_phones) ? L.additional_phones.filter(Boolean).map((p) => ({ value: p, label: 'Secondary' })) : []),
  ];
  const allEmails = [
    ...(has(L.email) ? [{ value: L.email, label: 'Primary' }] : []),
    ...(Array.isArray(L.additional_emails) ? L.additional_emails.filter(Boolean).map((e) => ({ value: e, label: 'Secondary' })) : []),
  ];

  const saveAdditional = async (field, value) => {
    if (!value.trim() || !landlordId) return;
    setSaving(true);
    try {
      const current = Array.isArray(L[field]) ? L[field] : [];
      await base44.entities.Landlord.update(landlordId, { [field]: [...current, value.trim()] });
      queryClient.invalidateQueries({ queryKey: ['landlord', landlordId] });
      toast.success(field === 'additional_phones' ? 'Number added' : 'Email added');
    } catch (e) {
      toast.error('Failed to save: ' + (e?.message || 'unknown error'));
    } finally {
      setSaving(false);
    }
  };
  const handleAddPhone = async () => { await saveAdditional('additional_phones', newPhone); setNewPhone(''); setAddingPhone(false); };
  const handleAddEmail = async () => { await saveAdditional('additional_emails', newEmail); setNewEmail(''); setAddingEmail(false); };

  // Save unit_reference / project_name directly on the Landlord entity (single-value fields, not arrays).
  const saveLandlordField = async (field, value) => {
    if (!value.trim() || !landlordId) return;
    setSaving(true);
    try {
      await base44.entities.Landlord.update(landlordId, { [field]: value.trim() });
      queryClient.invalidateQueries({ queryKey: ['landlord', landlordId] });
      toast.success(field === 'unit_reference' ? 'Unit number saved' : 'Building name saved');
    } catch (e) {
      toast.error('Failed to save: ' + (e?.message || 'unknown error'));
    } finally {
      setSaving(false);
    }
  };
  const handleAddUnit = async () => { await saveLandlordField('unit_reference', newUnit); setNewUnit(''); setAddingUnit(false); };
  const handleAddBuilding = async () => { await saveLandlordField('project_name', newBuilding); setNewBuilding(''); setAddingBuilding(false); };

  const handleDownload = async () => {
    const name = L.full_name_en || L.full_name || 'Unnamed landlord';
    const phone = L.phone || '';
    const email = L.email || '';
    const unitRefVal = L.unit_reference || U.unit_no || '';
    const towerName = L.project_name || U.building_name || '';
    const noteParts = [];
    if (unitRefVal) noteParts.push(`Unit: ${unitRefVal}`);
    if (towerName) noteParts.push(`Tower: ${towerName}`);
    const vcfLines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${name}`,
      `N:${name};;;;`,
    ];
    if (phone) vcfLines.push(`TEL;TYPE=CELL:${phone}`);
    if (email) vcfLines.push(`EMAIL:${email}`);
    if (unitRefVal) vcfLines.push(`ORG:${towerName || ''};Unit ${unitRefVal}`);
    else if (towerName) vcfLines.push(`ORG:${towerName}`);
    if (noteParts.length) vcfLines.push(`NOTE:${noteParts.join(' | ')}`);
    vcfLines.push('END:VCARD');
    const vcf = vcfLines.join('\n');
    const blob = new Blob([vcf], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_')}_contact.vcf`;
    a.click();
    URL.revokeObjectURL(url);

    // Notify Ahmad
    try {
      await base44.functions.invoke('notifyDownloadToAhmad', { landlord_id: landlordId, landlord_name: name });
      toast.success('Contact downloaded · Ahmad notified');
    } catch (err) {
      console.error('Notification failed:', err);
      toast.error('Downloaded but notification failed');
    }
  };
  const name = L.full_name_en || L.full_name || 'Unnamed landlord';
  const initials = String(name).trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const flag = flagFor(L.nationality);
  const lang = LANG_LABEL[L.preferred_language];

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
  const checkedShort = L.imessage_checked_at
    ? new Date(L.imessage_checked_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null;

  return (
    <div
      style={{
        borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(201,162,75,0.08), rgba(11,31,58,0.95))',
        border: '1px solid rgba(201,162,75,0.25)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
        padding: '16px 18px',
        animation: 'ld-rise 0.4s cubic-bezier(0.22,1,0.36,1) both',
      }}
    >
      {/* TIER 1 — Identity */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ flex: 'none', width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: GOLD, background: 'linear-gradient(135deg, rgba(201,162,75,0.18), rgba(201,162,75,0.08))', border: '1px solid rgba(201,162,75,0.4)', boxShadow: '0 4px 12px rgba(201,162,75,0.15), inset 0 1px 0 rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          {photoUrl ? (
            <img src={photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
          ) : null}
          <span style={{ display: photoUrl ? 'none' : 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>{initials}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0, marginTop: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontFamily: "'Cormorant Garamond','Playfair Display',serif", fontWeight: 600, fontSize: 22, letterSpacing: '-0.01em', background: 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(201,162,75,0.85))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', lineHeight: 1.05 }}>{name}</h1>
            {flag && <span style={{ fontSize: 18, lineHeight: 1 }} title={L.nationality}>{flag}</span>}
            {lang && <Pill color="rgba(255,255,255,0.85)">{lang}</Pill>}
            {(has(L.phone) || has(L.email) || has(name)) && (
              <button onClick={handleDownload} title="Download contact (notifies Ahmad)" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 999, cursor: 'pointer', background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.4)', color: '#34d399', flex: 'none' }}>
                <Download size={12} />
              </button>
            )}
          </div>
          {has(L.full_name_ar) && (
            <div dir="rtl" style={{ marginTop: 2, fontFamily: "'Cormorant Garamond',serif", fontSize: 16, color: 'rgba(255,255,255,0.6)' }}>{L.full_name_ar}</div>
          )}
        </div>
      </div>

      {/* Last Activity indicator — green dot + timestamp */}
      {(() => {
        const ts = L.last_activity_at || L.updated_date || L.ai_processed_at || null;
        if (!ts) return null;
        const d = new Date(ts);
        if (isNaN(d)) return null;
        const label = d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9 }}>
            <span style={{ flex: 'none', width: 7, height: 7, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px rgba(52,211,153,0.7)' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>Last Activity: {label}</span>
          </div>
        );
      })()}

      {/* TIER 2 — Property + price (more vibrant), sits tight under the name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5, color: 'rgba(255,255,255,0.75)' }}>
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
        {/* Inline Add Unit / Add Building — shown when the data is missing, same pattern as Add Number */}
        {!has(unitRef) && (
          addingUnit ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <input autoFocus value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="Unit no…" onKeyDown={(e) => e.key === 'Enter' && handleAddUnit()} style={{ ...smallInputStyle, width: 110 }} />
              <button onClick={handleAddUnit} disabled={saving} style={addBtnStyle}>{saving ? <Loader2 size={11} className="animate-spin" /> : 'Add'}</button>
              <button onClick={() => { setAddingUnit(false); setNewUnit(''); }} style={cancelBtnStyle}><X size={11} /></button>
            </div>
          ) : (
            <button onClick={() => setAddingUnit(true)} style={addPillStyle}><Plus size={10} /> Add Unit</button>
          )
        )}
        {!has(projectName) && (
          addingBuilding ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <input autoFocus value={newBuilding} onChange={(e) => setNewBuilding(e.target.value)} placeholder="Building name…" onKeyDown={(e) => e.key === 'Enter' && handleAddBuilding()} style={{ ...smallInputStyle, width: 150 }} />
              <button onClick={handleAddBuilding} disabled={saving} style={addBtnStyle}>{saving ? <Loader2 size={11} className="animate-spin" /> : 'Add'}</button>
              <button onClick={() => { setAddingBuilding(false); setNewBuilding(''); }} style={cancelBtnStyle}><X size={11} /></button>
            </div>
          ) : (
            <button onClick={() => setAddingBuilding(true)} style={addPillStyle}><Plus size={10} /> Add Building</button>
          )
        )}
      </div>

      {/* Contact list — every phone + email, each with its channel icons right next to it */}
      {(allPhones.length > 0 || allEmails.length > 0) && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allPhones.map((p, i) => (
            <PhoneContactRow key={'p' + i} phone={p.value} landlord={L} />
          ))}
          {allEmails.map((e, i) => (
            <EmailContactRow key={'e' + i} email={e.value} />
          ))}
        </div>
      )}

      {/* Add Number / Add Email — right after the contact details */}
      <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {addingPhone ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <input autoFocus value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+971…" onKeyDown={(e) => e.key === 'Enter' && handleAddPhone()} style={{ ...smallInputStyle, width: 120 }} />
            <button onClick={handleAddPhone} disabled={saving} style={addBtnStyle}>{saving ? <Loader2 size={11} className="animate-spin" /> : 'Add'}</button>
            <button onClick={() => { setAddingPhone(false); setNewPhone(''); }} style={cancelBtnStyle}><X size={11} /></button>
          </div>
        ) : (
          <button onClick={() => setAddingPhone(true)} style={addPillStyle}><Plus size={10} /> Add Number</button>
        )}
        {addingEmail ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <input autoFocus value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@…" onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()} style={{ ...smallInputStyle, width: 150 }} />
            <button onClick={handleAddEmail} disabled={saving} style={addBtnStyle}>{saving ? <Loader2 size={11} className="animate-spin" /> : 'Add'}</button>
            <button onClick={() => { setAddingEmail(false); setNewEmail(''); }} style={cancelBtnStyle}><X size={11} /></button>
          </div>
        ) : (
          <button onClick={() => setAddingEmail(true)} style={addPillStyle}><Plus size={10} /> Add Email</button>
        )}
      </div>

      {/* TIER 3 — Status chips (more vibrant) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 11 }}>
        {has(L.landlord_archetype) && (
          <Pill color="#818cf8" bg="rgba(99,102,241,0.2)" border="rgba(99,102,241,0.45)">
            {ARCHETYPE_LABEL[L.landlord_archetype] || titleize(L.landlord_archetype)}
          </Pill>
        )}
        {has(L.lead_type) && (
          <Pill color="#2dd4bf" bg="rgba(20,184,166,0.2)" border="rgba(20,184,166,0.45)">
            {LEAD_TYPE_LABEL[L.lead_type] || titleize(L.lead_type)}
          </Pill>
        )}
        {has(L.stage) && (
          <Pill outline color="#fbbf24" border="rgba(245,158,11,0.5)" title={has(L.sub_stage) ? titleize(L.sub_stage) : undefined} boxShadow="0 0 10px rgba(245,158,11,0.2)">
            ◷ {STAGE_LABEL[L.stage] || titleize(L.stage)}
          </Pill>
        )}
        {rapport && (
          <Pill color={rapport.color} bg={rapport.bg} border={rapport.border} boxShadow={rapport.boxShadow}>{rapport.label}</Pill>
        )}
        {mom && (
          <Pill color={mom.color} bg={mom.bg} border={mom.border}>⚡ {titleize(L.ai_momentum)}</Pill>
        )}
      </div>

      {/* Refined straight divider after Tier 3 */}
      <StraightDivider color={GOLD} opacity={0.45} className="my-4" />

      {/* TIER 4 — Deal facts strip */}
      {(mandateLine || commissionPct || winPct != null || has(L.form_a_contract_number) || expiry || daysInStage || source || residency || has(L.phone)) && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Inline deal facts — single row */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            <Fact label="Mandate" value={mandateLine || null} />
            <Fact
              label="Comm"
              value={commissionPct ? `${commissionPct}${estComm ? ` (~${estComm})` : ''}` : null}
              valueColor={GOLD}
            />
            <Fact label="Form A" value={has(L.form_a_contract_number) ? L.form_a_contract_number : null} />
            {expiry && <Fact label="Expiry" value={expiry.text} valueColor={expiry.color} />}
            <Fact label="Stage" value={daysInStage} />
            <Fact label="Source" value={source} />
            <Fact label="Residency" value={residency} />
          </div>
          {/* Row C — channel micro-line + download button (visible for all agents) */}
          {(has(L.phone) || has(L.email) || has(name)) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
              {has(L.phone) && (
                <>
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
                </>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}