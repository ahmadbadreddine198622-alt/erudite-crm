import { cn } from '@/lib/utils';
import { Phone, MessageCircle, Trash2, UserMinus, ExternalLink, CheckCircle2, Camera, Film, Image, Box, FileCheck, Loader2, GripVertical } from 'lucide-react';
import SendToClosingButton from '@/components/closing/SendToClosingButton';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { normalizePhone, waMeUrl } from '@/lib/phone';
import { ProjectBadge } from '@/lib/projectColors.jsx';
import { nextStepFor, getCaptureStatus } from '@/lib/landlordStageGuide';
import StageArrows from './StageArrows';
import { useState, memo } from 'react';
import {
  Pill, pillStyle, accentHsl, LANGUAGE_FLAG, ARCHETYPE_PILL, LEAD_TYPE_PILL,
  RAPPORT_ACCENT, momentumAccent, PRIORITY_ACCENT, humanize, scoreAccent,
} from './cardPills.jsx';

// Back-compat exports — kept so external importers (e.g. LandlordCommandCenter) keep working.
// Labels mirror the single pill system in cardPills.jsx.
export const ARCHETYPE_LABELS = Object.fromEntries(
  Object.entries(ARCHETYPE_PILL).map(([k, v]) => [k, v.label])
);
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

