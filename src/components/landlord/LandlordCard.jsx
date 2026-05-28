import { cn } from '@/lib/utils';
import { Phone, MessageCircle, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { normalizePhone, waMeUrl } from '@/lib/phone';

const ARCHETYPE_COLORS = {
  professional_investor: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  individual_end_user_relocating: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  distressed_seller: 'bg-red-500/10 text-red-600 border-red-500/20',
  inherited_owner: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  developer_resale: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  overseas_owner: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  first_time_seller: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
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
        'bg-card rounded-xl p-3 border cursor-pointer transition-all duration-200',
        isDragging
          ? 'shadow-xl ring-2 ring-accent/30 rotate-1'
          : 'hover:shadow-md hover:border-accent/30',
        isSelected ? 'border-accent ring-1 ring-accent/40' : 'border-border',
      )}
    >
      {/* Top row: avatar + name/phone + urgency dot */}
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent shrink-0">
          {landlord.full_name_en?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold leading-tight truncate">{landlord.full_name_en || 'Unknown'}</p>
            <span
              className={cn(
                'shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border',
                archetypeColor,
              )}
            >
              {archetypeLabel}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{landlord.phone || 'No phone'}</p>
        </div>
        <span
          className={cn('w-2 h-2 rounded-full shrink-0 mt-1', getUrgencyDot(landlord.urgency_score))}
          title="Urgency"
        />
      </div>

      {/* Metrics: price + commission + trust as compact badges */}
      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        {askingPrice > 0 && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-500/10 text-foreground border border-slate-500/20">
            AED {(askingPrice / 1000000).toFixed(1)}M
          </span>
        )}
        {commission > 0 && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20">
            {(commission / 1000).toFixed(0)}K comm.
          </span>
        )}
        <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded bg-muted border border-border', getTrustColor(landlord.trust_score))}>
          Trust {landlord.trust_score || 0}
        </span>
      </div>

      {/* Bottom row: time in stage + actions */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">
          {landlord.days_in_stage ? `In stage · ${landlord.days_in_stage}d` : 'Just added'}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleCall}
            className="flex items-center justify-center p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors"
            title="Call"
          >
            <Phone className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex items-center justify-center p-1.5 rounded text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors"
            title="WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="flex items-center justify-center p-1.5 rounded text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            title="Delete landlord"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
