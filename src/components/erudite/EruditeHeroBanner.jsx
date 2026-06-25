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
        minHeight: 140,
        maxHeight: 160,
        background: 'linear-gradient(135deg, rgba(14,42,71,0.75) 0%, rgba(11,31,58,0.80) 50%, rgba(7,21,40,0.85) 100%)',
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
        {/* Elegant curved signature line */}
        <div className="mb-3 relative">
          <svg
            width="280"
            height="32"
            viewBox="0 0 280 32"
            style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }}
          >
            <defs>
              {/* Premium gold gradient */}
              <linearGradient id="signatureGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#C9A961">
                  {!prefersReducedMotion.current && (
                    <animate attributeName="stop-color" values="#C9A961;#D4AF37;#C9A961" dur="6s" repeatCount="indefinite" />
                  )}
                </stop>
                <stop offset="50%" stopColor="#F5E6A3">
                  {!prefersReducedMotion.current && (
                    <animate attributeName="stop-color" values="#F5E6A3;#FFD700;#F5E6A3" dur="6s" repeatCount="indefinite" />
                  )}
                </stop>
                <stop offset="100%" stopColor="#D4AF37">
                  {!prefersReducedMotion.current && (
                    <animate attributeName="stop-color" values="#D4AF37;#E5C875;#D4AF37" dur="6s" repeatCount="indefinite" />
                  )}
                </stop>
              </linearGradient>

              {/* Enhanced glow */}
              <filter id="signatureGlow">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Elegant curved path with decorative loops */}
            <path
              d="M 10 16 C 60 16, 80 10, 100 12 C 120 14, 140 18, 160 16 C 180 14, 200 10, 270 16"
              fill="none"
              stroke="url(#signatureGradient)"
              strokeWidth="2"
              strokeLinecap="round"
              filter="url(#signatureGlow)"
              style={{ opacity: 0.9 }}
            />

            {/* Center ornamental flourish */}
            <circle cx="140" cy="14" r="2.5" fill="#F5E6A3" style={{ filter: 'drop-shadow(0 0 8px rgba(245,230,163,0.8))' }}>
              {!prefersReducedMotion.current && (
                <animate attributeName="r" values="2.5;3.2;2.5" dur="2s" repeatCount="indefinite" />
              )}
            </circle>

            {/* Traveling light effect */}
            {!prefersReducedMotion.current && (
              <ellipse cx="0" cy="16" rx="20" ry="6" fill="rgba(245,230,163,0.15)">
                <animate attributeName="cx" from="-20" to="300" dur="8s" repeatCount="indefinite" />
              </ellipse>
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
          className="text-5xl md:text-6xl font-semibold tracking-tight mb-2"
          style={{
            fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
            background: 'linear-gradient(180deg, #FFFFFF 0%, #F0F0F0 12%, #D8D8D8 25%, #D4AF37 55%, #C9A961 75%, #E5C875 100%)',
            backgroundSize: '100% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.6))',
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