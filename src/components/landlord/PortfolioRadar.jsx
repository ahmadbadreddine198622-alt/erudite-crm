import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Radar, Building2, TrendingUp, Copy, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function PortfolioRadar({ landlord }) {
  const [results, setResults] = useState(null);

  const scanMutation = useMutation({
    mutationFn: () => base44.functions.scanPortfolio({ landlord_id: landlord.id }),
    onSuccess: (res) => {
      setResults(res?.data || res);
    },
    onError: (e) => toast.error(`Scan failed: ${e.message}`)
  });

  return (
    <Card className="border-2 border-indigo-100">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2 text-indigo-900">
            <Radar className="w-4 h-4" /> Portfolio Radar
          </h3>
          {results && (
            <Badge className="bg-indigo-100 text-indigo-900 border-0">
              Opportunity {results.opportunity_score}/100
            </Badge>
          )}
        </div>

        {!results ? (
          <div className="text-center py-3">
            <p className="text-xs text-muted-foreground mb-2">
              Scan DLD + our database to find every property this landlord owns.
            </p>
            <Button size="sm" onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending}>
              {scanMutation.isPending ? 'Scanning…' : 'Scan now'}
            </Button>
          </div>
        ) : results.portfolio?.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            No additional properties found beyond this one. Single-property landlord.
          </p>
        ) : (
          <>
            <div className="text-xs">
              <span className="text-muted-foreground">Found </span>
              <span className="font-bold text-indigo-700">{results.portfolio.length}</span>
              <span className="text-muted-foreground"> additional propert{results.portfolio.length === 1 ? 'y' : 'ies'} — total est. </span>
              <span className="font-bold">{fmt(results.total_estimated_value_aed)} AED</span>
            </div>

            <ul className="space-y-1.5">
              {results.portfolio.slice(0, 5).map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-xs p-2 bg-slate-50 rounded">
                  <Building2 className="w-3.5 h-3.5 mt-0.5 text-indigo-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{p.title || `${p.bedrooms}BR ${p.type}`}</p>
                    <p className="text-muted-foreground text-[11px]">
                      {p.community} · {p.bedrooms}BR · {p.size_sqft} sqft · ~{fmt(p.estimated_value_aed)} AED
                    </p>
                    <Badge variant="outline" className="text-[9px] mt-0.5 capitalize">{p.source.replace('_', ' ')}</Badge>
                  </div>
                </li>
              ))}
            </ul>

            {results.pitch && (
              <div className="bg-indigo-50 border border-indigo-200 rounded p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-indigo-700">Suggested pitch</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(results.pitch); toast.success('Copied'); }}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-xs text-indigo-900">{results.pitch}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function fmt(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat().format(n);
}
