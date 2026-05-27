import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, TrendingUp, AlertTriangle, CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = {
  green:  { bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-900', label: 'Priced right' },
  yellow: { bg: 'bg-amber-50 border-amber-200',     dot: 'bg-amber-500',   text: 'text-amber-900',   label: 'Slightly high' },
  orange: { bg: 'bg-orange-50 border-orange-200',   dot: 'bg-orange-500',  text: 'text-orange-900',  label: 'Too high'      },
  red:    { bg: 'bg-red-50 border-red-200',         dot: 'bg-red-500',     text: 'text-red-900',     label: 'Way too high'  }
};

export default function PricingPressureMeter({ landlord }) {
  const queryClient = useQueryClient();

  const { data: negotiation, isLoading } = useQuery({
    queryKey: ['mandateNegotiation', landlord.id],
    queryFn: async () => {
      const list = await base44.entities.MandateNegotiation.filter({ landlord_id: landlord.id });
      return list?.[0] || null;
    }
  });

  const computeMutation = useMutation({
    mutationFn: () => base44.functions.computePricingPressure({ landlord_id: landlord.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mandateNegotiation', landlord.id] });
      toast.success('Pricing analysis refreshed');
    },
    onError: (e) => toast.error(`Failed: ${e.message}`)
  });

  const color = negotiation?.pricing_pressure
    ? COLORS[negotiation.pricing_pressure]
    : COLORS.green;

  const gapPct = negotiation?.pricing_gap_pct;

  return (
    <Card className={`border-2 ${color.bg}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${color.dot} animate-pulse`} />
            <h3 className={`font-semibold text-sm ${color.text}`}>Pricing Pressure</h3>
            {negotiation && <Badge className={color.bg + ' ' + color.text + ' border-0'}>{color.label}</Badge>}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => computeMutation.mutate()}
            disabled={computeMutation.isPending}
          >
            <RefreshCw className={`w-3 h-3 ${computeMutation.isPending ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {!negotiation ? (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground mb-2">No pricing analysis yet</p>
            <Button size="sm" onClick={() => computeMutation.mutate()} disabled={computeMutation.isPending}>
              Compute now
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Asking</p>
                <p className="font-bold">{fmt(negotiation.asking_price_current)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">CMA</p>
                <p className="font-bold">{fmt(negotiation.cma_value_aed)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Gap</p>
                <p className={`font-bold ${gapPct > 10 ? 'text-red-600' : gapPct < 0 ? 'text-emerald-600' : ''}`}>
                  {gapPct > 0 ? '+' : ''}{gapPct?.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Visual gauge */}
            <div className="relative h-2 bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500 rounded-full overflow-hidden">
              <div
                className="absolute top-0 bottom-0 w-1 bg-slate-800 rounded-full"
                style={{ left: `${Math.min(95, Math.max(5, 50 + gapPct))}%` }}
                title={`${gapPct?.toFixed(1)}% above CMA`}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>-20%</span>
              <span>CMA</span>
              <span>+20%</span>
            </div>

            {negotiation.cma_evidence?.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  📊 {negotiation.cma_evidence.length} comparable sales
                </summary>
                <ul className="mt-1.5 space-y-0.5 pl-3">
                  {negotiation.cma_evidence.slice(0, 5).map((c, i) => (
                    <li key={i} className="text-[11px]">
                      • {c.comp_address || `Comp ${i+1}`}: {fmt(c.sold_price_aed)} AED
                      {c.sold_date && <span className="text-muted-foreground"> ({c.sold_date})</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function fmt(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat().format(n);
}
