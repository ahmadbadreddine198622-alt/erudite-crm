import React from 'react';
import { GraduationCap, CheckCircle2, AlertCircle, Star, MessageCircle } from 'lucide-react';

export function CoachTab({ coach }) {
  if (!coach) {
    return (
      <div className="text-center py-10">
        <GraduationCap className="w-8 h-8 mx-auto mb-3 opacity-30" />
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No coaching insights yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Score */}
      <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)' }}>
        <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: '#c4b5fd' }}>Quality Score</p>
        <p className="text-4xl font-bold" style={{ color: '#c4b5fd' }}>{coach.quality_score || 0}</p>
        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>out of 100</p>
      </div>

      {/* Things Done Well */}
      {coach.things_done_well?.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4" style={{ color: '#34d399' }} />
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#34d399' }}>Done Well</p>
          </div>
          <ul className="space-y-1">
            {coach.things_done_well.map((item, i) => (
              <li key={i} className="text-sm flex items-start gap-1.5" style={{ color: 'rgba(255,255,255,0.8)' }}>
                <Star className="w-3.5 h-3.5 shrink-0" style={{ color: '#fbbf24' }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Missed Opportunities */}
      {coach.missed_opportunities?.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4" style={{ color: 'hsl(38 92% 55%)' }} />
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'hsl(38 92% 55%)' }}>Missed Opportunities</p>
          </div>
          <ul className="space-y-1">
            {coach.missed_opportunities.map((item, i) => (
              <li key={i} className="text-sm flex items-start gap-1.5" style={{ color: 'rgba(255,255,255,0.8)' }}>
                <span className="text-amber-400">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Move */}
      {coach.next_move_recommended && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)' }}>
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle className="w-4 h-4" style={{ color: '#93c5fd' }} />
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#93c5fd' }}>Recommended Next Move</p>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>{coach.next_move_recommended}</p>
        </div>
      )}

      {/* Single Best Line */}
      {coach.single_best_line_to_use && (
        <div className="rounded-xl p-4 italic" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Best Line to Use</p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>"{coach.single_best_line_to_use}"</p>
        </div>
      )}
    </div>
  );
}