import { cn } from '@/lib/utils';
import { Phone, MessageCircle, Mail, Trash2, UserMinus, ExternalLink, CheckCircle2, CalendarClock, Camera, Film, Image, Box, FileText, Loader2, GripVertical, Sparkles, MapPin, ArrowRight, ChevronRight } from 'lucide-react';
import SendToClosingButton from '@/components/closing/SendToClosingButton';
import ChannelAvailabilityIcons from './ChannelAvailabilityIcons';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { normalizePhone, waMeUrl } from '@/lib/phone';
import { nextStepFor, getCaptureStatus, STAGE_ORDER } from '@/lib/landlordStageGuide';
import StageArrows from './StageArrows';
import { useState, memo, useEffect } from 'react';

// ── Private Bank design tokens ──────────────────────────────────────────────
const GOLD = '#D8B26A';
const NAME = '#E9EDF6';
const SLATE = '#A7B0C4';
const MONEY = '#8A93A8';
const CLARET = '#B4463F';
const CLARET_TEXT = '#C86F66';
const CLARET_BG = 'rgba(180,70,63,0.08)';
const CLARET_BORDER = 'rgba(180,70,63,0.35)';
const HAIR = 'rgba(255,255,255,0.07)';
const HAIR2 = 'rgba(255,255,255,0.10)';
const WELL = '#111A33';
const SAGE = '#A9C6B0';
const SAGE_BORDER = 'rgba(147,180,155,0.35)';
const CHAMPAGNE = 'linear-gradient(115deg,#F0D89E,#D8B26A 55%,#AA8140)';

// One chip language — hairline ghost chip. Differentiate by text, not color.
function Chip({ children, dot, style, title }) {
  return (
    <span title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      background: 'transparent', border: `1px solid ${HAIR2}`,
      color: SLATE, fontSize: 9.5, fontWeight: 500,
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
        width: 28, height: 28, borderRadius: 8,
        background: 'transparent', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? 'rgba(255,255,255,0.25)' : danger && h ? CLARET_TEXT : h ? NAME : 'rgba(233,237,246,0.45)',
        transition: 'color 150ms ease',
      }}
    >
      {children}
    </button>
  );
}

// Trust-ring avatar — 29px, 1.5px hairline track + gold arc (claret when trust < 40), initial on a gold-tint fill.
function TrustRing({ score, size = 29, children }) {
  const stroke = 1.5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const s = Math.max(0, Math.min(100, score || 0));
  const arc = (s / 100) * circ;
  const arcColor = s < 40 ? CLARET_TEXT : GOLD;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)', overflow: 'visible' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={arcColor} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${arc} ${circ - arc}`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ position: 'absolute', width: size - 6, height: size - 6, borderRadius: 999, background: 'rgba(216,178,106,0.06)' }} />
        <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </span>
      </div>
    </div>
  );
}

export const ARCHETYPE_COLORS = {
  professional_investor: 'bg-accent/10 text-accent border-accent/20',
  individual_end_user_relocating: 'bg-accent/10 text-accent border-accent/20',
  distressed_seller: 'bg-red-500/10 text-red-600 border-red-500/20',
  inherited_owner: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  developer_resale: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  overseas_owner: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  first_time_seller: 'bg-accent/10 text-accent border-accent/20',
  portfolio_optimizer: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  accidental_landlord: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  speculator_flipping: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
};

export const ARCHETYPE_LABELS = {
  professional_investor: 'Pro Investor',
  individual_end_user_relocating: 'Relocating',
  distressed_seller: 'Distressed',
  inherited_owner: 'Inherited',
  developer_resale: 'Developer',
  overseas_owner: 'Overseas',
  first_time_seller: 'First Time',
  portfolio_optimizer: 'Portfolio',
  accidental_landlord: 'Accidental',
  speculator_flipping: 'Speculator',
};

const STAGE_LABELS = {
  initial_contact: 'Initial Contact',
  attempted_to_contact: 'Attempted to Contact',
  price_discovery: 'Price Discovery',
  listing_commitment: 'Listing Commitment',
  form_a_initiation: 'Form A Initiation',
  form_a_signing: 'Form A Signing',
  owner_documents: 'Owner Documents',
  photos_videos: 'Photos / Videos',
  photographer_scheduling: 'Documentation / verification by admin',
  listing_creation: 'Listing Creation',
  internal_verification: 'Internal Verification',
  listing_publication: 'Listing Publication',
  final_confirmation: 'Final Confirmation',
};

