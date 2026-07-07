// CommandCenterHero — 4 clickable stat tiles that answer "who do I strike today?"
// Each tile filters the Strike List below when clicked (toggle behavior).
//
// Tiles:
//   1. Strike Now      — ai_strike_now === true
//   2. Needs Review    — needs_human_review === true
//   3. Hot This Week   — urgency_score >= 70
//   4. New & Untouched — stage === 'initial_contact' && !ai_processed_at

import React from 'react';
import { Zap, Eye, Flame, Sparkles } from 'lucide-react';

const LDC = {
  gold: '#c9a24b', glite: '#e3c06a', ink: '#e8ecf6', slate: '#8b96b0',
  blue: '#5a93e0', green: '#3fb98a', violet: '#a78bfa', amber: '#f0a830',
};

const TILE_META = {
  strike:  { icon: Zap,      label: 'Strike Now',     sub: 'AI-flagged urgent',     color: LDC.gold },
  review:  { icon: Eye,       label: 'Needs Review',   sub: 'Flagged for human eye', color: LDC.violet },
  hot:     { icon: Flame,     label: 'Hot This Week',   sub: 'Urgency ≥ 70',          color: LDC.amber },
  new:     { icon: Sparkles,  label: 'New & Untouched', sub: 'Initial contact, no AI', color: LDC.blue },
};

export default function CommandCenterHero({ counts, activeFilter, onToggle }) {
  const tiles = [
    { key: 'strike', count: counts.strike },
    { key: 'review', count: counts.review },
    { key: 'hot',    count: counts.hot },
    { key: 'new',    count: counts.new },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tiles.map(({ key, count }) => {
        const meta = TILE_META[key];
        const Icon = meta.icon;
        const active = activeFilter === key;
        return (
          <button
            key={key}
            onClick={() => onToggle(active ? null : key)}
            className="group relative overflow-hidden rounded-2xl p-4 text-left transition-all duration-200"
            style={{
              background: active
                ? `linear-gradient(160deg, ${meta.color}26, ${meta.color}08)`
                : 'linear-gradient(180deg, rgba(255,255,255,.032) 0%, rgba(255,255,255,.007) 100%)',
              border: active
                ? `1px solid ${meta.color}88`
                : '1px solid rgba(255,255,255,.08)',
              boxShadow: active
                ? `0 0 22px ${meta.color}22, inset 0 1px 0 rgba(255,255,255,.11)`
                : '0 16px 34px -22px rgba(0,0,0,.85)',
            }}
          >
            {/* Accent glow */}
            <div
              className="absolute -top-6 -right-6 w-24 h-24 rounded-full pointer-events-none transition-opacity duration-300"
              style={{
                background: `radial-gradient(circle, ${meta.color}30 0%, transparent 65%)`,
                opacity: active ? 1 : 0.4,
              }}
            />
            <div className="relative flex items-start justify-between mb-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
                style={{
                  background: `${meta.color}1a`,
                  border: `1px solid ${meta.color}3a`,
                }}
              >
                <Icon className="w-4 h-4" style={{ color: meta.color }} />
              </div>
              <span
                className="text-2xl font-bold tabular-nums"
                style={{ fontFamily: "'Cormorant',serif", color: active ? meta.color : LDC.ink }}
              >
                {count}
              </span>
            </div>
            <div
              className="text-sm font-semibold mb-0.5"
              style={{ fontFamily: "'Inter',sans-serif", color: active ? meta.color : LDC.ink }}
            >
              {meta.label}
            </div>
            <div className="text-[10px]" style={{ color: LDC.slate, fontFamily: "'Inter',sans-serif" }}>
              {meta.sub}
            </div>
          </button>
        );
      })}
    </div>
  );
}