import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, TrendingUp, FileText, Camera, Megaphone, ChevronRight, ArrowRight } from 'lucide-react';

const PHASE_CONFIG = {
  New: {
    icon: Building2,
    gradient: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)',
    accent: 'hsl(217 91% 60%)',
    glow: 'rgba(59,130,246,0.4)',
    description: 'Initial contact & price discovery',
  },
  Mandate: {
    icon: FileText,
    gradient: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)',
    accent: 'hsl(38 92% 55%)',
    glow: 'rgba(245,158,11,0.4)',
    description: 'Listing commitment & Form A signing',
  },
  'Docs & Media': {
    icon: Camera,
    gradient: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(139,92,246,0.05) 100%)',
    accent: 'hsl(271 76% 63%)',
    glow: 'rgba(139,92,246,0.4)',
    description: 'Owner documents & photography',
  },
  Listing: {
    icon: Building2,
    gradient: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)',
    accent: 'hsl(163 84% 44%)',
    glow: 'rgba(16,185,129,0.4)',
    description: 'Creation, verification & publication',
  },
  Marketing: {
    icon: Megaphone,
    gradient: 'linear-gradient(135deg, rgba(244,63,94,0.15) 0%, rgba(244,63,94,0.05) 100%)',
    accent: 'hsl(349 90% 60%)',
    glow: 'rgba(244,63,94,0.4)',
    description: 'Agent network & client blast',
  },
};

export default function SmartPipelineVisualizer({ phaseCounts, onPhaseClick }) {
  const [hoveredPhase, setHoveredPhase] = useState(null);
  const [expandedPhase, setExpandedPhase] = useState(null);
  const navigate = useNavigate();

  const totalDeals = Object.values(phaseCounts).reduce((a, b) => a + b, 0);
  const maxCount = Math.max(...Object.values(phaseCounts), 1);

  const handleClick = (phaseName) => {
    if (onPhaseClick) {
      onPhaseClick(phaseName);
    } else {
      navigate('/landlords');
    }
  };

  return (
    <div className="w-full mb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-2">
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 rounded-full" style={{ background: 'linear-gradient(180deg, hsl(38 92% 55%) 0%, hsl(38 92% 50%) 100%)' }} />
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.01em' }}>Pipeline Intelligence</h2>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em' }}>
              {totalDeals} active deals across 5 phases
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/landlords')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
          style={{
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)',
            color: 'hsl(38 92% 55%)',
          }}
        >
          View All <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Pipeline Flow */}
      <div className="relative">
        {/* Connection Line */}
        <div className="absolute top-8 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }} />
        
        {/* Phase Cards */}
        <div className="grid grid-cols-5 gap-3 relative z-10">
          {Object.entries(PHASE_CONFIG).map(([phaseName, config], index) => {
            const count = phaseCounts[phaseName] || 0;
            const percentage = Math.round((count / maxCount) * 100);
            const isHovered = hoveredPhase === phaseName;
            const isExpanded = expandedPhase === phaseName;
            const Icon = config.icon;

            return (
              <div
                key={phaseName}
                className="relative group cursor-pointer"
                onMouseEnter={() => setHoveredPhase(phaseName)}
                onMouseLeave={() => setHoveredPhase(null)}
                onClick={() => handleClick(phaseName)}
              >
                {/* Animated Background Card */}
                <div
                  className="relative rounded-2xl p-4 transition-all duration-500 ease-out"
                  style={{
                    background: isHovered ? config.gradient : 'rgba(255,255,255,0.04)',
                    border: isHovered ? `1px solid ${config.accent}` : '1px solid rgba(255,255,255,0.08)',
                    borderTop: isHovered ? `1px solid ${config.accent}` : '1px solid rgba(255,255,255,0.12)',
                    boxShadow: isHovered 
                      ? `0 12px 40px ${config.glow}40, inset 0 1px 0 rgba(255,255,255,0.1)`
                      : '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                    transform: isHovered ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
                  }}
                >
                  {/* Glow Effect on Hover */}
                  {isHovered && (
                    <div
                      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                      style={{
                        background: `radial-gradient(ellipse at 50% 0%, ${config.glow}20 0%, transparent 70%)`,
                      }}
                    />
                  )}

                  {/* Phase Number Badge */}
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background: config.gradient,
                      border: `1px solid ${config.accent}`,
                      color: config.accent,
                      boxShadow: `0 2px 8px ${config.glow}40`,
                    }}
                  >
                    {index + 1}
                  </div>

                  {/* Icon */}
                  <div className="flex items-center justify-center mb-3" style={{ height: 40 }}>
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500"
                      style={{
                        background: isHovered ? config.gradient : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${isHovered ? config.accent : 'rgba(255,255,255,0.1)'}`,
                        boxShadow: isHovered ? `0 4px 16px ${config.glow}40` : 'none',
                        transform: isHovered ? 'scale(1.1) rotate(5deg)' : 'scale(1) rotate(0)',
                      }}
                    >
                      <Icon className="w-5 h-5" style={{ color: isHovered ? config.accent : 'rgba(255,255,255,0.5)' }} />
                    </div>
                  </div>

                  {/* Count */}
                  <div className="text-center mb-2">
                    <p
                      className="text-3xl font-bold tabular-nums transition-all duration-500"
                      style={{
                        color: isHovered ? config.accent : 'rgba(255,255,255,0.9)',
                        textShadow: isHovered ? `0 2px 20px ${config.glow}` : 'none',
                      }}
                    >
                      {count}
                    </p>
                  </div>

                  {/* Phase Name */}
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-center"
                    style={{ color: isHovered ? config.accent : 'rgba(255,255,255,0.5)' }}
                  >
                    {phaseName}
                  </p>

                  {/* Progress Bar */}
                  <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${percentage}%`,
                        background: config.accent,
                        boxShadow: isHovered ? `0 0 10px ${config.glow}` : 'none',
                      }}
                    />
                  </div>

                  {/* Description (shown on hover) */}
                  <div
                    className={`mt-2 text-[10px] text-center transition-all duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                    style={{ color: 'rgba(255,255,255,0.6)', height: isHovered ? 'auto' : 0, overflow: 'hidden' }}
                  >
                    {config.description}
                  </div>
                </div>

                {/* Arrow Connector (except last) */}
                {index < 4 && (
                  <div className="absolute top-1/2 -right-2 -translate-y-1/2 z-20">
                    <ChevronRight className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.2)' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 flex items-center justify-center gap-6 px-4 py-3 rounded-2xl"
        style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="text-center">
          <p className="text-lg font-bold" style={{ color: 'hsl(38 92% 55%)' }}>{totalDeals}</p>
          <p className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>Total Deals</p>
        </div>
        <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <div className="text-center">
          <p className="text-lg font-bold" style={{ color: 'hsl(217 91% 60%)' }}>{phaseCounts.New || 0}</p>
          <p className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>New Leads</p>
        </div>
        <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <div className="text-center">
          <p className="text-lg font-bold" style={{ color: 'hsl(38 92% 55%)' }}>{(phaseCounts.Mandate || 0) + (phaseCounts['Docs & Media'] || 0)}</p>
          <p className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>In Progress</p>
        </div>
        <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <div className="text-center">
          <p className="text-lg font-bold" style={{ color: 'hsl(163 84% 44%)' }}>{(phaseCounts.Listing || 0) + (phaseCounts.Marketing || 0)}</p>
          <p className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>Ready to List</p>
        </div>
      </div>
    </div>
  );
}