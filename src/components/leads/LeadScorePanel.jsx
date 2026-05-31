import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle, CheckCircle, Zap } from 'lucide-react';

const CATEGORY_COLORS = {
  'Profile':         { bar: 'bg-blue-500',    text: 'text-blue-400',   max: 20 },
  'Qualification':   { bar: 'bg-purple-500',  text: 'text-purple-400', max: 20 },
  'Recency':         { bar: 'bg-amber-500',   text: 'text-amber-400',  max: 25 },
  'Activity Volume': { bar: 'bg-emerald-500', text: 'text-emerald-400',max: 15 },
  'Pipeline Stage':  { bar: 'bg-sky-500',     text: 'text-sky-400',    max: 20 },
};

function ScoreArc({ score }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const pct = score / 100;
  const dash = circ * pct;
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#f43f5e';

  return (
    <svg width="140" height="80" viewBox="0 0 140 80" className="overflow-visible">
      {/* Track */}
      <path
        d="M 10 70 A 60 60 0 0 1 130 70"
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d="M 10 70 A 60 60 0 0 1 130 70"
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${(circ / 2) * pct} ${circ}`}
        style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.34,1.56,0.64,1)', filter: `drop-shadow(0 0 6px ${color}80)` }}
      />
      <text x="70" y="68" textAnchor="middle" fill="rgba(255,255,255,0.95)" fontSize="26" fontWeight="700" fontFamily="Inter, sans-serif">
        {score}
      </text>
      <text x="70" y="82" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="Inter, sans-serif">
        OUT OF 100
      </text>
    </svg>
  );
}

export default function LeadScorePanel({ lead, onScoreUpdated }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const qc = useQueryClient();

  const score = result?.overall_score ?? lead.ai_lead_score ?? null;
  const trend = result?.trend ?? lead.ai_score_trend ?? 'stable';
  const factors = result?.factors ?? [];
  const risks = result?.risk_factors ?? [];
  const breakdown = result?.breakdown ?? {};

  const recalc = useMutation({
    mutationFn: () => base44.functions.invoke('scoreLeadFromProfile', { lead_id: lead.id }),
    onSuccess: (res) => {
      setError(null);
      setResult(res.data);
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['pipeline-leads'] });
      if (onScoreUpdated) onScoreUpdated(res.data.overall_score);
    },
    onError: (err) => setError(err?.response?.data?.error || err.message),
  });

  const TrendIcon = trend === 'rising' ? TrendingUp : trend === 'falling' ? TrendingDown : Minus;
  const trendColor = trend === 'rising' ? 'text-emerald-400' : trend === 'falling' ? 'text-red-400' : 'text-white/40';
  const scoreColor = score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : score !== null ? 'text-red-400' : 'text-white/30';
  const scoreLabel = score >= 80 ? 'Hot Lead' : score >= 65 ? 'High Priority' : score >= 45 ? 'Warm' : score >= 25 ? 'Cool' : score !== null ? 'Cold' : 'Not Scored';

  return (
    <div className="space-y-5">
      {/* Score Hero */}
      <div className="glass-card p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: score >= 70 ? 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(16,185,129,0.08) 0%, transparent 70%)' : score >= 40 ? 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(245,158,11,0.08) 0%, transparent 70%)' : 'none' }}
        />
        <div className="flex justify-center mb-2">
          <ScoreArc score={score ?? 0} />
        </div>
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className={`text-lg font-bold ${scoreColor}`}>{scoreLabel}</span>
          <TrendIcon className={`w-4 h-4 ${trendColor}`} />
        </div>
        {lead.ai_processed_at && (
          <p className="text-[10px] text-white/30">
            Last scored {new Date(lead.ai_processed_at).toLocaleDateString()}
          </p>
        )}
        <Button
          size="sm"
          onClick={() => recalc.mutate()}
          disabled={recalc.isPending}
          className="mt-4 bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${recalc.isPending ? 'animate-spin' : ''}`} />
          {recalc.isPending ? 'Scoring...' : score !== null ? 'Recalculate Score' : 'Calculate Score'}
        </Button>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>

      {/* Breakdown bars */}
      {factors.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-4">Score Breakdown</h3>
          <div className="space-y-4">
            {factors.map(({ category, items }) => {
              const cfg = CATEGORY_COLORS[category] || { bar: 'bg-white/40', text: 'text-white/60', max: 20 };
              const pts = items.reduce((s, i) => s + (i.points || 0), 0);
              return (
                <div key={category}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-semibold ${cfg.text}`}>{category}</span>
                    <span className="text-xs tabular-nums text-white/60">{pts} / {cfg.max}</span>
                  </div>
                  <Progress value={(pts / cfg.max) * 100} className="h-1.5 mb-2" />
                  <div className="space-y-0.5 pl-1">
                    {items.map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        {item.points > 0
                          ? <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                          : <Minus className="w-3 h-3 text-white/20 shrink-0" />
                        }
                        <span className="text-[11px] text-white/55">{item.label}</span>
                        {item.points > 0 && (
                          <span className="ml-auto text-[10px] tabular-nums text-white/30">+{item.points}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {breakdown.penalty > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-red-400">Penalties</span>
                  <span className="text-xs tabular-nums text-red-400">−{breakdown.penalty}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Risk Factors */}
      {risks.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Risk Factors
          </h3>
          <div className="space-y-2">
            {risks.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                {r}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No score yet */}
      {score === null && !recalc.isPending && (
        <div className="text-center py-4">
          <Zap className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <p className="text-sm text-white/40">Click "Calculate Score" to analyse this lead's profile, activity history, and qualification status.</p>
        </div>
      )}
    </div>
  );
}