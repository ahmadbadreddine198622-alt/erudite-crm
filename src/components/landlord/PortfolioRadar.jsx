import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Radar, Building2, RefreshCw, Link2, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

function fmt(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat().format(n);
}

const CONFIDENCE_CONFIG = {
  high:   { label: 'Phone match',  cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  medium: { label: 'Name match',   cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  low:    { label: 'Fuzzy match',  cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
};

export default function PortfolioRadar({ landlord }) {
  const qc = useQueryClient();

  const { data: scanData, isLoading: loadingScan } = useQuery({
    queryKey: ['portfolio-scan', landlord.id],
    queryFn: async () => {
      // Check if we have a cached scan on the landlord record itself
      const l = await base44.entities.Landlord.filter({ id: landlord.id });
      const rec = l?.[0];
      if (rec?.portfolio_scan_result && rec?.portfolio_scanned_at) {
        return { ...rec.portfolio_scan_result, scanned_at: rec.portfolio_scanned_at };
      }
      return null;
    },
    enabled: !!landlord?.id,
    staleTime: 5 * 60 * 1000,
  });

  const scanMutation = useMutation({
    mutationFn: () => base44.functions.invoke('scanPortfolio', { landlord_id: landlord.id }),
    onSuccess: (res) => {
      const d = res?.data ?? res;
      if (d?.error) throw new Error(d.error);
      qc.invalidateQueries({ queryKey: ['portfolio-scan', landlord.id] });
      qc.invalidateQueries({ queryKey: ['landlords'] });
      toast.success(`Scan complete — ${(d.portfolio || []).length} propert${(d.portfolio || []).length === 1 ? 'y' : 'ies'} found`);
    },
    onError: (e) => toast.error(`Scan failed: ${e.message}`),
  });

  const linkMutation = useMutation({
    mutationFn: async ({ property_id }) => {
      // Create a LandlordProperty link
      const existing = await base44.entities.LandlordProperty.filter({ landlord_id: landlord.id, property_id });
      if (existing?.length > 0) return { already_linked: true };
      return base44.entities.LandlordProperty.create({ landlord_id: landlord.id, property_id });
    },
    onSuccess: (d) => {
      if (d?.already_linked) { toast.info('Already linked'); return; }
      toast.success('Property linked to landlord');
      qc.invalidateQueries({ queryKey: ['landlord-properties', landlord.id] });
    },
    onError: (e) => toast.error('Link failed: ' + e.message),
  });

  const results = scanMutation.data?.data ?? scanMutation.data ?? scanData;
  const portfolio = results?.portfolio || [];
  const scannedAt = results?.scanned_at || results?.detected_at;

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.18)' }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#93c5fd' }}>
          <Radar className="w-4 h-4" /> Portfolio Radar
          {portfolio.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd' }}>{portfolio.length}</span>
          )}
        </h3>
        {scannedAt && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(scannedAt), { addSuffix: true })}
          </span>
        )}
      </div>

      {!results && !scanMutation.isPending && !loadingScan ? (
        <div className="text-center py-4 space-y-2">
          <p className="text-xs text-muted-foreground">Search our database for other properties this landlord may own — matched by phone number and name.</p>
          <Button size="sm" variant="outline" onClick={() => scanMutation.mutate()} className="gap-1.5 text-xs">
            <Radar className="w-3.5 h-3.5" /> Scan now
          </Button>
        </div>
      ) : scanMutation.isPending || loadingScan ? (
        <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Scanning database…
        </div>
      ) : portfolio.length === 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center py-2">
            No additional properties found in our database for this landlord.
          </p>
          <div className="flex justify-center">
            <Button size="sm" variant="ghost" onClick={() => scanMutation.mutate()} className="gap-1 text-xs">
              <RefreshCw className="w-3 h-3" /> Rescan
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Found <span className="font-semibold" style={{ color: '#93c5fd' }}>{portfolio.length}</span> additional propert{portfolio.length === 1 ? 'y' : 'ies'}
            {results.total_estimated_value_aed > 0 && (
              <> · est. <span className="font-semibold text-foreground">{fmt(results.total_estimated_value_aed)} AED</span></>
            )}
          </div>

          {portfolio.map((p, i) => {
            const conf = CONFIDENCE_CONFIG[p.match_confidence] || CONFIDENCE_CONFIG.low;
            return (
              <div key={i} className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <Building2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#93c5fd' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate text-foreground">{p.title || `${p.bedrooms ? p.bedrooms + 'BR ' : ''}${p.type || 'Property'}`}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {[p.community, p.bedrooms ? `${p.bedrooms}BR` : null, p.size_sqft ? `${p.size_sqft} sqft` : null].filter(Boolean).join(' · ')}
                    {p.estimated_value_aed > 0 && ` · ~${fmt(p.estimated_value_aed)} AED`}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="outline" className={`text-[9px] border ${conf.cls}`}>{conf.label}</Badge>
                    <Badge variant="outline" className="text-[9px] border-white/15 text-white/40">{(p.source || '').replace(/_/g, ' ')}</Badge>
                  </div>
                </div>
                {p.property_id && (
                  <button
                    onClick={() => linkMutation.mutate({ property_id: p.property_id })}
                    disabled={linkMutation.isPending}
                    title="Link to landlord"
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors shrink-0"
                  >
                    <Link2 className="w-3 h-3" /> Link
                  </button>
                )}
              </div>
            );
          })}

          {results.pitch && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <p className="text-[9px] uppercase tracking-widest font-semibold mb-1" style={{ color: '#93c5fd' }}>Suggested Pitch</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>{results.pitch}</p>
            </div>
          )}

          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending} className="gap-1 text-xs">
              <RefreshCw className="w-3 h-3" /> Rescan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}