const STAGE_LABELS = {
  initial_contact: 'Initial Contact',
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

function LandlordCard({ landlord, isSelected, isDragging, onClick, isChecked, onToggleCheck, users = [], onSingleAssign, photographyTasks = [], getPhotoForPhone, dragHandleProps, onStageChange }) {
  const [twilioCalling, setTwilioCalling] = useState(false);
  const navigate = useNavigate();
  const archetypeMeta = ARCHETYPE_PILL[landlord.landlord_archetype] || null;
  const stageLabel = STAGE_LABELS[landlord.stage] || humanize(landlord.stage);
  // Per-field pill derivations (type-guarded; null → render nothing).
  const langFlag = LANGUAGE_FLAG[landlord.preferred_language] || null;
  const leadTypeLabel = LEAD_TYPE_PILL[landlord.lead_type] || null;
  const rapportAccent = landlord.rapport_level ? (RAPPORT_ACCENT[landlord.rapport_level] || 'grey') : null;
  const hasMomentum = typeof landlord.ai_momentum === 'string' && landlord.ai_momentum.trim().length > 0;
  // Attention/urgent pill — derived from real booleans, not a stored field.
  const attentionPill = landlord.ai_strike_now === true
    ? { label: 'URGENT', accent: 'red' }
    : (landlord.needs_human_review === true ? { label: 'ATTENTION', accent: 'amber' } : null);
  // Score pills — value-based color; mandate_win_probability is 0–1 (×100 first).
  const winPct = landlord.mandate_win_probability != null && !isNaN(landlord.mandate_win_probability)
    ? Math.round(landlord.mandate_win_probability * 100) : null;
  const nba = landlord.ai_next_best_action && typeof landlord.ai_next_best_action === 'object' ? landlord.ai_next_best_action : null;
  const redFlags = Array.isArray(landlord.red_flags) ? landlord.red_flags.filter(Boolean) : [];
  const buyingSignals = Array.isArray(landlord.buying_signals) ? landlord.buying_signals.filter(Boolean) : [];
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
  const photoUrl = getPhotoForPhone ? getPhotoForPhone(phoneForLookup) : null;

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

  // Helper to calculate expiry color and days remaining
  const getExpiryColor = (expiryDate) => {
    if (!expiryDate) return 'rgba(255,255,255,0.45)';
    const expiry = new Date(expiryDate).getTime();
    const now = new Date().getTime();
    const daysRemaining = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    if (daysRemaining < 0) return 'rgb(239, 68, 68)'; // red - expired
    if (daysRemaining <= 30) return 'rgb(217, 119, 6)'; // amber - expiring soon
    return 'hsl(38 92% 50%)'; // gold - normal
  };

  // Format date as "DD Mon YYYY"
  const formatExpiryDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleDateString('en-GB', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Format price with commas
  const formatPrice = (price) => {
    if (!price) return 'N/A';
    return price.toLocaleString('en-US');
  };

  // Calculate and format commission
  const getCommissionInfo = (contract) => {
    const commissionPct = contract.commission_pct_negotiated || landlord.commission_pct_negotiated;
    const askingPrice = contract.asking_price_aed || landlord.asking_price_aed;
    if (!commissionPct || !askingPrice) return null;
    const commissionAmount = askingPrice * (commissionPct / 100);
    return { pct: commissionPct, amount: commissionAmount };
  };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/landlord/${landlord.id}`);
      }}
      className={cn(
        'rounded-xl p-1.5 cursor-pointer transition-all duration-200 bg-secondary border shadow-sm',
        isDragging
          ? 'scale-[1.03] shadow-[0_8px_24px_rgba(0,0,0,0.45)] border-accent/60'
          : 'hover:shadow-md border-border',
        isSelected ? 'ring-2 ring-accent/50' : '',
      )}
    >
      {/* Top row: grip handle + checkbox + avatar + name */}
      <div className="flex items-center gap-1.5">
        {dragHandleProps && (
          <button
            type="button"
            {...dragHandleProps}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 -ml-0.5 flex items-center justify-center w-4 h-5 rounded text-muted-foreground/50 hover:text-accent hover:bg-accent/10 cursor-grab active:cursor-grabbing touch-none transition-colors"
            title="Drag to move stage"
            aria-label="Drag to move stage"
          >
            <GripVertical className="w-3 h-3" />
          </button>
        )}
        <input
          type="checkbox"
          checked={!!isChecked}
          onChange={(e) => { e.stopPropagation(); onToggleCheck?.(landlord.id); }}
          onClick={(e) => e.stopPropagation()}
          className="w-3.5 h-3.5 accent-amber-500 shrink-0 cursor-pointer"
        />
        {photoUrl ? (
          <img src={photoUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0 border border-white/20" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
        ) : null}
        <div className={cn('w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent shrink-0', photoUrl ? 'hidden' : 'flex')}>
          {landlord.full_name_en?.[0]?.toUpperCase() || '?'}
        </div>
        <p className="text-[11px] font-semibold truncate flex-1" style={{ color: 'rgba(255,255,255,0.95)' }} title={landlord.full_name_en || 'Unknown'}>{landlord.full_name_en || 'Unknown'}</p>
      </div>

      {/* Strike banner — the SINGLE loud red element, only when ai_strike_now is true */}
      {landlord.ai_strike_now === true && (
        <div
          className="mt-1 w-full rounded-lg px-2 py-1 text-[8px] font-bold uppercase tracking-wide flex items-center gap-1"
          style={{ background: 'hsl(0 72% 51% / 0.18)', border: '1px solid hsl(0 72% 51% / 0.30)', color: 'hsl(0 72% 51%)' }}
        >
          ⚡ Strike now
        </div>
      )}

      {/* Badges row: language + archetype + stage + lead type + momentum + attention + media status */}
      <div className="flex items-center gap-1 mt-1 flex-wrap">
        {langFlag && <span className="text-[11px] leading-none shrink-0" title={landlord.preferred_language}>{langFlag}</span>}
        {archetypeMeta && <Pill accent={archetypeMeta.accent} label>{archetypeMeta.label}</Pill>}
        <Pill
          accent="blue"
          label
          title={capture.complete ? 'Stage data captured' : `Missing: ${capture.missing.join(', ')}`}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', capture.complete ? 'bg-emerald-400' : 'bg-amber-400')} />
          {stageLabel}
        </Pill>
        {leadTypeLabel && <Pill accent="teal">{leadTypeLabel}</Pill>}
        {rapportAccent && <Pill accent={rapportAccent}>{humanize(landlord.rapport_level)}</Pill>}
        {hasMomentum && <Pill accent={momentumAccent(landlord.ai_momentum)}>{landlord.ai_momentum}</Pill>}
        {attentionPill && <Pill accent={attentionPill.accent}>{attentionPill.label}</Pill>}
        {showMediaBadge && (
          <span className={cn('inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[7px] font-bold border', mediaStatus.complete ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30')}>
            {mediaStatus.complete ? <CheckCircle2 className="w-2 h-2" /> : <Camera className="w-2 h-2" />}
            {mediaStatus.label}
          </span>
        )}
        {docBadge && (
          <span className={cn('inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[7px] font-bold border', docBadge.green ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30')}>
            <FileCheck className="w-2 h-2" />
            {docBadge.label}
          </span>
        )}
      </div>

      {/* Next step — the one action that moves this landlord forward (from stage guide) */}
      {nextStep && (
        <div className="flex items-start gap-1 mt-1">
          <span className="text-[7px] font-bold uppercase tracking-wide shrink-0 mt-px" style={{ color: 'hsl(38 92% 55%)' }}>Next:</span>
          <span className="text-[8px] leading-tight line-clamp-2" style={{ color: 'rgba(255,255,255,0.7)' }}>{nextStep}</span>
        </div>
      )}

      {/* AI next best action — "NEXT:" label accented by priority, then the action text */}
      {nba && nba.action && (
        <div className="flex items-start gap-1 mt-1">
          <span
            className="text-[7px] font-bold uppercase tracking-wide shrink-0 mt-px"
            style={{ color: accentHsl(PRIORITY_ACCENT[String(nba.priority)] || 'grey') }}
          >
            Next:
          </span>
          <span className="text-[8px] leading-tight line-clamp-2" style={{ color: 'rgba(255,255,255,0.7)' }}>{nba.action}</span>
        </div>
      )}

      {/* Individual media badges - shown in ALL stages when links exist */}
      {landlordTask && (
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {landlordTask.tour_3d_link && (
            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[7px] font-bold border bg-blue-500/15 text-blue-400 border-blue-500/30">
              <Box className="w-2 h-2" />
              360
            </span>
          )}
          {landlordTask.video_link && (
            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[7px] font-bold border bg-purple-500/15 text-purple-400 border-purple-500/30">
              <Film className="w-2 h-2" />
              Video
            </span>
          )}
          {landlordTask.photos_link && (
            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[7px] font-bold border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
              <Image className="w-2 h-2" />
              Photos
            </span>
          )}
        </div>
      )}

      {/* Project/ref tags */}
      {(landlord.project_name || landlord.unit_reference) && (
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {landlord.project_name && <Pill accent="teal">{landlord.project_name}</Pill>}
          {landlord.unit_reference && (
            <Pill accent="blue">📍 {landlord.unit_reference}</Pill>
          )}
        </div>
      )}

      {/* Form A contracts - compressed */}
      {contracts.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {contracts.map((contract, idx) => (
            <div key={contract.contract_number || idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.375rem', borderRadius: '0.25rem' }}>
              <p className="text-[9px] font-semibold" style={{ color: 'hsl(38 92% 55%)' }}>
                {contract.contract_number || 'Unknown'}
              </p>
              <p className="text-[8px] font-medium leading-tight" style={{ color: 'rgba(255,255,255,0.85)' }}>
                AED {formatPrice(contract.asking_price_aed)} · <span style={{ color: getExpiryColor(contract.mandate_expires_at), fontWeight: 600 }}>exp {formatExpiryDate(contract.mandate_expires_at)}</span>
              </p>
              {(() => {
                const commission = getCommissionInfo(contract);
                if (!commission) return null;
                return (
                  <p className="text-[8px] font-medium leading-tight" style={{ color: 'hsl(38 92% 55%)' }}>
                    {commission.pct}% · AED {commission.amount.toLocaleString('en-US')}
                  </p>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {/* Form A expiry warning */}
      {showMandateWarning && (
        <div className="mt-0.5">
          <Pill accent="red">⚠️ {daysUntilMandateExpiry}d</Pill>
        </div>
      )}

      {/* AI Valuation */}
      {landlord.ai_estimated_value_aed && (
        <div className="mt-1 px-1.5 py-1 rounded" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] font-bold" style={{ color: '#34d399' }}>
              🤖 {(landlord.ai_estimated_value_aed / 1e6).toFixed(2)}M
            </span>
            {landlord.ai_estimated_price_sqft && (
              <span className="text-[8px]" style={{ color: 'rgba(52,211,153,0.8)' }}>
                {landlord.ai_estimated_price_sqft.toLocaleString()} /sqft
              </span>
            )}
            {landlord.ai_valuation_confidence && (
              <span className={`text-[7px] font-bold px-1 py-0.5 rounded border ${
                landlord.ai_valuation_confidence === 'high' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                landlord.ai_valuation_confidence === 'medium' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                'bg-slate-500/15 text-slate-400 border-slate-500/30'
              }`}>
                {landlord.ai_valuation_confidence}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Score pills — value-based color (TRUST / URGENCY / WIN / RESP) */}
      {(landlord.trust_score != null || landlord.urgency_score != null || winPct != null || landlord.responsiveness_score != null) && (
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {landlord.trust_score != null && <Pill accent={scoreAccent(landlord.trust_score)}>TRUST {Math.round(landlord.trust_score)}</Pill>}
          {landlord.urgency_score != null && <Pill accent={scoreAccent(landlord.urgency_score)}>URGENCY {Math.round(landlord.urgency_score)}</Pill>}
          {winPct != null && <Pill accent={scoreAccent(winPct)}>WIN {winPct}%</Pill>}
          {landlord.responsiveness_score != null && <Pill accent={scoreAccent(landlord.responsiveness_score)}>RESP {Math.round(landlord.responsiveness_score)}</Pill>}
        </div>
      )}

      {/* Money + Agents - single GOLD/GREY row */}
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        {commission > 0 && (
          <span className="text-[10px] font-bold" style={{ color: 'hsl(38 92% 50%)' }}>
            {commission >= 1000 ? `AED ${(commission / 1000).toFixed(0)}K` : `AED ${commission}`}
          </span>
        )}
        {askingPrice > 0 && (
          <span className="text-[8px] font-medium" style={{ color: 'hsl(38 92% 50%)' }}>
            AED {(askingPrice / 1000000).toFixed(1)}M
          </span>
        )}
        {landlord.assigned_agent_email && (
          <Pill accent="grey">👤 {landlord.assigned_agent_email.split('@')[0]}</Pill>
        )}
        {landlord.co_agent_email && (
          <Pill accent="grey">👤 {landlord.co_agent_email.split('@')[0]}</Pill>
        )}
        {landlord.listing_manager_email && (
          <Pill accent="grey">📋 {landlord.listing_manager_email.split('@')[0]}</Pill>
        )}
      </div>

      {/* Red flags (RED) + buying signals (GREEN) — full-sentence chips, soft tint, wrap gracefully */}
      {(redFlags.length > 0 || buyingSignals.length > 0) && (
        <div className="flex items-start gap-1 mt-1 flex-wrap">
          {redFlags.map((flag, i) => (
            <span
              key={'rf-' + i}
              className="rounded-full px-3 py-1 text-xs font-medium max-w-full truncate"
              style={pillStyle('red')}
              title={String(flag)}
            >
              ⚑ {String(flag)}
            </span>
          ))}
          {buyingSignals.map((sig, i) => (
            <span
              key={'bs-' + i}
              className="rounded-full px-3 py-1 text-xs font-medium max-w-full truncate"
              style={pillStyle('green')}
              title={String(sig)}
            >
              ✓ {String(sig)}
            </span>
          ))}
        </div>
      )}

      {/* Send to Closing — only shown when at deal_closed stage */}
      {landlord.stage === 'deal_closed' && (
        <div className="mt-1.5" onClick={e => e.stopPropagation()}>
          <SendToClosingButton landlordId={landlord.id} propertyRef={landlord.unit_reference} size="xs" />
        </div>
      )}

      {/* Bottom row: time + assign + actions */}
      <div className="flex items-center justify-between gap-1 mt-1.5 pt-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {landlord.days_in_stage != null ? (
          <span className="rounded-full px-3 py-1 text-xs font-medium" style={pillStyle('grey')}>{landlord.days_in_stage}d</span>
        ) : (
          <span className="rounded-full px-3 py-1 text-xs font-medium" style={pillStyle('grey')}>New</span>
        )}
        <div className="flex items-center gap-0.5">
          {onStageChange && (
            <>
              <StageArrows landlord={landlord} onStageChange={onStageChange} />
              <span className="w-px h-4 mx-0.5" style={{ background: 'rgba(255,255,255,0.1)' }} />
            </>
          )}
          {users.length > 0 && (
            <select
              title="Assign"
              value={landlord.assigned_agent_email || ''}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => { e.stopPropagation(); onSingleAssign?.(landlord.id, e.target.value); }}
              className="text-[7px] rounded px-0.5 py-0.5 max-w-[60px]"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)' }}
            >
              <option value="">Assign</option>
              {users.map(u => (
                <option key={u.id} value={u.email}>{u.full_name?.split(' ')[0] || u.email.split('@')[0]}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={handleCall}
            disabled={twilioCalling || !e164}
            className="flex items-center justify-center w-5 h-5 rounded hover:bg-blue-500/15 transition-colors disabled:opacity-40"
            title={e164 ? 'Call via Twilio' : 'No phone number'}
            style={{ color: twilioCalling ? '#60a5fa' : '#3b82f6' }}
          >
            {twilioCalling
              ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
              : <Phone className="w-2.5 h-2.5" />
            }
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/15 transition-colors"
            title="WhatsApp"
          >
            <MessageCircle className="w-2.5 h-2.5" />
          </button>
          <Link
            to={`/whatsapp?phone=${encodeURIComponent(e164 || landlord.phone || '')}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-green-400 hover:bg-green-500/15 transition-colors"
            title="Open in CRM"
          >
            <ExternalLink className="w-2.5 h-2.5" />
          </Link>
          <button
            type="button"
            onClick={handleExportVCard}
            className="flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-blue-400 hover:bg-blue-500/15 transition-colors"
            title="vCard"
          >
            <UserMinus className="w-2.5 h-2.5" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="flex items-center justify-center w-5 h-5 rounded text-red-400 hover:bg-red-500/15 transition-colors disabled:opacity-50"
            title="Delete"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
    </div>
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
    prev.users === next.users &&
    prev.photographyTasks === next.photographyTasks &&
    prev.getPhotoForPhone === next.getPhotoForPhone &&
    prev.onToggleCheck === next.onToggleCheck &&
    prev.onSingleAssign === next.onSingleAssign &&
    prev.onStageChange === next.onStageChange
  );
});