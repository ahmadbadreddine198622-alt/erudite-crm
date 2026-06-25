import React, { useEffect, useRef, useState } from 'react';

/**
 * Erudite Hero Banner V2 — Redefined Luxury
 * Enhanced animations, deeper visual hierarchy, premium motion design
 */
export default function EruditeHeroBanner() {
  const [mounted, setMounted] = useState(false);
  const [particles, setParticles] = useState([]);
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    setMounted(true);
    // Generate layered floating particles
    setParticles(
      Array.from({ length: 18 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2.5 + 0.8,
        duration: Math.random() * 12 + 18,
        delay: Math.random() * 8,
        opacity: Math.random() * 0.4 + 0.2,
      }))
    );
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl mb-6"
      style={{
        minHeight: 180,
        maxHeight: 220,
        background: 'linear-gradient(135deg, rgba(14,42,71,0.85) 0%, rgba(11,31,58,0.88) 50%, rgba(7,21,40,0.92) 100%)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        border: '1px solid rgba(201,162,75,0.2)',
      }}
    >
      {/* Animated gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 30% 50%, rgba(201,162,75,0.06) 0%, transparent 45%), radial-gradient(circle at 70% 40%, rgba(212,175,55,0.05) 0%, transparent 40%)',
          animation: !prefersReducedMotion.current ? 'gradientPulse 10s ease-in-out infinite' : 'none',
        }}
      />

      {/* Subtle noise texture */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Floating luminescent particles */}
      {!prefersReducedMotion.current && particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: `radial-gradient(circle, rgba(212,175,55,${p.opacity}) 0%, transparent 70%)`,
            boxShadow: `0 0 ${p.size * 3}px rgba(212,175,55,${p.opacity * 0.6})`,
            animation: `particleFloat ${p.duration}s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      {/* Ornamental corner accents */}
      {!prefersReducedMotion.current && (
        <>
          <div
            className="absolute top-2.5 left-2.5 w-10 h-10"
            style={{
              border: '1px solid rgba(201,162,75,0.15)',
              borderRight: 'none',
              borderBottom: 'none',
              borderRadius: '6px 0 0 0',
              animation: 'cornerFade 3s ease-out',
            }}
          />
          <div
            className="absolute top-2.5 right-2.5 w-10 h-10"
            style={{
              border: '1px solid rgba(201,162,75,0.15)',
              borderLeft: 'none',
              borderBottom: 'none',
              borderRadius: '0 6px 0 0',
              animation: 'cornerFade 3s ease-out 0.15s both',
            }}
          />
          <div
            className="absolute bottom-2.5 left-2.5 w-10 h-10"
            style={{
              border: '1px solid rgba(201,162,75,0.15)',
              borderRight: 'none',
              borderTop: 'none',
              borderRadius: '0 0 0 6px',
              animation: 'cornerFade 3s ease-out 0.3s both',
            }}
          />
          <div
            className="absolute bottom-2.5 right-2.5 w-10 h-10"
            style={{
              border: '1px solid rgba(201,162,75,0.15)',
              borderLeft: 'none',
              borderTop: 'none',
              borderRadius: '0 0 6px 0',
              animation: 'cornerFade 3s ease-out 0.45s both',
            }}
          />
        </>
      )}

      {/* Main content container */}
      <div
        className="relative z-10 flex flex-col items-center justify-center h-full px-6 py-8"
        style={{
          animation: !prefersReducedMotion.current ? 'elegantFloat 6s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
        }}
      >
        {/* Top signature line with stepped notch */}
        <div className="mb-3 relative">
          <svg
            width="240"
            height="24"
            viewBox="0 0 240 24"
            style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }}
          >
            <defs>
              {/* Dynamic gradient that shifts */}
              <linearGradient id="dynamicLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#B8B8B8">
                  {!prefersReducedMotion.current && (
                    <animate attributeName="stop-color" values="#B8B8B8;#C9A961;#B8B8B8" dur="5s" repeatCount="indefinite" />
                  )}
                </stop>
                <stop offset="35%" stopColor="#D4AF37">
                  {!prefersReducedMotion.current && (
                    <animate attributeName="stop-color" values="#D4AF37;#E8D68A;#D4AF37" dur="5s" repeatCount="indefinite" />
                  )}
                </stop>
                <stop offset="65%" stopColor="#C9A961">
                  {!prefersReducedMotion.current && (
                    <animate attributeName="stop-color" values="#C9A961;#D4AF37;#C9A961" dur="5s" repeatCount="indefinite" />
                  )}
                </stop>
                <stop offset="100%" stopColor="#E5C875">
                  {!prefersReducedMotion.current && (
                    <animate attributeName="stop-color" values="#E5C875;#F0D99C;#E5C875" dur="5s" repeatCount="indefinite" />
                  )}
                </stop>
              </linearGradient>

              {/* Glow filter */}
              <filter id="lineGlow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Shimmer gradient */}
              <linearGradient id="lineShimmer" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="45%" stopColor="rgba(255,255,255,0.3)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.5)" />
                <stop offset="55%" stopColor="rgba(255,255,255,0.3)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>

            {/* Main line path with stepped notch */}
            <path
              d="M 15 12 L 135 12 L 135 8 L 160 8 L 160 12 L 225 12"
              fill="none"
              stroke="url(#dynamicLineGradient)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#lineGlow)"
              style={{ opacity: 0.85 }}
            />

            {/* Traveling shimmer */}
            {!prefersReducedMotion.current && (
              <rect x="0" y="4" width="60" height="16" fill="url(#lineShimmer)">
                <animate attributeName="x" from="-60" to="240" dur="7s" repeatCount="indefinite" />
              </rect>
            )}

            {/* Animated gold walker with glow trail */}
            {!prefersReducedMotion.current && (
              <g>
                {/* Glow trail */}
                <ellipse cx="0" cy="12" rx="8" ry="3" fill="rgba(212,175,55,0.25)">
                  <animateMotion
                    dur="10s"
                    repeatCount="indefinite"
                    path="M 15 12 L 135 12 L 135 8 L 160 8 L 160 12 L 225 12"
                    keyPoints="0;0.53;0.53;0.65;0.65;1"
                    keyTimes="0;0.40;0.45;0.55;0.60;1"
                  />
                </ellipse>
                {/* Main walker dot */}
                <circle r="3" fill="#F5E6A3" style={{ filter: 'drop-shadow(0 0 6px rgba(245,230,163,0.7))' }}>
                  <animateMotion
                    dur="10s"
                    repeatCount="indefinite"
                    path="M 15 12 L 135 12 L 135 8 L 160 8 L 160 12 L 225 12"
                    keyPoints="0;0.53;0.53;0.65;0.65;1"
                    keyTimes="0;0.40;0.45;0.55;0.60;1"
                  />
                </circle>
              </g>
            )}
          </svg>
        </div>

        {/* ERUDITE TEAM */}
        <p
          className="text-[8px] font-extralight tracking-[0.25em] uppercase mb-2"
          style={{
            color: 'rgba(235,240,245,0.7)',
            textShadow: '0 1px 8px rgba(0,0,0,0.4)',
          }}
        >
          Erudite Team
        </p>

        {/* ERUDITE wordmark */}
        <h1
          className="text-4xl md:text-5xl font-medium tracking-tight mb-2"
          style={{
            fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
            background: 'linear-gradient(180deg, #F0F0F0 0%, #D8D8D8 15%, #C0C0C0 30%, #D4AF37 55%, #C9A961 75%, #E5C875 100%)',
            backgroundSize: '100% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 3px 12px rgba(0,0,0,0.5))',
            animation: !prefersReducedMotion.current ? 'metallicFlow 8s ease-in-out infinite' : 'none',
          }}
        >
          ERUDITE
        </h1>

        {/* REAL ESTATE */}
        <p
          className="text-[9px] font-light tracking-[0.25em] uppercase mb-3"
          style={{
            background: 'linear-gradient(135deg, #D4AF37 0%, #C9A961 50%, #E5C875 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 1px 8px rgba(212,175,55,0.35)',
          }}
        >
          Real Estate
        </p>

        {/* Ornate divider with center jewel */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="h-px flex-1 max-w-[60px]"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(201,162,75,0.5), rgba(201,162,75,0.25))',
            }}
          />
          <div
            className="w-1.5 h-1.5 rotate-45"
            style={{
              background: 'linear-gradient(135deg, #F5E6A3 0%, #D4AF37 100%)',
              boxShadow: '0 0 8px rgba(212,175,55,0.5), inset 0 1px 1px rgba(255,255,255,0.3)',
              animation: !prefersReducedMotion.current ? 'jewelPulse 4s ease-in-out infinite' : 'none',
            }}
          />
          <div
            className="h-px flex-1 max-w-[60px]"
            style={{
              background: 'linear-gradient(90deg, rgba(201,162,75,0.25), rgba(201,162,75,0.5), transparent)',
            }}
          />
        </div>

        {/* HOLD THE LINE */}
        <p
          className="text-[8px] font-extralight tracking-[0.25em] uppercase"
          style={{
            color: 'rgba(210,220,230,0.75)',
            textShadow: '0 1px 8px rgba(0,0,0,0.4)',
          }}
        >
          Hold The Line
        </p>
      </div>

      {/* Vignette overlay for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.2) 80%, rgba(0,0,0,0.4) 100%)',
        }}
      />

      {/* CSS Animations */}
      <style>{`
        @keyframes elegantFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-3px) scale(1.002); }
        }
        @keyframes metallicFlow {
          0%, 100% { background-position: 0% 0%; }
          50% { background-position: 0% 100%; }
        }
        @keyframes gradientPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        @keyframes particleFloat {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.2; }
          20% { transform: translateY(-20px) translateX(8px); opacity: 0.35; }
          40% { transform: translateY(-12px) translateX(-6px); opacity: 0.25; }
          60% { transform: translateY(-25px) translateX(4px); opacity: 0.4; }
          80% { transform: translateY(-15px) translateX(-4px); opacity: 0.3; }
        }
        @keyframes jewelPulse {
          0%, 100% { transform: rotate(45deg) scale(1); opacity: 0.9; }
          50% { transform: rotate(45deg) scale(1.15); opacity: 1; }
        }
        @keyframes cornerFade {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}