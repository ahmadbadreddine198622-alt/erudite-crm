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
      className="relative w-full overflow-hidden rounded-[2rem] mb-10"
      style={{
        minHeight: 360,
        maxHeight: 420,
        background: 'radial-gradient(ellipse at 50% 20%, #0E2A47 0%, #0B1F3A 45%, #071528 75%, #040D18 100%)',
        boxShadow: '0 32px 100px rgba(0,0,0,0.7), inset 0 2px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.3)',
        border: '1px solid rgba(201,162,75,0.15)',
      }}
    >
      {/* Animated gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 30% 50%, rgba(201,162,75,0.08) 0%, transparent 40%), radial-gradient(circle at 70% 40%, rgba(212,175,55,0.06) 0%, transparent 35%)',
          animation: !prefersReducedMotion.current ? 'gradientPulse 8s ease-in-out infinite' : 'none',
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
            className="absolute top-4 left-4 w-16 h-16"
            style={{
              border: '1px solid rgba(201,162,75,0.2)',
              borderRight: 'none',
              borderBottom: 'none',
              borderRadius: '8px 0 0 0',
              animation: 'cornerFade 3s ease-out',
            }}
          />
          <div
            className="absolute top-4 right-4 w-16 h-16"
            style={{
              border: '1px solid rgba(201,162,75,0.2)',
              borderLeft: 'none',
              borderBottom: 'none',
              borderRadius: '0 8px 0 0',
              animation: 'cornerFade 3s ease-out 0.2s both',
            }}
          />
          <div
            className="absolute bottom-4 left-4 w-16 h-16"
            style={{
              border: '1px solid rgba(201,162,75,0.2)',
              borderRight: 'none',
              borderTop: 'none',
              borderRadius: '0 0 0 8px',
              animation: 'cornerFade 3s ease-out 0.4s both',
            }}
          />
          <div
            className="absolute bottom-4 right-4 w-16 h-16"
            style={{
              border: '1px solid rgba(201,162,75,0.2)',
              borderLeft: 'none',
              borderTop: 'none',
              borderRadius: '0 0 8px 0',
              animation: 'cornerFade 3s ease-out 0.6s both',
            }}
          />
        </>
      )}

      {/* Main content container */}
      <div
        className="relative z-10 flex flex-col items-center justify-center h-full px-8 py-14"
        style={{
          animation: !prefersReducedMotion.current ? 'elegantFloat 6s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
        }}
      >
        {/* Top signature line with stepped notch - enhanced */}
        <div className="mb-6 relative">
          <svg
            width="320"
            height="32"
            viewBox="0 0 320 32"
            className="drop-shadow-lg"
            style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }}
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

            {/* Main line path with elegant stepped notch */}
            <path
              d="M 20 16 L 180 16 L 180 10 L 215 10 L 215 16 L 300 16"
              fill="none"
              stroke="url(#dynamicLineGradient)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#lineGlow)"
              style={{ opacity: 0.9 }}
            />

            {/* Traveling shimmer */}
            {!prefersReducedMotion.current && (
              <rect x="0" y="6" width="80" height="20" fill="url(#lineShimmer)">
                <animate attributeName="x" from="-80" to="320" dur="7s" repeatCount="indefinite" />
              </rect>
            )}

            {/* Animated gold walker with glow trail */}
            {!prefersReducedMotion.current && (
              <g>
                {/* Glow trail */}
                <ellipse cx="0" cy="16" rx="12" ry="4" fill="rgba(212,175,55,0.3)">
                  <animateMotion
                    dur="10s"
                    repeatCount="indefinite"
                    path="M 20 16 L 180 16 L 180 10 L 215 10 L 215 16 L 300 16"
                    keyPoints="0;0.53;0.53;0.65;0.65;1"
                    keyTimes="0;0.40;0.45;0.55;0.60;1"
                  />
                </ellipse>
                {/* Main walker dot */}
                <circle r="4" fill="#F5E6A3" style={{ filter: 'drop-shadow(0 0 8px rgba(245,230,163,0.8))' }}>
                  <animateMotion
                    dur="10s"
                    repeatCount="indefinite"
                    path="M 20 16 L 180 16 L 180 10 L 215 10 L 215 16 L 300 16"
                    keyPoints="0;0.53;0.53;0.65;0.65;1"
                    keyTimes="0;0.40;0.45;0.55;0.60;1"
                  />
                </circle>
              </g>
            )}
          </svg>
        </div>

        {/* ERUDITE TEAM - refined */}
        <p
          className="text-[10px] font-extralight tracking-[0.35em] uppercase mb-3"
          style={{
            color: 'rgba(235,240,245,0.75)',
            textShadow: '0 2px 12px rgba(0,0,0,0.5)',
            letterSpacing: '0.4em',
          }}
        >
          Erudite Team
        </p>

        {/* ERUDITE wordmark - enhanced metallic effect */}
        <h1
          className="text-7xl md:text-8xl font-medium tracking-[-0.02em] mb-4"
          style={{
            fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
            background: 'linear-gradient(180deg, #F0F0F0 0%, #D8D8D8 15%, #C0C0C0 30%, #D4AF37 55%, #C9A961 75%, #E5C875 100%)',
            backgroundSize: '100% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.6))',
            animation: !prefersReducedMotion.current ? 'metallicFlow 8s ease-in-out infinite' : 'none',
            transformStyle: 'preserve-3d',
          }}
        >
          ERUDITE
        </h1>

        {/* REAL ESTATE - gold refinement */}
        <p
          className="text-[11px] font-light tracking-[0.3em] uppercase mb-6"
          style={{
            background: 'linear-gradient(135deg, #D4AF37 0%, #C9A961 50%, #E5C875 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 2px 10px rgba(212,175,55,0.4)',
          }}
        >
          Real Estate
        </p>

        {/* Ornate divider with center jewel */}
        <div className="flex items-center gap-3 mb-7">
          <div
            className="h-px flex-1 max-w-[80px]"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(201,162,75,0.6), rgba(201,162,75,0.3))',
            }}
          />
          <div
            className="w-2 h-2 rotate-45"
            style={{
              background: 'linear-gradient(135deg, #F5E6A3 0%, #D4AF37 100%)',
              boxShadow: '0 0 12px rgba(212,175,55,0.6), inset 0 1px 2px rgba(255,255,255,0.4)',
              animation: !prefersReducedMotion.current ? 'jewelPulse 4s ease-in-out infinite' : 'none',
            }}
          />
          <div
            className="h-px flex-1 max-w-[80px]"
            style={{
              background: 'linear-gradient(90deg, rgba(201,162,75,0.3), rgba(201,162,75,0.6), transparent)',
            }}
          />
        </div>

        {/* HOLD THE LINE - silver refinement */}
        <p
          className="text-[10px] font-extralight tracking-[0.35em] uppercase"
          style={{
            color: 'rgba(210,220,230,0.8)',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            letterSpacing: '0.35em',
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