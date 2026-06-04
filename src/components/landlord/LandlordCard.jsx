import { cn } from '@/lib/utils';
import { Phone, MessageCircle, Trash2, UserMinus, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { normalizePhone, waMeUrl } from '@/lib/phone';
import { ProjectBadge } from '@/lib/projectColors.jsx';

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
  photographer_scheduling: 'Photographer Scheduling',
  listing_creation: 'Listing Creation',
  internal_verification: 'Internal Verification',
  listing_publication: 'Listing Publication',
  final_confirmation: 'Final Confirmation',
};

export default function LandlordCard({ landlord, isSelected, isDragging, onClick, isChecked, onToggleCheck, users = [], onSingleAssign }) {
  const archetypeColor = ARCHETYPE_COLORS[landlord.landlord_archetype] || ARCHETYPE_COLORS.individual_end_user_relocating;
  const archetypeLabel = ARCHETYPE_LABELS[landlord.landlord_archetype] || 'Landlord';
  const stageLabel = STAGE_LABELS[landlord.stage] || landlord.stage;

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

  const handleCall = (e) => {
    e.stopPropagation();
    if (!e164) {
      toast.error('No valid phone number');
      return;
    }
    window.location.href = `tel:${e164}`;
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
        'rounded-2xl p-2.5 cursor-pointer transition-all duration-200',
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
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      {/* Top row: checkbox + avatar + name + urgency badge */}
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={!!isChecked}
          onChange={(e) => { e.stopPropagation(); onToggleCheck?.(landlord.id); }}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 w-4 h-4 accent-amber-500 shrink-0 cursor-pointer"
        />
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-accent shrink-0">
          {landlord.full_name_en?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-0.5">
            <p className="text-xs font-bold leading-tight truncate" style={{ color: 'rgba(255,255,255,0.95)' }} title={landlord.full_name_en || 'Unknown'}>{landlord.full_name_en || 'Unknown'}</p>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <span
              className={cn(
                'shrink-0 inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold border',
                archetypeColor,
              )}
            >
              {archetypeLabel}
            </span>
            <span className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold border bg-slate-500/10 text-slate-300 border-slate-500/30">
              {stageLabel}
            </span>
            {landlord.urgency_score >= 80 ? (
              <span className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold border bg-red-500/15 text-red-400 border-red-500/30">
                URGENT
              </span>
            ) : landlord.urgency_score >= 60 ? (
              <span className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold border bg-amber-500/15 text-amber-400 border-amber-500/30">
                ATTENTION
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Project badge + Unit count badge */}
      {(landlord.project_name || landlord.unit_reference) && (
        <div className="mt-1 flex items-center gap-1 flex-wrap">
          {landlord.project_name && <ProjectBadge name={landlord.project_name} />}
          {landlord.unit_reference && (
            <span className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold border bg-blue-500/15 text-blue-400 border-blue-500/30">
              📍 {landlord.unit_reference}
            </span>
          )}
        </div>
      )}

      {/* Form A contracts with price and expiry */}
      {contracts.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {contracts.map((contract, idx) => (
            <div key={contract.contract_number || idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.375rem 0.5rem', borderRadius: '0.375rem' }}>
              <p className="text-[10px] font-semibold mb-0.5" style={{ color: 'hsl(38 92% 55%)', letterSpacing: '0.02em' }}>
                {contract.contract_number || 'Unknown'}
              </p>
              <p className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,0.85)', lineHeight: '1.3' }}>
                AED {formatPrice(contract.asking_price_aed)} · <span style={{ color: getExpiryColor(contract.mandate_expires_at), fontWeight: 600 }}>exp {formatExpiryDate(contract.mandate_expires_at)}</span>
              </p>
              {(() => {
                const commission = getCommissionInfo(contract);
                if (!commission) return null;
                return (
                  <p className="text-[9px] font-medium mt-0.5" style={{ color: 'hsl(38 92% 55%)' }}>
                    Commission: {commission.pct}% · AED {commission.amount.toLocaleString('en-US')}
                  </p>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {/* Form A expiry warning */}
      {showMandateWarning && (
        <div className="mt-1">
          <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[8px] font-bold border bg-red-500/15 text-red-400 border-red-500/30">
            ⚠️ Form A expires in {daysUntilMandateExpiry}d
          </span>
        </div>
      )}

      {/* Commission (prominent) + Trust */}
      <div className="mt-1.5 flex items-center gap-2">
        {commission > 0 && (
          <div className="flex-1">
            <p className="text-[11px] font-bold" style={{ color: 'hsl(38 92% 50%)' }}>
              {commission >= 1000 ? `AED ${(commission / 1000).toFixed(0)}K` : `AED ${commission}`}
            </p>
            <p className="text-[8px]" style={{ color: 'rgba(255,255,255,0.45)' }}>Commission</p>
          </div>
        )}
        {askingPrice > 0 && (
          <div className="text-right">
            <p className="text-[9px] font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>
              AED {(askingPrice / 1000000).toFixed(1)}M
            </p>
            <p className="text-[8px]" style={{ color: 'rgba(255,255,255,0.45)' }}>Asking</p>
          </div>
        )}
        <span className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded border', getTrustColor(landlord.trust_score))}>
          Trust {landlord.trust_score || 0}
        </span>
      </div>

      {/* Assigned agent */}
      {landlord.assigned_agent_email && (
        <div className="mt-1">
          <span className="text-[8px] px-1 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.15)', color: 'hsl(38 92% 60%)' }}>
            👤 {landlord.assigned_agent_email.split('@')[0]}
          </span>
        </div>
      )}

      {/* Bottom row: time in stage + single-assign + actions */}
      <div className="mt-2 pt-2 flex items-center justify-between gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <span className="text-[8px] font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
          {landlord.days_in_stage ? `${landlord.days_in_stage}d in stage` : 'Just added'}
        </span>
        <div className="flex items-center gap-0.5">
          {users.length > 0 && (
            <select
              title="Assign agent"
              value={landlord.assigned_agent_email || ''}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => { e.stopPropagation(); onSingleAssign?.(landlord.id, e.target.value); }}
              className="text-[8px] rounded px-1 py-0.5 max-w-[70px]"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}
            >
              <option value="">Assign…</option>
              {users.map(u => (
                <option key={u.id} value={u.email}>{u.full_name?.split(' ')[0] || u.email.split('@')[0]}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={handleCall}
            className="flex items-center justify-center w-6 h-6 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
            title="Call"
          >
            <Phone className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex items-center justify-center w-6 h-6 rounded-lg text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/15 transition-colors"
            title="Open WhatsApp Web"
          >
            <MessageCircle className="w-3 h-3" />
          </button>
          <Link
            to={`/whatsapp?phone=${encodeURIComponent(e164 || landlord.phone || '')}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center w-6 h-6 rounded-lg text-muted-foreground hover:text-green-400 hover:bg-green-500/15 transition-colors"
            title="Open in CRM"
          >
            <ExternalLink className="w-3 h-3" />
          </Link>
          <button
            type="button"
            onClick={handleExportVCard}
            className="flex items-center justify-center w-6 h-6 rounded-lg text-muted-foreground hover:text-blue-400 hover:bg-blue-500/15 transition-colors"
            title="Export vCard"
          >
            <UserMinus className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="flex items-center justify-center w-6 h-6 rounded-lg text-red-400 hover:bg-red-500/15 transition-colors disabled:opacity-50"
            title="Delete landlord"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}