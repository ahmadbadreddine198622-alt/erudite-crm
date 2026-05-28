import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Phone, MessageCircle, TrendingUp, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

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

export default function LandlordCard({ landlord, isSelected, onClick }) {
  const archetypeColor = ARCHETYPE_COLORS[landlord.landlord_archetype] || ARCHETYPE_COLORS.individual_end_user_relocating;
  const archetypeLabel = ARCHETYPE_LABELS[landlord.landlord_archetype] || 'Landlord';

  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Landlord.delete(landlord.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
      toast.success('Landlord deleted');
    },
    onError: (err) => toast.error('Delete failed: ' + (err?.message || 'unknown error')),
  });

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`Delete ${landlord.full_name_en || 'this landlord'}? This can't be undone.`)) {
      deleteMutation.mutate();
    }
  };

  const getTrustColor = (score) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getUrgencyDot = (score) => {
    if (!score) return 'bg-slate-300';
    if (score >= 80) return 'bg-red-500 animate-pulse';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md',
        isSelected
          ? 'bg-accent/10 border-accent shadow-md'
          : 'bg-card border-border hover:border-accent/50',
      )}
    >
      {/* Header: Name + Urgency Dot */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h4 className="font-semibold text-sm line-clamp-1">{landlord.full_name_en}</h4>
          <p className="text-xs text-muted-foreground">
            {landlord.phone || 'No phone'}
          </p>
        </div>
        <div className={cn('w-3 h-3 rounded-full flex-shrink-0 mt-1', getUrgencyDot(landlord.urgency_score))} />
      </div>

      {/* Archetype Badge */}
      <div className="mb-2">
        <Badge
          variant="outline"
          className={cn('text-xs border', archetypeColor)}
        >
          {archetypeLabel}
        </Badge>
      </div>

      {/* Price & Commission */}
      <div className="grid grid-cols-2 gap-1 text-xs mb-2">
        <div className="bg-slate-100 dark:bg-slate-800 rounded p-1.5">
          <p className="text-muted-foreground">Price</p>
          <p className="font-semibold">
            {landlord.asking_price_history?.[0]?.price
              ? `AED ${(landlord.asking_price_history[0].price / 1000000).toFixed(1)}M`
              : '—'}
          </p>
        </div>
        <div className="bg-slate-100 dark:bg-slate-800 rounded p-1.5">
          <p className="text-muted-foreground">Est. Commission</p>
          <p className="font-semibold">
            {landlord.estimated_commission_aed
              ? `AED ${(landlord.estimated_commission_aed / 1000).toFixed(0)}K`
              : '—'}
          </p>
        </div>
      </div>

      {/* Days in Stage */}
      <p className="text-xs text-muted-foreground mb-2">
        {landlord.days_in_stage ? `${landlord.days_in_stage}d in stage` : 'Just added'}
      </p>

      {/* Trust Score */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground">Trust</span>
        <span className={cn('text-xs font-bold', getTrustColor(landlord.trust_score))}>
          {landlord.trust_score || 0} / 100
        </span>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-1 pt-2 border-t border-border">
        <button
          type="button"
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs hover:bg-accent/20 rounded transition-colors"
          title="Call"
        >
          <Phone className="w-3 h-3" />
        </button>
        <button
          type="button"
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs hover:bg-accent/20 rounded transition-colors"
          title="WhatsApp"
        >
          <MessageCircle className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="flex items-center justify-center px-2 py-1.5 text-xs text-red-500 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
          title="Delete landlord"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}