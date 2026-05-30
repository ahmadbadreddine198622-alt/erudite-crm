import { cn } from '@/lib/utils';
import { Phone, MessageCircle, Trash2 } from 'lucide-react';
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

export default function LandlordCard({ landlord, isSelected, isDragging, onClick }) {
  const archetypeColor = ARCHETYPE_COLORS[landlord.landlord_archetype] || ARCHETYPE_COLORS.individual_end_user_relocating;
  const archetypeLabel = ARCHETYPE_LABELS[landlord.landlord_archetype] || 'Landlord';

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

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl p-3.5 cursor-pointer transition-all duration-200',
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
      {/* Top row: avatar + name + urgency badge */}
      <div className="flex items-start gap-2.5">
        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-base font-bold text-accent shrink-0">
          {landlord.full_name_en?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-sm font-bold leading-tight truncate" style={{ color: 'rgba(255,255,255,0.95)' }}>{landlord.full_name_en || 'Unknown'}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-lg text-[9px] font-bold border',
                archetypeColor,
              )}
            >
              {archetypeLabel}
            </span>
            {landlord.urgency_score >= 80 ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-lg text-[9px] font-bold border bg-red-500/15 text-red-400 border-red-500/30">
                URGENT
              </span>
            ) : landlord.urgency_score >= 60 ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-lg text-[9px] font-bold border bg-amber-500/15 text-amber-400 border-amber-500/30">
                ATTENTION
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Project badge */}
      {landlord.project_name && (
        <div className="mt-1.5">
          <ProjectBadge name={landlord.project_name} />
        </div>
      )}

      {/* Commission (prominent) + Trust */}
      <div className="mt-2.5 flex items-center gap-2">
        {commission > 0 && (
          <div className="flex-1">
            <p className="text-xs font-bold" style={{ color: 'hsl(38 92% 50%)' }}>
              {commission >= 1000 ? `AED ${(commission / 1000).toFixed(0)}K` : `AED ${commission}`}
            </p>
            <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.45)' }}>Commission</p>
          </div>
        )}
        {askingPrice > 0 && (
          <div className="text-right">
            <p className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>
              AED {(askingPrice / 1000000).toFixed(1)}M
            </p>
            <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.45)' }}>Asking</p>
          </div>
        )}
        <span className={cn('text-[9px] font-bold px-2 py-1 rounded-lg border', getTrustColor(landlord.trust_score))}>
          Trust {landlord.trust_score || 0}
        </span>
      </div>

      {/* Bottom row: time in stage + actions */}
      <div className="mt-2.5 pt-2.5 flex items-center justify-between gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
          {landlord.days_in_stage ? `${landlord.days_in_stage}d in stage` : 'Just added'}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCall}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
            title="Call"
          >
            <Phone className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/15 transition-colors"
            title="WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-red-400 hover:bg-red-500/15 transition-colors disabled:opacity-50"
            title="Delete landlord"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}