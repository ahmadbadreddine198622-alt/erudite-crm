import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw, BedDouble, Maximize2, MapPin, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

function ProbabilityRing({ value }) {
  const color = value >= 70 ? '#10b981' : value >= 45 ? '#f59e0b' : '#94a3b8';
  const r = 18;
  const circ = 2 * Math.PI * r;
  const fill = (value / 100) * circ;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0">
      <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
      <circle
        cx="24" cy="24" r={r} fill="none"
        stroke={color} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`}
        transform="rotate(-90 24 24)"
        style={{ transition: 'stroke-dasharray 0.5s ease', filter: `drop-shadow(0 0 4px ${color}80)` }}
      />
      <text x="24" y="28" textAnchor="middle" fill={color} fontSize="11" fontWeight="700" fontFamily="Inter,sans-serif">
        {value}%
      </text>
    </svg>
  );
}

function MatchCard({ match, index }) {
  const [expanded, setExpanded] = useState(false);
  const { property: p, probability, matched_criteria, missed_criteria } = match;

  const formatPrice = (n) => n
    ? n >= 1_000_000 ? `AED ${(n / 1_000_000).toFixed(2)}M` : `AED ${n.toLocaleString()}`
    : 'Price on request';

  const label = probability >= 70 ? 'Strong match' : probability >= 45 ? 'Good match' : 'Possible match';
  const labelColor = probability >= 70 ? 'text-emerald-400' : probability >= 45 ? 'text-amber-400' : 'text-white/40';

  return (
    <div className="glass-card overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 p-3">
        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-white/5">
          {p.images?.[0]
            ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">No img</div>
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-bold text-white/30">#{index + 1}</span>
            <span className={`text-[10px] font-semibold ${labelColor}`}>{label}</span>
          </div>
          <p className="text-sm font-semibold text-white/90 truncate leading-tight">{p.title}</p>
          {p.location && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-white/30 shrink-0" />
              <span className="text-[11px] text-white/45 truncate">{p.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs font-bold text-amber-400">{formatPrice(p.price_aed)}</span>
            {p.bedrooms !== undefined && (
              <span className="flex items-center gap-0.5 text-[11px] text-white/45">
                <BedDouble className="w-3 h-3" />{p.bedrooms} bed
              </span>
            )}
            {p.area_sqft && (
              <span className="flex items-center gap-0.5 text-[11px] text-white/45">
                <Maximize2 className="w-3 h-3" />{p.area_sqft.toLocaleString()} sqft
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <ProbabilityRing value={probability} />
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[10px] text-white/30 hover:text-white/60 flex items-center gap-0.5"
          >
            Why? {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Expanded criteria */}
      {expanded && (
        <div className="border-t border-white/6 px-3 pb-3 pt-2 grid grid-cols-2 gap-x-3 gap-y-1">
          {matched_criteria.map((c, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-[11px] text-white/55">{c}</span>
            </div>
          ))}
          {missed_criteria.map((c, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <XCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
              <span className="text-[11px] text-white/40">{c}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LeadPropertyMatches({ lead }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = useMutation({
    mutationFn: () => base44.functions.invoke('matchLeadToProperties', { lead_id: lead.id }),
    onSuccess: (res) => { setError(null); setResult(res.data); },
    onError: (err) => setError(err?.response?.data?.error || err.message),
  });

  const matches = result?.matches ?? [];
  const top3 = matches.slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Header / CTA */}
      <div className="glass-card p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
          <Sparkles className="w-4.5 h-4.5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white/90">AI Property Matcher</p>
          <p className="text-[11px] text-white/40">
            {result
              ? `Analysed ${result.total_checked} listings · ${matches.length} viable matches found`
              : "Match budget, location & bedrooms against your portfolio"}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => run.mutate()}
          disabled={run.isPending}
          className="shrink-0 bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${run.isPending ? 'animate-spin' : ''}`} />
          {run.isPending ? 'Matching…' : result ? 'Re-run' : 'Find Matches'}
        </Button>
      </div>

      {error && (
        <p className="text-xs text-red-400 px-1">{error}</p>
      )}

      {/* Criteria summary */}
      {!result && !run.isPending && (
        <div className="glass-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-3">Lead Criteria</p>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4">
            {[
              { label: 'Budget', value: lead.budget_min || lead.budget_max ? `AED ${(lead.budget_min || 0).toLocaleString()} – ${lead.budget_max ? lead.budget_max.toLocaleString() : '∞'}` : 'Not specified' },
              { label: 'Intent', value: lead.intent === 'tenant' ? 'Rental' : lead.intent === 'buyer' ? 'Purchase' : 'Unknown' },
              { label: 'Locations', value: lead.preferred_locations?.join(', ') || 'Any' },
              { label: 'Bedrooms', value: lead.bedrooms_min !== undefined ? `${lead.bedrooms_min}${lead.bedrooms_max ? '–' + lead.bedrooms_max : '+'} bed` : 'Any' },
              { label: 'Property Type', value: lead.preferred_property_types?.join(', ') || 'Any' },
              { label: 'Size (sqft)', value: lead.size_sqft_min ? `${lead.size_sqft_min.toLocaleString()}+` : 'Any' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-white/30">{label}</p>
                <p className="text-xs text-white/70 font-medium">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 3 matches */}
      {top3.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 px-1">
            Top {top3.length} Matches
          </p>
          {top3.map((match, i) => (
            <MatchCard key={match.property.id} match={match} index={i} />
          ))}
          {matches.length > 3 && (
            <p className="text-[11px] text-white/30 text-center pt-1">
              +{matches.length - 3} more matches found — re-run to cycle through
            </p>
          )}
        </div>
      )}

      {result && top3.length === 0 && (
        <div className="text-center py-6">
          <p className="text-sm text-white/40">No strong matches in current portfolio.</p>
          <p className="text-xs text-white/25 mt-1">Try updating the lead's budget or location preferences.</p>
        </div>
      )}
    </div>
  );
}