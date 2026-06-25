import React, { useEffect, useRef, useState } from 'react';

/**
 * Erudite Hero Banner — Animated Luxury Brand Banner
 * SVG + CSS animations with subtle, premium motion
 */
export default function EruditeHeroBanner() {
  const [mounted, setMounted] = useState(false);
  const [particles, setParticles] = useState([]);
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    setMounted(true);
    // Generate floating particles
    setParticles(
      Array.from({ length: 12 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 1,
        duration: Math.random() * 10 + 15,
        delay: Math.random() * 5,
      }))
    );
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl mb-8"
      style={{
        minHeight: 320,
        maxHeight: 380,
        background: 'radial-gradient(ellipse at 50% 30%, #0B1F3A 0%, #0A1A30 60%, #071224 100%)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Subtle texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Floating particles */}
      {!prefersReducedMotion.current && particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: 'rgba(201,162,75,0.4)',
            boxShadow: '0 0 8px rgba(201,162,75,0.3)',
            animation: `float ${p.duration}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      {/* Main content */}
      <div
        className="relative z-10 flex flex-col items-center justify-center h-full px-8 py-12"
        style={{
          animation: !prefersReducedMotion.current ? 'gentleFloat 5s ease-in-out infinite' : 'none',
        }}
      >
        {/* Top decorative line with stepped notch */}
        <svg
          width="280"
          height="24"
          viewBox="0 0 280 24"
          className="mb-3"
          style={{ opacity: 0.9 }}
        >
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C0C0C0">
                {!prefersReducedMotion.current && (
                  <animate attributeName="stop-color" values="#C0C0C0;#D4AF37;#C0C0C0" dur="4s" repeatCount="indefinite" />
                )}
              </stop>
              <stop offset="50%" stopColor="#D4AF37">
                {!prefersReducedMotion.current && (
                  <animate attributeName="stop-color" values="#D4AF37;#F5E6A3;#D4AF37" dur="4s" repeatCount="indefinite" />
                )}
              </stop>
              <stop offset="100%" stopColor="#C9A961">
                {!prefersReducedMotion.current && (
                  <animate attributeName="stop-color" values="#C9A961;#E5C875;#C9A961" dur="4s" repeatCount="indefinite" />
                )}
              </stop>
            </linearGradient>
            <linearGradient id="shimmerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(255,255,255,0)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.4)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>
          
          {/* Main line with stepped notch */}
          <path
            d="M 0 12 L 160 12 L 160 6 L 190 6 L 190 12 L 280 12"
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="1.5"
            strokeLinecap="round"
            style={{
              opacity: 0.8,
              filter: 'drop-shadow(0 2px 4px rgba(201,162,75,0.3))',
            }}
          />
          
          {/* Animated shimmer sweep */}
          {!prefersReducedMotion.current && (
            <rect x="0" y="4" width="60" height="16" fill="url(#shimmerGradient)">
              <animate attributeName="x" from="-60" to="280" dur="6s" repeatCount="indefinite" />
            </rect>
          )}
          
          {/* Traveling gold dot ("walker") */}
          {!prefersReducedMotion.current && (
            <circle r="3" fill="#D4AF37" style={{ filter: 'drop-shadow(0 0 6px rgba(212,175,55,0.6))' }}>
              <animateMotion
                dur="8s"
                repeatCount="indefinite"
                path="M 0 12 L 160 12 L 160 6 L 190 6 L 190 12 L 280 12"
                keyPoints="0;0.57;0.57;0.68;0.68;1"
                keyTimes="0;0.35;0.40;0.50;0.55;1"
                calcMode="linear"
              />
            </circle>
          )}
        </svg>

        {/* ERUDITE TEAM */}
        <p
          className="text-xs font-light tracking-[0.3em] uppercase mb-2"
          style={{
            color: 'rgba(220,230,240,0.85)',
            textShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          Erudite Team
        </p>

        {/* ERUDITE wordmark with metallic gradient */}
        <h1
          className="text-6xl md:text-7xl font-semibold tracking-tight mb-3"
          style={{
            fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
            background: 'linear-gradient(135deg, #E8E8E8 0%, #C0C0C0 20%, #D4AF37 50%, #C9A961 80%, #E5C875 100%)',
            backgroundSize: '200% 100%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 3px 12px rgba(0,0,0,0.5))',
            animation: !prefersReducedMotion.current ? 'metallicShimmer 6s ease-in-out infinite' : 'none',
          }}
        >
          ERUDITE
        </h1>

        {/* REAL ESTATE */}
        <p
          className="text-xs font-light tracking-[0.25em] uppercase mb-4"
          style={{
            color: '#D4AF37',
            textShadow: '0 2px 8px rgba(212,175,55,0.3)',
          }}
        >
          Real Estate
        </p>

        {/* Decorative divider with center notch */}
        <div className="flex items-center gap-2 mb-5">
          <div
            className="h-px"
            style={{
              width: 60,
              background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)',
              opacity: 0.6,
            }}
          />
          <div
            className="w-px"
            style={{
              height: 8,
              background: '#D4AF37',
              opacity: 0.8,
            }}
          />
          <div
            className="h-px"
            style={{
              width: 60,
              background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)',
              opacity: 0.6,
            }}
          />
        </div>

        {/* HOLD THE LINE tagline */}
        <p
          className="text-xs font-light tracking-[0.3em] uppercase"
          style={{
            color: 'rgba(220,230,240,0.75)',
            textShadow: '0 1px 4px rgba(0,0,0,0.4)',
          }}
        >
          Hold The Line
        </p>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes gentleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes metallicShimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.4; }
          25% { transform: translateY(-15px) translateX(5px); opacity: 0.6; }
          50% { transform: translateY(-8px) translateX(-5px); opacity: 0.5; }
          75% { transform: translateY(-18px) translateX(3px); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}