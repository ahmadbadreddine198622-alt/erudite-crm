import React from 'react';
import { Sparkles, Zap, Target, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function TemperatureChip({ level }) {
  const config = {
    hot: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', color: '#f87171', label: '🔥 Hot' },
    warm: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', color: 'hsl(38 92% 60%)', label: '☀️ Warm' },
    cold: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.3)', color: '#93c5fd', label: '❄️ Cold' },
  };
  const c = config[level] || config.cold;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
      {c.label}
    </span>
  );
}

function ActionChip({ action, onClick }) {
  if (!action) return null;
  return (
    <button
      onClick={onClick}
      className="text-left px-3 py-2 rounded-lg border transition-all hover:scale-102 active:scale-98"
      style={{
        background: 'rgba(139,92,246,0.08)',
        border: '1px solid rgba(139,92,246,0.25)',
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Zap className="w-3 h-3" style={{ color: '#a78bfa' }} />
        <span className="text-xs font-semibold" style={{ color: '#c4b5fd' }}>{action.action}</span>
      </div>
      {action.suggested_time && (
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>⏰ {action.suggested_time}</p>
      )}
      {action.draft_message && (
        <p className="text-[11px] mt-1.5 px-2 py-1.5 rounded bg-black/20 italic" style={{ color: 'rgba(255,255,255,0.7)' }}>
          "{action.draft_message.slice(0, 120)}{action.draft_message.length > 120 ? '…' : ''}"
        </p>
      )}
    </button>
  );
}

export default function AICoachingCard({ landlord, onAnalyse }) {
  const {
    ai_rolling_summary,
    ai_coaching_for_agent,
    ai_next_best_action,
    ai_strike_now,
    urgency_score,
    mandate_win_probability,
    trust_score,
    responsiveness_score,
    rapport_level,
  } = landlord || {};

  // Derive temperature from rapport + urgency
  const temperature = (() => {
    if (ai_strike_now || (urgency_score && urgency_score >= 75)) return 'hot';
    if ((rapport_level && ['rapport_built', 'trust_established', 'champion'].includes(rapport_level)) || (urgency_score && urgency_score >= 50)) return 'warm';
    return 'cold';
  })();

  const dealSignals = [
    { label: 'Trust', value: trust_score != null ? `${trust_score}` : '—', color: trust_score >= 70 ? '#10b981' : trust_score >= 40 ? '#f59e0b' : '#ef4444' },
    { label: 'Response', value: responsiveness_score != null ? `${responsiveness_score}` : '—', color: responsiveness_score >= 70 ? '#10b981' : responsiveness_score >= 40 ? '#f59e0b' : '#ef4444' },
    { label: 'Mandate Win', value: mandate_win_probability != null ? `${Math.round(mandate_win_probability * 100)}%` : '—', color: mandate_win_probability >= 0.7 ? '#10b981' : mandate_win_probability >= 0.4 ? '#f59e0b' : '#ef4444' },
    { label: 'Urgency', value: urgency_score != null ? `${urgency_score}` : '—', color: urgency_score >= 70 ? '#ef4444' : urgency_score >= 40 ? '#f59e0b' : '#64748b' },
  ];

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{
      background: 'linear-gradient(145deg, rgba(139,92,246,0.08) 0%, rgba(139,92,246,0.04) 100%)',
      border: '1px solid rgba(139,92,246,0.25)',
    }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.2)' }}>
            <Sparkles className="w-4 h-4" style={{ color: '#a78bfa' }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>AI Coaching</p>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Real-time guidance & signals</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TemperatureChip level={temperature} />
          <button
            onClick={onAnalyse}
            disabled={false}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
            style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}
          >
            <Sparkles className="w-3 h-3" /> Analyse Now
          </button>
        </div>
      </div>

      {/* Deal Signals Row */}
      <div className="grid grid-cols-4 gap-2">
        {dealSignals.map(({ label, value, color }) => (
          <div key={label} className="rounded-lg px-2.5 py-2 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
            <p className="text-lg font-bold tabular-nums" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Summary */}
      {ai_rolling_summary && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>{ai_rolling_summary}</p>
        </div>
      )}

      {/* Coaching Strip */}
      {ai_coaching_for_agent && (
        <div className="rounded-xl p-3 border-l-4" style={{
          background: 'rgba(139,92,246,0.06)',
          borderLeftColor: '#a78bfa',
        }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
            <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#a78bfa' }}>Coaching</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>{ai_coaching_for_agent}</p>
        </div>
      )}

      {/* AI Suggested Actions */}
      {ai_next_best_action?.action && (
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Suggested Action</p>
          <ActionChip action={{
            action: ai_next_best_action.action,
            suggested_time: ai_next_best_action.priority === 'urgent' ? 'Now' : ai_next_best_action.priority === 'high' ? 'Today' : 'This week',
            draft_message: ai_next_best_action.reasoning,
          }} onClick={() => {}} />
        </div>
      )}
    </div>
  );
}