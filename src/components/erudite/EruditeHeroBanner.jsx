import React, { useEffect, useRef, useState } from 'react';

/**
 * Erudite Hero Banner V3 — Transcendent Luxury
 * Revolutionary design with layered parallax, kinetic typography, and living light effects
 */
export default function EruditeHeroBanner() {
  const [mounted, setMounted] = useState(false);
  const [particles, setParticles] = useState([]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const bannerRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    // Generate multi-layered particle systems
    setParticles(
      Array.from({ length: 24 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        duration: Math.random() * 15 + 20,
        delay: Math.random() * 10,
        opacity: Math.random() * 0.5 + 0.3,
        layer: Math.floor(Math.random() * 3),
      }))
    );

    // Mouse parallax tracking
    if (!prefersReducedMotion.current) {
      const handleMouseMove = (e) => {
        if (bannerRef.current) {
          const rect = bannerRef.current.getBoundingClientRect();
          setMousePos({
            x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
            y: ((e.clientY - rect.top) / rect.height - 0.5) * 2,
          });
        }
      };
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    }
  }, []);

  if (!mounted) return null;

  return (
    <div
      ref={bannerRef}
      className="relative w-full overflow-hidden rounded-3xl mb-6"
      style={{
        minHeight: 200,
        maxHeight: 240,
        background: 'radial-gradient(ellipse at 50% -20%, rgba(20,35,60,0.75) 0%, rgba(10,20,40,0.82) 40%, rgba(5,12,25,0.9) 100%)',
        backdropFilter: 'blur(30px) saturate(180%)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.4)',
        border: '1px solid rgba(201,162,75,0.25)',
        transform: !prefersReducedMotion.current ? `perspective(1000px) rotateX(${mousePos.y * 0.5}deg) rotateY(${mousePos.x * 0.5}deg)` : 'none',
        transition: 'transform 0.1s ease-out',
      }}
    >
      {/* Animated aurora borealis background */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 20% 30%, rgba(212,175,55,0.12) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(100,150,255,0.1) 0%, transparent 45%),
            radial-gradient(ellipse at 50% 80%, rgba(180,100,255,0.08) 0%, transparent 50%)
          `,
          animation: !prefersReducedMotion.current ? 'auroraShift 15s ease-in-out infinite' : 'none',
          filter: 'blur(40px)',
        }}
      />

      {/* Dynamic mesh gradient overlay */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: `
            repeating-linear-gradient(45deg, rgba(212,175,55,0.02) 0px, rgba(212,175,55,0.02) 2px, transparent 2px, transparent 40px),
            repeating-linear-gradient(-45deg, rgba(100,150,255,0.02) 0px, rgba(100,150,255,0.02) 2px, transparent 2px, transparent 40px)
          `,
          animation: !prefersReducedMotion.current ? 'meshFlow 20s linear infinite' : 'none',
        }}
      />

      {/* Floating energy orbs - multi-layered */}
      {!prefersReducedMotion.current && particles.map((p) => {
        const colors = ['rgba(212,175,55,', 'rgba(100,180,255,', 'rgba(180,100,255,'];
        const color = colors[p.layer % 3];
        return (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size * 2,
              height: p.size * 2,
              background: `radial-gradient(circle, ${color}${p.opacity}) 0%, transparent 70%)`,
              boxShadow: `0 0 ${p.size * 8}px ${color}${p.opacity * 0.8})`,
              animation: `orbFloat ${p.duration}s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        );
      })}

      {/* Animated concentric rings */}
      {!prefersReducedMotion.current && (
        <>
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 400,
              height: 400,
              border: '1px solid rgba(212,175,55,0.06)',
              animation: 'ringPulse 8s ease-out infinite',
            }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 300,
              height: 300,
              border: '1px solid rgba(100,180,255,0.06)',
              animation: 'ringPulse 8s ease-out infinite 2s',
            }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 200,
              height: 200,
              border: '1px solid rgba(180,100,255,0.06)',
              animation: 'ringPulse 8s ease-out infinite 4s',
            }}
          />
        </>
      )}

      {/* Luxury corner accents with glow */}
      {!prefersReducedMotion.current && (
        <>
          <div
            className="absolute top-3 left-3 w-14 h-14"
            style={{
              border: '1px solid rgba(201,162,75,0.2)',
              borderRight: 'none',
              borderBottom: 'none',
              borderRadius: '8px 0 0 0',
              boxShadow: '0 0 20px rgba(201,162,75,0.15)',
              animation: 'luxuryFadeIn 2s ease-out',
            }}
          />
          <div
            className="absolute top-3 right-3 w-16 h-16"
            style={{
              background: 'linear-gradient(-135deg, rgba(100,180,255,0.12) 0%, transparent 60%)',
              borderRadius: '0 10px 0 0',
              border: '1px solid rgba(100,180,255,0.25)',
              borderLeft: 'none',
              borderBottom: 'none',
              boxShadow: '0 0 30px rgba(100,180,255,0.2)',
              animation: 'luxuryFadeIn 2s ease-out 0.15s both',
            }}
          />
        </>
      )}

      {/* Main content container */}
      <div
        className="relative z-10 flex flex-col items-center justify-center h-full px-6 py-6"
        style={{
          animation: !prefersReducedMotion.current ? 'elegantFloat 6s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
        }}
      >
        {/* Signature line at top */}
        <div className="mb-2 relative">
          <svg
            width="320"
            height="28"
            viewBox="0 0 320 28"
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

            {/* Elegant curved path */}
            <path
              d="M 8 14 C 70 14, 100 8, 130 10 C 160 12, 190 16, 220 14 C 250 12, 280 8, 312 14"
              fill="none"
              stroke="url(#signatureGradient)"
              strokeWidth="1.8"
              strokeLinecap="round"
              filter="url(#signatureGlow)"
              style={{ opacity: 0.9 }}
            />

            {/* Center ornamental flourish */}
            <circle cx="160" cy="12" r="2.5" fill="#F5E6A3" style={{ filter: 'drop-shadow(0 0 8px rgba(245,230,163,0.8))' }}>
              {!prefersReducedMotion.current && (
                <animate attributeName="r" values="2.5;3.2;2.5" dur="2s" repeatCount="indefinite" />
              )}
            </circle>

            {/* Traveling light effect */}
            {!prefersReducedMotion.current && (
              <ellipse cx="0" cy="14" rx="25" ry="5" fill="rgba(245,230,163,0.12)">
                <animate attributeName="cx" from="-25" to="345" dur="8s" repeatCount="indefinite" />
              </ellipse>
            )}
          </svg>
        </div>

        {/* HOLD THE LINE */}
        <p
          className="text-[7px] font-extralight tracking-[0.3em] uppercase mb-1"
          style={{
            color: 'rgba(210,220,230,0.7)',
            textShadow: '0 1px 6px rgba(0,0,0,0.4)',
          }}
        >
          Hold The Line
        </p>

        {/* ERUDITE wordmark */}
        <h1
          className="text-5xl md:text-6xl font-semibold tracking-tight mb-1"
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
          className="text-[8px] font-light tracking-[0.28em] uppercase"
          style={{
            background: 'linear-gradient(135deg, #D4AF37 0%, #C9A961 50%, #E5C875 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 1px 6px rgba(212,175,55,0.35)',
          }}
        >
          Real Estate
        </p>
      </div>

      {/* Vignette overlay for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 80%, rgba(0,0,0,0.5) 100%)',
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
        @keyframes auroraShift {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        @keyframes meshFlow {
          0% { transform: translate(0, 0); }
          100% { transform: translate(40px, 40px); }
        }
        @keyframes orbFloat {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          25% { transform: translateY(-30px) translateX(15px); opacity: 0.5; }
          50% { transform: translateY(-20px) translateX(-10px); opacity: 0.4; }
          75% { transform: translateY(-35px) translateX(8px); opacity: 0.55; }
        }
        @keyframes ringPulse {
          0% { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
          50% { opacity: 0.5; }
          100% { transform: translate(-50%, -50%) scale(1.1); opacity: 0; }
        }
        @keyframes luxuryFadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes particleFloat {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.2; }
          20% { transform: translateY(-20px) translateX(8px); opacity: 0.35; }
          40% { transform: translateY(-12px) translateX(-6px); opacity: 0.25; }
          60% { transform: translateY(-25px) translateX(4px); opacity: 0.4; }
          80% { transform: translateY(-15px) translateX(-4px); opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}