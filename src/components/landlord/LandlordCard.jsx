import { cn } from '@/lib/utils';
import { Phone, MessageCircle, Trash2, UserMinus, ExternalLink, CheckCircle2, Camera, Film, Image, Box, FileCheck, Loader2 } from 'lucide-react';
import SendToClosingButton from '@/components/closing/SendToClosingButton';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { normalizePhone, waMeUrl } from '@/lib/phone';
import { ProjectBadge } from '@/lib/projectColors.jsx';
import { useState } from 'react';

const ARCHETYPE_COLORS = {
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

const ARCHETYPE_LABELS = {
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

function getTrustColor(score) {
  if (!score) return 'text-muted-foreground';
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function getUrgencyDot(score) {
  if (!score) return 'bg-slate-300';
  if (score >= 80) return 'bg-red-500 animate-pulse';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-emerald-500';
}

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

export default function LandlordCard({ landlord, isSelected, isDragging, onClick, isChecked, onToggleCheck, users = [], onSingleAssign, photographyTasks = [], getPhotoForPhone }) {
  const [twilioCalling, setTwilioCalling] = useState(false);
  const archetypeColor = ARCHETYPE_COLORS[landlord.landlord_archetype] || ARCHETYPE_COLORS.individual_end_user_relocating;
  const archetypeLabel = ARCHETYPE_LABELS[landlord.landlord_archetype] || 'Landlord';
  const stageLabel = STAGE_LABELS[landlord.stage] || landlord.stage;

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
  const photoUrl = getPhotoForPhone ? getPhotoForPhone(landlord.phone || landlord.whatsapp) : null;

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
      onClick={onClick}
      className={cn(
        'rounded-xl p-1.5 cursor-pointer transition-all duration-200',
        isDragging
          ? 'shadow-2xl rotate-1'
          : 'hover:shadow-lg',
        isSelected ? 'ring-2 ring-accent/50' : '',
      )}
      style={{
        background: isDragging ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.07)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: isDragging ? '2px solid rgba(245,159,10,0.6)' : '1px solid rgba(255,255,255,0.12)',
        borderTopColor: isDragging ? 'rgba(245,159,10,0.8)' : 'rgba(255,255,255,0.18)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      {/* Top row: checkbox + avatar + name */}
      <div className="flex items-center gap-1.5">
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

      {/* Badges row: archetype + stage + urgency + media status (only for photographer_scheduling stage) */}
      <div className="flex items-center gap-1 mt-1 flex-wrap">
        <span className={cn('shrink-0 inline-flex items-center px-1 py-0.5 rounded text-[7px] font-bold border', archetypeColor)}>
          {archetypeLabel}
        </span>
        <span className="inline-flex items-center px-1 py-0.5 rounded text-[7px] font-bold border bg-slate-500/10 text-slate-300 border-slate-500/30">
          {stageLabel}
        </span>
        {landlord.urgency_score >= 80 && (
          <span className="inline-flex items-center px-1 py-0.5 rounded text-[7px] font-bold border bg-red-500/15 text-red-400 border-red-500/30">
            URGENT
          </span>
        )}
        {landlord.urgency_score >= 60 && landlord.urgency_score < 80 && (
          <span className="inline-flex items-center px-1 py-0.5 rounded text-[7px] font-bold border bg-amber-500/15 text-amber-400 border-amber-500/30">
            ATTENTION
          </span>
        )}
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
          {landlord.project_name && <ProjectBadge name={landlord.project_name} />}
          {landlord.unit_reference && (
            <span className="inline-flex items-center px-1 py-0.5 rounded text-[7px] font-bold border bg-blue-500/15 text-blue-400 border-blue-500/30">
              📍 {landlord.unit_reference}
            </span>
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
          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[7px] font-bold border bg-red-500/15 text-red-400 border-red-500/30">
            ⚠️ {daysUntilMandateExpiry}d
          </span>
        </div>
      )}

      {/* Commission + Trust + Agent - single row */}
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        {commission > 0 && (
          <span className="text-[10px] font-bold" style={{ color: 'hsl(38 92% 50%)' }}>
            {commission >= 1000 ? `AED ${(commission / 1000).toFixed(0)}K` : `AED ${commission}`}
          </span>
        )}
        {askingPrice > 0 && (
          <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
            AED {(askingPrice / 1000000).toFixed(1)}M
          </span>
        )}
        <span className={cn('text-[7px] font-bold px-1 py-0.5 rounded border', getTrustColor(landlord.trust_score))}>
          T{landlord.trust_score || 0}
        </span>
        {landlord.assigned_agent_email && (
          <span className="text-[7px] px-1 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.15)', color: 'hsl(38 92% 60%)' }}>
            👤 {landlord.assigned_agent_email.split('@')[0]}
          </span>
        )}
        {landlord.listing_manager_email && (
          <span className="text-[7px] px-1 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 flex items-center gap-0.5">
            📋 {landlord.listing_manager_email.split('@')[0]}
          </span>
        )}
      </div>

      {/* Send to Closing — only shown when at deal_closed stage */}
      {landlord.stage === 'deal_closed' && (
        <div className="mt-1.5" onClick={e => e.stopPropagation()}>
          <SendToClosingButton landlordId={landlord.id} propertyRef={landlord.unit_reference} size="xs" />
        </div>
      )}

      {/* Bottom row: time + assign + actions */}
      <div className="flex items-center justify-between gap-1 mt-1.5 pt-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-[7px] font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {landlord.days_in_stage ? `${landlord.days_in_stage}d` : 'New'}
        </span>
        <div className="flex items-center gap-0.5">
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