import React from 'react';
import { TrendingUp, Target, AlertCircle, CheckCircle2, Lightbulb } from 'lucide-react';

function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function InsightsTab({ insight }) {
  if (!insight) {
    return (
      <div className="text-center py-10">
        <TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-30" />
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No AI insights yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4" style={{ color: '#c4b5fd' }} />
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#c4b5fd' }}>Conversation Summary</p>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>{insight.summary}</p>
      </div>

      {/* Stage & Temperature */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Stage</p>
          <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{insight.conversation_stage || '—'}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Temperature</p>
          <p className="text-sm font-semibold" style={{ color: insight.temperature === 'hot' ? '#f87171' : insight.temperature === 'warm' ? 'hsl(38 92% 55%)' : '#93c5fd' }}>
            {insight.temperature || '—'}
          </p>
        </div>
      </div>

      {/* Key Facts */}
      {insight.key_facts && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Key Facts</p>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>{insight.key_facts}</p>
        </div>
      )}

      {/* Outstanding Items */}
      {insight.outstanding_items && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4" style={{ color: '#f87171' }} />
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#f87171' }}>Outstanding</p>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>{insight.outstanding_items}</p>
        </div>
      )}

      {/* Suggestions */}
      {insight.suggestions?.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>AI Suggestions</p>
          <div className="space-y-2">
            {insight.suggestions.map((s, i) => (
              <div key={i} className="rounded-lg p-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-3.5 h-3.5" style={{ color: '#34d399' }} />
                  <p className="text-xs font-semibold" style={{ color: '#34d399' }}>{s.title}</p>
                </div>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{s.reason}</p>
                {s.suggested_message && (
                  <p className="text-xs mt-1.5 italic" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    "{s.suggested_message}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {insight.last_analyzed_at && (
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Analyzed: {formatDate(insight.last_analyzed_at)}</p>
      )}
    </div>
  );
}