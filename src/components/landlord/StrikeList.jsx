// StrikeList — vertical prioritized queue (NOT a grid). The DEFAULT view of the
// Landlord Command Center. Sorted descending by urgency_score × mandate_win_probability.
//
// Each row: avatar/photo, full name, project_name, assigned_agent, rapport dot,
// AI next-best-action one-liner, and an amber "add price" chip when asking_price_aed
// is missing. Clicking a row navigates to the landlord detail V-card.
//
// Props:
//   landlords (array)    — already filtered + scoped
//   activeFilter (str|null) — 'strike' | 'review' | 'hot' | 'new' | null
//   onSelectLandlord (fn)
//   getPhotoForPhone (fn)

import React, { useMemo } from 'react';
import { ChevronRight, AlertCircle } from 'lucide-react';

const LDC = {
  gold: '#c9a24b', glite: '#e3c06a', ink: '#e8ecf6', slate: '#8b96b0', dim: '#5f6a85',
  blue: '#5a93e0', green: '#3fb98a', violet: '#a78bfa', amber: '#f0a830', rose: '#f87171',
};

const RAPPORT_COLORS = {
  cold: '#71717a',
  warming: LDC.amber,
  rapport_built: LDC.blue,
  trust_established: LDC.green,
  champion: LDC.gold,
};

function combinedScore(l) {
  const u = typeof l.urgency_score === 'number' ? l.urgency_score : 0;
  const w = typeof l.mandate_win_probability === 'number' ? l.mandate_win_probability : 0;
  return u * w; // urgency 0-100 × win-prob 0-1 → 0-100
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function agentShort(email) {
  if (!email) return 'Unassigned';
  const name = email.split('@')[0];
  return name.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function StrikeList({ landlords, activeFilter, onSelectLandlord, getPhotoForPhone }) {
  const sorted = useMemo(() => {
    return [...landlords]
      .sort((a, b) => combinedScore(b) - combinedScore(a));
  }, [landlords]);

  if (!sorted.length) {
    return (
      <div className="flex items-center justify-center py-16 text-sm" style={{ color: LDC.dim }}>
        No landlords match this filter.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* List header */}
      <div className="flex items-center justify-between px-2 pb-2 mb-1" style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: LDC.slate, fontFamily: "'Inter',sans-serif" }}>
          {activeFilter ? 'Filtered queue' : 'Priority queue'}
        </span>
        <span className="text-[11px] font-semibold" style={{ color: LDC.gold }}>
          {sorted.length} landlord{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {sorted.map((l, idx) => {
        const name = l.full_name_en || l.full_name || 'Unknown';
        const nba = l.ai_next_best_action?.action || '';
        const nbaReason = l.ai_next_best_action?.reasoning || '';
        const rapport = l.rapport_level || 'cold';
        const rapportColor = RAPPORT_COLORS[rapport] || RAPPORT_COLORS.cold;
        const hasPrice = l.asking_price_aed != null && l.asking_price_aed > 0;
        const photo = getPhotoForPhone ? getPhotoForPhone(l.phone) : null;
        const score = combinedScore(l);

        return (
          <button
            key={l.id}
            onClick={() => onSelectLandlord(l.id)}
            className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150"
            style={{
              background: 'rgba(255,255,255,.025)',
              border: '1px solid rgba(255,255,255,.06)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,.05)';
              e.currentTarget.style.borderColor = 'rgba(201,162,75,.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,.025)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,.06)';
            }}
          >
            {/* Rank number */}
            <span
              className="shrink-0 w-6 text-center text-[11px] font-bold tabular-nums"
              style={{ color: idx < 3 ? LDC.gold : LDC.dim, fontFamily: "'Inter',sans-serif" }}
            >
              {idx + 1}
            </span>

            {/* Avatar / photo */}
            <div className="shrink-0 relative">
              {photo ? (
                <img src={photo} alt={name} className="w-9 h-9 rounded-full object-cover" style={{ border: `1.5px solid ${rapportColor}55` }} />
              ) : (
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: `${rapportColor}1a`, border: `1.5px solid ${rapportColor}55`, color: rapportColor }}
                >
                  {initials(name)}
                </div>
              )}
              {/* Rapport dot */}
              <span
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full"
                style={{ background: rapportColor, border: '2px solid #0a0e1a' }}
                title={`Rapport: ${rapport}`}
              />
            </div>

            {/* Name + project + agent */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold truncate" style={{ color: LDC.ink, fontFamily: "'Inter',sans-serif" }}>
                  {name}
                </span>
                {!hasPrice && (
                  <span
                    className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase"
                    style={{ background: 'rgba(240,168,48,.12)', border: '1px solid rgba(240,168,48,.3)', color: LDC.amber }}
                  >
                    <AlertCircle className="w-2.5 h-2.5" /> Add price
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {l.project_name && (
                  <span className="text-[11px] truncate" style={{ color: LDC.slate }}>
                    {l.project_name}
                  </span>
                )}
                {l.unit_reference && (
                  <>
                    <span style={{ color: LDC.dim }}>·</span>
                    <span className="text-[11px] truncate" style={{ color: LDC.dim }}>{l.unit_reference}</span>
                  </>
                )}
              </div>
              {/* AI next-best-action */}
              {nba && (
                <div className="text-[11px] mt-1 truncate" style={{ color: LDC.violet, fontFamily: "'Inter',sans-serif" }}>
                  ↳ {nba}{nbaReason ? ` — ${nbaReason}` : ''}
                </div>
              )}
            </div>

            {/* Agent + score */}
            <div className="shrink-0 flex flex-col items-end gap-1">
              <span className="text-[10px] font-medium" style={{ color: LDC.slate }}>
                {agentShort(l.assigned_agent_email)}
              </span>
              {score > 0 && (
                <span
                  className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md"
                  style={{ background: 'rgba(201,162,75,.1)', color: LDC.gold }}
                >
                  {Math.round(score)}
                </span>
              )}
            </div>

            <ChevronRight className="w-4 h-4 shrink-0 opacity-30 group-hover:opacity-60 transition-opacity" style={{ color: LDC.gold }} />
          </button>
        );
      })}
    </div>
  );
}