function LandlordCard({ landlord, isSelected, isDragging, onClick, isChecked, onToggleCheck, users = [], onSingleAssign, photographyTasks = [], getPhotoForPhone, dragHandleProps, onStageChange, isColumnSiren = true }) {
  const [twilioCalling, setTwilioCalling] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [photoBroken, setPhotoBroken] = useState(false);
  const [dealFoldOpen, setDealFoldOpen] = useState(false);
  const [dealPreview, setDealPreview] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { setPhotoBroken(false); }, [landlord.id, landlord.phone, landlord.whatsapp]);

  const archetypeLabel = ARCHETYPE_LABELS[landlord.landlord_archetype] || 'Landlord';
  const stageLabel = STAGE_LABELS[landlord.stage] || landlord.stage;
  // Stage guidance (static config) — next action line + capture-completeness dot.
  const nextStep = nextStepFor(landlord.stage);
  const capture = getCaptureStatus(landlord, landlord.stage);

  // Find the landlord's PhotographyTask (same logic as detail panel)
  const landlordTask = photographyTasks.find(task => task.landlord_id === landlord.id);

  // Media status logic - EXACT same as "Media for listing" section in detail panel
  const getMediaStatus = () => {
    if (!landlordTask) return { complete: false, label: 'No task' };
    const isHandedToListing = landlordTask.task_stage === 'handed_to_listing';
    const hasAllLinks = landlordTask.tour_3d_link && landlordTask.video_link && landlordTask.photos_link;
    const isComplete = isHandedToListing && hasAllLinks;
    return {
      complete: isComplete,
      label: isComplete ? 'Media complete' : 'Media incomplete',
    };
  };

  const mediaStatus = getMediaStatus();
  const showMediaBadge = landlord.stage === 'photographer_scheduling';
  const isDocStage = landlord.stage === 'photographer_scheduling';

  // Get WhatsApp profile photo if available (matched by phone)
  const phoneForLookup = landlord.phone || landlord.whatsapp;
  const photoUrl = !photoBroken && getPhotoForPhone ? getPhotoForPhone(phoneForLookup) : null;

  // Fetch documents directly from entity for cards in the photographer_scheduling stage
  const { data: rawDocs = [] } = useQuery({
    queryKey: ['landlord-docs-entity', landlord.id],
    queryFn: () => base44.entities.LandlordDocument.filter({ landlord_id: landlord.id }),
    enabled: isDocStage,
    staleTime: 60_000,
  });

  const docBadge = (() => {
    if (!isDocStage) return null;
    const docs = rawDocs;
    const byType = {};
    for (const d of docs) byType[d.document_type] = d.status;

    const isReceived = (type) => byType[type] === 'received' || byType[type] === 'verified';
    const isVerified = (type) => byType[type] === 'verified';

    const identityReceived = isReceived('passport') || isReceived('emirates_id');
    const identityVerified = isVerified('passport') || isVerified('emirates_id');
    const ownershipReceived = isReceived('ownership_proof');
    const ownershipVerified = isVerified('ownership_proof');
    const formAReceived = isReceived('form_a');
    const formAVerified = isVerified('form_a');

    const allVerified = identityVerified && ownershipVerified && formAVerified;
    const allReceived = identityReceived && ownershipReceived && formAReceived;

    if (allVerified) return { label: 'Docs verified', green: true };
    if (allReceived) return { label: 'Docs ready for review', green: false };
    return null;
  })();

  const e164 = normalizePhone(landlord.phone);
  const askingPrice = landlord.asking_price_history?.[0]?.price;
  const commission = landlord.estimated_commission_aed;

  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Landlord.delete(landlord.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
      toast.success('Landlord deleted');
    },
    onError: (err) => toast.error('Delete failed: ' + (err?.message || 'unknown error')),
  });

  const handleCall = async (e) => {
    e.stopPropagation();
    if (!e164) {
      toast.error('No valid phone number');
      return;
    }
    setTwilioCalling(true);
    try {
      // Get first available Twilio number
      const numsRes = await base44.functions.invoke('getTwilioNumbers', {});
      const nums = numsRes.data?.numbers || [];
      if (!nums.length) {
        toast.error('No Twilio numbers configured');
        setTwilioCalling(false);
        return;
      }
      const fromPhone = nums[0].phone_number;

      const res = await base44.functions.invoke('twilioMakeCall', {
        lead_id: landlord.id,
        to_phone: e164,
        from_phone: fromPhone,
        lead_name: landlord.full_name_en || landlord.full_name,
      });

      if (res.data?.ok) {
        toast.success(`📞 Calling ${landlord.full_name_en || landlord.phone}…`);
      } else {
        toast.error(res.data?.error || 'Call failed');
      }
    } catch (err) {
      toast.error('Call failed: ' + (err?.message || 'unknown error'));
    } finally {
      setTwilioCalling(false);
    }
  };

  const handleWhatsApp = (e) => {
    e.stopPropagation();
    if (!e164) {
      toast.error('No valid phone number');
      return;
    }
    window.open(waMeUrl(e164), '_blank', 'noopener,noreferrer');
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`Delete ${landlord.full_name_en || 'this landlord'}? This can't be undone.`)) {
      deleteMutation.mutate();
    }
  };

  const handleExportVCard = (e) => {
    e.stopPropagation();
    // Placeholder for vCard export - wire to actual function later
    toast.info('vCard export coming soon');
  };

  // Calculate days until mandate expires
  const daysUntilMandateExpiry = (() => {
    if (!landlord.mandate_expires_at) return null;
    const expiry = new Date(landlord.mandate_expires_at);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays;
  })();

  const showMandateWarning = daysUntilMandateExpiry !== null && daysUntilMandateExpiry <= 14 && daysUntilMandateExpiry >= 0;

  // Card-level urgency (drives the NEXT well claret rail + quiet dot).
  const strikeNow = (landlord.urgency_score >= 60) || showMandateWarning;
  const strikeDays = landlord.days_in_stage;
  // ONE SIREN PER COLUMN — only the most-overdue urgent card in a column carries the
  // full claret left rail + "STRIKE NOW · nD" chip; every other urgent card downgrades to
  // a quiet 6px claret dot beside its aging chip. isColumnSiren defaults true (e.g. the
  // DragOverlay card, which isn't attached to a column) so the dragged card keeps its alert.
  const showSiren = strikeNow && isColumnSiren;

  // Get contracts from form_a_contracts array, fallback to legacy single field
  const contracts = (() => {
    if (landlord.form_a_contracts && landlord.form_a_contracts.length > 0) {
      return landlord.form_a_contracts;
    }
    if (landlord.form_a_contract_number) {
      return [{
        contract_number: landlord.form_a_contract_number,
        asking_price_aed: landlord.asking_price_aed,
        mandate_expires_at: landlord.mandate_expires_at,
      }];
    }
    return [];
  })();

  // Helper to calculate expiry days remaining (for the EXP chip)
  const expiryDays = (expiryDate) => {
    if (!expiryDate) return null;
    const d = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
    return isNaN(d) ? null : d;
  };

  // Format price with commas
  const formatPrice = (price) => {
    if (!price) return 'N/A';
    return price.toLocaleString('en-US');
  };

  // Calculate and format commission
  const getCommissionInfo = (contract) => {
    const commissionPct = contract.commission_pct_negotiated || landlord.commission_pct_negotiated;
    const contractAsking = contract.asking_price_aed || landlord.asking_price_aed;
    if (!commissionPct || !contractAsking) return null;
    const commissionAmount = contractAsking * (commissionPct / 100);
    return { pct: commissionPct, amount: commissionAmount };
  };

  // Valuation delta vs ask (gold text)
  const valuationDelta = (() => {
    if (!landlord.ai_estimated_value_aed || !askingPrice) return null;
    const diff = landlord.ai_estimated_value_aed - askingPrice;
    const pct = Math.round((diff / askingPrice) * 100);
    if (pct === 0) return null;
    return { pct, sign: pct > 0 ? '+' : '' };
  })();

  // Journey hairline — stage position across the 13-stage mandate→confirmation arc.
  const stageIndex = STAGE_ORDER.indexOf(landlord.stage);
  const journeyN = Math.min(Math.max(stageIndex + 1, 1), 13);
  const journeyFill = Math.min(Math.max(stageIndex, 0), 13) / 13 * 100;

  // Deal-intelligence fold — only when BOTH a Form A block and a valuation strip exist.
  const hasFormA = contracts.length > 0;
  const hasValuation = !!landlord.ai_estimated_value_aed;
  const dealFoldable = hasFormA || hasValuation;
  const dealOpen = dealFoldable ? (dealFoldOpen || dealPreview) : true;

  // Root shadow / border / transform — motionless luxury, light does the work.
  const baseShadow = '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.35)';
  let boxShadow = showSiren ? `inset 2px 0 0 0 ${CLARET}, ${baseShadow}` : baseShadow;
  if (isDragging) boxShadow = '0 22px 48px rgba(0,0,0,0.6)';
  else if (hovered) boxShadow = (showSiren ? `inset 2px 0 0 0 ${CLARET}, ` : '') + '0 14px 30px rgba(0,0,0,0.5)';
  const border = isDragging
    ? 'rgba(216,178,106,0.3)'
    : isSelected
      ? 'rgba(216,178,106,0.5)'
      : hovered
        ? 'rgba(216,178,106,0.22)'
        : HAIR;

  return (
    <a
      href={`/landlord/${landlord.id}`}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        navigate(`/landlord/${landlord.id}`);
      }}
      className={cn('rounded-2xl p-2 cursor-pointer transition-all duration-200 block')}
      style={{
        background: '#0E1428',
        border: `1px solid ${border}`,
        borderRadius: 14,
        boxShadow,
        position: 'relative',
        transform: hovered && !isDragging ? 'translateY(-1px)' : 'none',
        transition: 'transform 180ms ease-out, border-color 180ms ease-out, box-shadow 180ms ease-out',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setDealPreview(false); }}
    >
      {/* Hover gold top-edge gradient line — fades in on hover. */}
      <div style={{
        position: 'absolute', top: 0, left: 14, right: 14, height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(216,178,106,0.55), transparent)',
        opacity: hovered ? 1 : 0, transition: 'opacity 180ms ease',
        pointerEvents: 'none', borderRadius: '14px 14px 0 0',
      }} />

      {/* Top row: grip handle + checkbox + avatar + name */}
      <div className="flex items-center gap-1.5">
        {dragHandleProps && (
          <button
            type="button"
            {...dragHandleProps}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 -ml-0.5 flex items-center justify-center w-4 h-5 rounded cursor-grab active:cursor-grabbing touch-none transition-colors"
            title="Drag to move stage"
            aria-label="Drag to move stage"
            style={{ color: 'rgba(255,255,255,0.3)', background: 'transparent', border: 'none' }}
          >
            <GripVertical className="w-3 h-3" strokeWidth={1.5} />
          </button>
        )}
        <input
          type="checkbox"
          checked={!!isChecked}
          onChange={(e) => { e.stopPropagation(); onToggleCheck?.(landlord.id); }}
          onClick={(e) => e.stopPropagation()}
          className="w-3.5 h-3.5 accent-amber-500 shrink-0 cursor-pointer"
        />
        <TrustRing score={landlord.trust_score}>
          {photoUrl ? (
            <img src={photoUrl} alt="" className="w-[20px] h-[20px] rounded-full object-cover" onError={() => setPhotoBroken(true)} />
          ) : (
            <span style={{ fontSize: 12, fontWeight: 600, color: GOLD, fontFamily: "'Montserrat',sans-serif" }}>
              {landlord.full_name_en?.[0]?.toUpperCase() || '?'}
            </span>
          )}
        </TrustRing>
        <p className="text-[13px] truncate flex-1" style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: NAME }} title={landlord.full_name_en || 'Unknown'}>{landlord.full_name_en || 'Unknown'}</p>
        {landlord.phone && (
          <span className="shrink-0 text-[9px] flex items-center gap-0.5" style={{ color: SLATE, fontVariantNumeric: 'tabular-nums' }} title={`Primary: ${landlord.phone}`}>
            <Phone className="w-2.5 h-2.5" strokeWidth={1.5} />
            {landlord.phone}
          </span>
        )}
        <ChannelAvailabilityIcons landlord={landlord} />
      </div>

      {/* Badges row — one chip language, ghost hairline. Stage chip keeps a gold status dot with a still halo. */}
      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
        <Chip>{archetypeLabel}</Chip>
        <Chip
          dot={<span style={{ width: 6, height: 6, borderRadius: 999, background: GOLD, flex: 'none', boxShadow: '0 0 7px rgba(216,178,106,0.8)' }} title={capture.complete ? 'Stage data captured' : `Missing: ${capture.missing.join(', ')}`} />}
          title={capture.complete ? 'Stage data captured' : `Missing: ${capture.missing.join(', ')}`}
        >
          {stageLabel}
        </Chip>
        {landlord.handover_status === 'Handed Over' && (
          <Chip dot={<CheckCircle2 className="w-2.5 h-2.5" strokeWidth={1.5} style={{ color: SAGE, flex: 'none' }} />} title="Handed over">
            Handed Over
          </Chip>
        )}
        {landlord.handover_status === 'Handover Booked' && (
          <Chip
            dot={<CalendarClock className="w-2.5 h-2.5" strokeWidth={1.5} style={{ color: GOLD, flex: 'none' }} />}
            title={landlord.handover_appointment_at ? `Handover appointment: ${new Date(landlord.handover_appointment_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'Handover booked'}
          >
            HO Booked{landlord.handover_appointment_at ? ` · ${new Date(landlord.handover_appointment_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
          </Chip>
        )}
        {landlord.unit_layout && (
          <Chip>{landlord.unit_layout}</Chip>
        )}
        {showMediaBadge && (
          <Chip
            dot={mediaStatus.complete
              ? <span style={{ width: 6, height: 6, borderRadius: 999, background: SAGE, flex: 'none' }} />
              : <Camera className="w-2.5 h-2.5" strokeWidth={1.5} style={{ color: SLATE, flex: 'none' }} />}
          >
            {mediaStatus.label}
          </Chip>
        )}
        {docBadge && (
          <Chip
            dot={docBadge.green
              ? <span style={{ width: 6, height: 6, borderRadius: 999, background: SAGE, flex: 'none' }} />
              : <FileText className="w-2.5 h-2.5" strokeWidth={1.5} style={{ color: SLATE, flex: 'none' }} />}
          >
            {docBadge.label}
          </Chip>
        )}
      </div>

      {/* NEXT action ledger — gold "Next" tag + action text in a hairline well, with a 2px inner-left rail (claret when urgent) and a hover → arrow. */}
      {nextStep && (
        <div className="flex items-start gap-1.5 mt-1.5 pl-2.5 pr-2 py-1.5 rounded-md relative" style={{ background: WELL, border: `1px solid ${strikeNow ? 'rgba(180,70,63,0.25)' : HAIR}` }}>
          <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: strikeNow ? 'rgba(180,70,63,0.65)' : 'rgba(216,178,106,0.55)', borderRadius: '2px 0 0 2px' }} />
          <span className="shrink-0" style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: GOLD }}>Next</span>
          <span className="text-[11.5px] leading-snug line-clamp-2" style={{ color: '#D7DDEA', lineHeight: 1.5 }}>{nextStep}</span>
          <ArrowRight
            className="w-3.5 h-3.5"
            strokeWidth={1.5}
            style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: GOLD, opacity: hovered ? 0.7 : 0, transition: 'opacity 180ms ease', flex: 'none' }}
          />
        </div>
      )}

      {/* Individual media badges - shown in ALL stages when links exist */}
      {landlordTask && (
        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
          {landlordTask.tour_3d_link && (
            <Chip dot={<Box className="w-2.5 h-2.5" strokeWidth={1.5} style={{ color: SLATE, flex: 'none' }} />}>360</Chip>
          )}
          {landlordTask.video_link && (
            <Chip dot={<Film className="w-2.5 h-2.5" strokeWidth={1.5} style={{ color: SLATE, flex: 'none' }} />}>Video</Chip>
          )}
          {landlordTask.photos_link && (
            <Chip dot={<Image className="w-2.5 h-2.5" strokeWidth={1.5} style={{ color: SLATE, flex: 'none' }} />}>Photos</Chip>
          )}
        </div>
      )}

      {/* Additional contact indicators */}
      {((Array.isArray(landlord.additional_phones) && landlord.additional_phones.length > 0) ||
        (Array.isArray(landlord.additional_emails) && landlord.additional_emails.length > 0)) && (
        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
          {Array.isArray(landlord.additional_phones) && landlord.additional_phones.length > 0 && (
            <Chip dot={<Phone className="w-2.5 h-2.5" strokeWidth={1.5} style={{ color: SLATE, flex: 'none' }} />} title={`${landlord.additional_phones.length} additional phone(s)`}>
              +{landlord.additional_phones.length}
            </Chip>
          )}
          {Array.isArray(landlord.additional_emails) && landlord.additional_emails.length > 0 && (
            <Chip dot={<Mail className="w-2.5 h-2.5" strokeWidth={1.5} style={{ color: SLATE, flex: 'none' }} />} title={`${landlord.additional_emails.length} additional email(s)`}>
              +{landlord.additional_emails.length}
            </Chip>
          )}
        </div>
      )}

      {/* Project (ghost) + unit reference (ghost-gold chip with map-pin) */}
      {(landlord.project_name || landlord.unit_reference) && (
        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
          {landlord.project_name && (
            <Chip title={landlord.project_name}>{landlord.project_name}</Chip>
          )}
          {landlord.unit_reference && (
            <Chip
              dot={<MapPin className="w-2.5 h-2.5" strokeWidth={1.5} style={{ color: GOLD, flex: 'none' }} />}
              style={{ color: GOLD, borderColor: 'rgba(216,178,106,0.35)', fontVariantNumeric: 'tabular-nums', fontSize: 10 }}
              title={landlord.unit_reference}
            >
              {landlord.unit_reference}
            </Chip>
          )}
        </div>
      )}

      {/* Deal intelligence — fold Form A + valuation into one summary line when both exist. */}
      {dealFoldable ? (
        <div className="mt-1.5">
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setDealFoldOpen((v) => !v); }}
            onMouseEnter={() => setDealPreview(true)}
            onMouseLeave={() => setDealPreview(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setDealFoldOpen((v) => !v); } }}
            title={dealOpen ? 'Click to fold' : 'Click to expand deal details'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', borderRadius: 8, background: WELL, border: `1px solid ${HAIR}`, cursor: 'pointer' }}
          >
            {hasFormA && (
              <>
                <FileText className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: SLATE }} />
                <span style={{ fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: SLATE, fontVariantNumeric: 'tabular-nums' }}>
                  {contracts[0]?.contract_number || 'Form A'}
                </span>
                <span style={{ fontSize: 9.5, color: NAME, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  AED {formatPrice(contracts[0]?.asking_price_aed)}
                </span>
                {expiryDays(contracts[0]?.mandate_expires_at) != null && (
                  <span style={{ fontSize: 8.5, padding: '1px 5px', borderRadius: 999, border: '1px solid rgba(216,178,106,0.35)', color: GOLD, fontVariantNumeric: 'tabular-nums' }}>
                    EXP {expiryDays(contracts[0]?.mandate_expires_at)}D
                  </span>
                )}
              </>
            )}
            {hasValuation && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: hasFormA ? 6 : 0, fontSize: 9.5, color: NAME, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                <Sparkles className="w-2.5 h-2.5" strokeWidth={1.5} style={{ color: GOLD }} />
                {(landlord.ai_estimated_value_aed / 1e6).toFixed(2)}M
              </span>
            )}
            {valuationDelta && (
              <span style={{ fontSize: 8.5, color: GOLD, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {valuationDelta.sign}{valuationDelta.pct}%
              </span>
            )}
            <ChevronRight
              className="shrink-0"
              strokeWidth={1.5}
              style={{ marginLeft: 'auto', width: 13, height: 13, color: SLATE, transform: dealOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 180ms ease' }}
            />
          </div>
          <div style={{ maxHeight: dealOpen ? 600 : 0, opacity: dealOpen ? 1 : 0, overflow: 'hidden', transition: 'max-height 180ms ease, opacity 180ms ease' }}>
            <div className="mt-1 space-y-1">
              {contracts.map((contract, idx) => {
                const expD = expiryDays(contract.mandate_expires_at);
                const comm = getCommissionInfo(contract);
                return (
                  <div key={contract.contract_number || idx} style={{ background: WELL, border: `1px solid ${HAIR}`, borderRadius: 8, padding: '5px 7px' }}>
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: SLATE }} />
                      <span className="text-[9px] font-medium" style={{ letterSpacing: '0.06em', textTransform: 'uppercase', color: SLATE, fontVariantNumeric: 'tabular-nums' }}>
                        {contract.contract_number || 'Unknown'}
                      </span>
                      {expD != null && (
                        <Chip style={{ marginLeft: 'auto', color: GOLD, borderColor: 'rgba(216,178,106,0.35)', fontSize: 8.5, padding: '1px 6px' }}>
                          EXP {expD}D
                        </Chip>
                      )}
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: NAME, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      AED {formatPrice(contract.asking_price_aed)}
                    </p>
                    {comm && (
                      <p className="text-[9px] mt-0.5" style={{ color: GOLD, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {comm.pct}% · AED {comm.amount.toLocaleString('en-US')}
                      </p>
                    )}
                  </div>
                );
              })}
              {landlord.ai_estimated_value_aed && (
                <div className="px-2 py-1.5 rounded-md" style={{ background: WELL, border: `1px solid ${HAIR}` }}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: NAME, fontVariantNumeric: 'tabular-nums' }}>
                      <Sparkles className="w-3 h-3" strokeWidth={1.5} style={{ color: GOLD }} />
                      {(landlord.ai_estimated_value_aed / 1e6).toFixed(2)}M
                    </span>
                    {landlord.ai_estimated_price_sqft && (
                      <span className="text-[9px]" style={{ color: MONEY, fontVariantNumeric: 'tabular-nums' }}>
                        {landlord.ai_estimated_price_sqft.toLocaleString()} /sqft
                      </span>
                    )}
                    {landlord.ai_valuation_confidence && (
                      <Chip style={{ color: SAGE, borderColor: SAGE_BORDER, fontSize: 8.5, padding: '1px 6px' }}>
                        {landlord.ai_valuation_confidence}
                      </Chip>
                    )}
                  </div>
                  {valuationDelta && (
                    <p className="text-[9px] mt-1" style={{ color: GOLD, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {valuationDelta.sign}{valuationDelta.pct}% vs ask
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Form A wells (only when no valuation to fold with) */}
          {hasFormA && (
            <div className="mt-1.5 space-y-1">
              {contracts.map((contract, idx) => {
                const expD = expiryDays(contract.mandate_expires_at);
                const comm = getCommissionInfo(contract);
                return (
                  <div key={contract.contract_number || idx} style={{ background: WELL, border: `1px solid ${HAIR}`, borderRadius: 8, padding: '5px 7px' }}>
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: SLATE }} />
                      <span className="text-[9px] font-medium" style={{ letterSpacing: '0.06em', textTransform: 'uppercase', color: SLATE, fontVariantNumeric: 'tabular-nums' }}>
                        {contract.contract_number || 'Unknown'}
                      </span>
                      {expD != null && (
                        <Chip style={{ marginLeft: 'auto', color: GOLD, borderColor: 'rgba(216,178,106,0.35)', fontSize: 8.5, padding: '1px 6px' }}>
                          EXP {expD}D
                        </Chip>
                      )}
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: NAME, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      AED {formatPrice(contract.asking_price_aed)}
                    </p>
                    {comm && (
                      <p className="text-[9px] mt-0.5" style={{ color: GOLD, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {comm.pct}% · AED {comm.amount.toLocaleString('en-US')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* AI Valuation (only when no Form A to fold with) */}
          {hasValuation && (
            <div className="mt-1.5 px-2 py-1.5 rounded-md" style={{ background: WELL, border: `1px solid ${HAIR}` }}>
              <div className="flex items-center justify-between gap-1">
                <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: NAME, fontVariantNumeric: 'tabular-nums' }}>
                  <Sparkles className="w-3 h-3" strokeWidth={1.5} style={{ color: GOLD }} />
                  {(landlord.ai_estimated_value_aed / 1e6).toFixed(2)}M
                </span>
                {landlord.ai_estimated_price_sqft && (
                  <span className="text-[9px]" style={{ color: MONEY, fontVariantNumeric: 'tabular-nums' }}>
                    {landlord.ai_estimated_price_sqft.toLocaleString()} /sqft
                  </span>
                )}
                {landlord.ai_valuation_confidence && (
                  <Chip style={{ color: SAGE, borderColor: SAGE_BORDER, fontSize: 8.5, padding: '1px 6px' }}>
                    {landlord.ai_valuation_confidence}
                  </Chip>
                )}
              </div>
              {valuationDelta && (
                <p className="text-[9px] mt-1" style={{ color: GOLD, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {valuationDelta.sign}{valuationDelta.pct}% vs ask
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Strike-now claret chip — only the column's single siren carries the full alert. */}
      {showSiren && (
        <div className="mt-1.5">
          <Chip
            style={{ color: CLARET_TEXT, borderColor: CLARET_BORDER, background: CLARET_BG, fontSize: 9 }}
            title={showMandateWarning ? `Mandate expires in ${daysUntilMandateExpiry}d` : 'High urgency'}
          >
            STRIKE NOW{strikeDays != null ? ` · ${strikeDays}D` : ''}
          </Chip>
        </div>
      )}

      {/* Commission + deal value + tier + agent — single row. Commission in champagne gradient ink. */}
      <div className="flex items-center gap-2 mt-1.5 flex-wrap" style={{ borderTop: `1px solid ${HAIR}`, paddingTop: '0.4rem' }}>
        {commission > 0 && (
          <span className="text-[11px] font-bold" style={{
            backgroundImage: CHAMPAGNE, WebkitBackgroundClip: 'text', backgroundClip: 'text',
            color: 'transparent', WebkitTextFillColor: 'transparent', fontVariantNumeric: 'tabular-nums',
          }}>
            {commission >= 1000 ? `AED ${(commission / 1000).toFixed(0)}K` : `AED ${commission}`}
          </span>
        )}
        {askingPrice > 0 && (
          <span className="text-[9px]" style={{ color: MONEY, fontVariantNumeric: 'tabular-nums' }}>
            AED {(askingPrice / 1000000).toFixed(1)}M
          </span>
        )}
        <Chip style={landlord.trust_score >= 80 ? { color: GOLD, borderColor: 'rgba(216,178,106,0.4)' } : undefined}>
          T{landlord.trust_score || 0}
        </Chip>
        {landlord.assigned_agent_email && (
          <Chip title={landlord.assigned_agent_email}>
            {landlord.assigned_agent_email.split('@')[0]}
          </Chip>
        )}
        {landlord.listing_manager_email && (
          <Chip title={`Listing manager: ${landlord.listing_manager_email}`}>
            LM · {landlord.listing_manager_email.split('@')[0]}
          </Chip>
        )}
      </div>

      {/* Send to Closing — only shown when at deal_closed stage */}
      {landlord.stage === 'deal_closed' && (
        <div className="mt-1.5" onClick={e => e.stopPropagation()}>
          <SendToClosingButton landlordId={landlord.id} propertyRef={landlord.unit_reference} size="xs" />
        </div>
      )}

      {/* Bottom row: aging chip (+ quiet claret dot for non-siren urgent cards) + assign + actions */}
      <div className="flex items-center justify-between gap-1 mt-1.5 pt-1.5" style={{ borderTop: `1px solid ${HAIR}` }}>
        <div className="flex items-center gap-1.5">
          <Chip
            style={
              landlord.days_in_stage != null && landlord.days_in_stage >= 14
                ? { color: CLARET_TEXT, borderColor: CLARET_BORDER, background: CLARET_BG }
                : undefined
            }
            title="Days in stage"
          >
            {landlord.days_in_stage ? `${landlord.days_in_stage}D` : 'New'}
          </Chip>
          {/* Quiet claret dot — the downgraded urgency signal for non-siren urgent cards. */}
          {strikeNow && !showSiren && (
            <span
              title={`Urgent${strikeDays != null ? ` · ${strikeDays}D in stage` : ''} — the most-overdue card in this column carries the full alert`}
              style={{ width: 6, height: 6, borderRadius: 999, background: CLARET, flex: 'none', boxShadow: '0 0 6px rgba(180,70,63,0.4)' }}
            />
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {onStageChange && (
            <>
              <StageArrows landlord={landlord} onStageChange={onStageChange} />
              <span className="w-px h-4 mx-0.5" style={{ background: HAIR }} />
            </>
          )}
          {users.length > 0 && (
            <select
              title="Assign"
              value={landlord.assigned_agent_email || ''}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => { e.stopPropagation(); onSingleAssign?.(landlord.id, e.target.value); }}
              className="text-[9px] rounded-full px-1.5 py-1 max-w-[64px] cursor-pointer"
              style={{ background: 'transparent', border: `1px solid ${HAIR2}`, color: SLATE }}
            >
              <option value="">Assign</option>
              {users.map(u => (
                <option key={u.id} value={u.email}>{(u.display_name || u.full_name)?.split(' ')[0] || u.email.split('@')[0]}</option>
              ))}
            </select>
          )}
          <ActBtn onClick={handleCall} disabled={twilioCalling || !e164} title={e164 ? 'Call via Twilio' : 'No phone number'}>
            {twilioCalling
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} style={{ color: GOLD }} />
              : <Phone className="w-3.5 h-3.5" strokeWidth={1.5} />
            }
          </ActBtn>
          <ActBtn onClick={handleWhatsApp} title="WhatsApp">
            <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
          </ActBtn>
          <Link
            to={`/whatsapp?phone=${encodeURIComponent(e164 || landlord.phone || '')}`}
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, color: 'rgba(233,237,246,0.45)', transition: 'color 150ms ease' }}
            className="hover:!text-[#E9EDF6]"
            title="Open in CRM"
          >
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Link>
          <ActBtn onClick={handleExportVCard} title="vCard">
            <UserMinus className="w-3.5 h-3.5" strokeWidth={1.5} />
          </ActBtn>
          <ActBtn onClick={handleDelete} disabled={deleteMutation.isPending} title="Delete" danger>
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </ActBtn>
        </div>
      </div>

      {/* Journey hairline — stage position across the 13-stage arc, gold fill + n/13 label. */}
      <div className="flex items-center gap-1.5 mt-1.5">
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 1, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${journeyFill}%`, background: showSiren ? CLARET : GOLD, borderRadius: 1, transition: 'width 180ms ease' }} />
        </div>
        <span style={{ fontSize: 9, color: SLATE, fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{journeyN}/13</span>
      </div>
    </a>
  );
}

// Memoized so a drag (which re-renders the board on every pointer move) only repaints the
// card whose props actually changed — not all ~600 cards. Without this, dragging hangs.
export default memo(LandlordCard, (prev, next) => {
  const a = prev.landlord, b = next.landlord;
  return (
    a === b &&
    prev.isSelected === next.isSelected &&
    prev.isDragging === next.isDragging &&
    prev.isChecked === next.isChecked &&
    prev.isColumnSiren === next.isColumnSiren &&
    prev.users === next.users &&
    prev.photographyTasks === next.photographyTasks &&
    prev.getPhotoForPhone === next.getPhotoForPhone &&
    prev.onToggleCheck === next.onToggleCheck &&
    prev.onSingleAssign === next.onSingleAssign &&
    prev.onStageChange === next.onStageChange
  );
});