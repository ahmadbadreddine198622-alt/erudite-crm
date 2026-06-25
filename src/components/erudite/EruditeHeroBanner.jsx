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
      className="relative w-full overflow-hidden rounded-2xl mb-6"
      style={{
        minHeight: 110,
        maxHeight: 130,
        background: 'radial-gradient(ellipse at 50% -30%, rgba(15,25,45,0.35) 0%, rgba(8,15,30,0.42) 50%, rgba(5,10,20,0.5) 100%)',
        backdropFilter: 'blur(24px) saturate(200%)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
        border: '1px solid rgba(201,162,75,0.18)',
        transform: !prefersReducedMotion.current ? `perspective(800px) rotateX(${mousePos.y * 0.3}deg) rotateY(${mousePos.x * 0.3}deg)` : 'none',
        transition: 'transform 0.1s ease-out',
      }}
    >
      {/* Animated aurora borealis - ultra subtle */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 25% 40%, rgba(212,175,55,0.06) 0%, transparent 60%),
            radial-gradient(ellipse at 75% 30%, rgba(100,150,255,0.05) 0%, transparent 55%),
            radial-gradient(ellipse at 50% 90%, rgba(180,100,255,0.04) 0%, transparent 60%)
          `,
          animation: !prefersReducedMotion.current ? 'auroraShift 18s ease-in-out infinite' : 'none',
          filter: 'blur(50px)',
        }}
      />

      {/* Holographic mesh - barely visible */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            repeating-linear-gradient(45deg, rgba(212,175,55,0.015) 0px, rgba(212,175,55,0.015) 1px, transparent 1px, transparent 32px),
            repeating-linear-gradient(-45deg, rgba(100,150,255,0.015) 0px, rgba(100,150,255,0.015) 1px, transparent 1px, transparent 32px)
          `,
          animation: !prefersReducedMotion.current ? 'meshFlow 25s linear infinite' : 'none',
        }}
      />

      {/* Micro particles - subtle */}
      {!prefersReducedMotion.current && particles.slice(0, 12).map((p) => {
        const colors = ['rgba(212,175,55,', 'rgba(100,180,255,', 'rgba(180,100,255,'];
        const color = colors[p.layer % 3];
        return (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              background: `radial-gradient(circle, ${color}${p.opacity * 0.5}) 0%, transparent 70%)`,
              boxShadow: `0 0 ${p.size * 4}px ${color}${p.opacity * 0.4})`,
              animation: `orbFloat ${p.duration * 0.8}s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        );
      })}

      {/* Minimal corner accents */}
      {!prefersReducedMotion.current && (
        <>
          <div
            className="absolute top-2 left-2 w-8 h-8"
            style={{
              border: '1px solid rgba(201,162,75,0.15)',
              borderRight: 'none',
              borderBottom: 'none',
              borderRadius: '6px 0 0 0',
              animation: 'luxuryFadeIn 2.5s ease-out',
            }}
          />
          <div
            className="absolute top-2 right-2 w-8 h-8"
            style={{
              border: '1px solid rgba(100,180,255,0.15)',
              borderLeft: 'none',
              borderBottom: 'none',
              borderRadius: '0 6px 0 0',
              animation: 'luxuryFadeIn 2.5s ease-out 0.2s both',
            }}
          />
        </>
      )}

      {/* Main content - compact layout */}
      <div
        className="relative z-10 flex flex-col items-center justify-center h-full px-4 py-3"
        style={{
          animation: !prefersReducedMotion.current ? 'elegantFloat 5s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
        }}
      >
        {/* Signature line - minimalist */}
        <div className="mb-1.5 relative">
          <svg
            width="200"
            height="20"
            viewBox="0 0 200 20"
            style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.3))' }}
          >
            <defs>
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
              <filter id="signatureGlow">
                <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <path
              d="M 5 10 C 40 10, 55 7, 70 8 C 85 9, 100 11, 115 10 C 130 9, 145 7, 195 10"
              fill="none"
              stroke="url(#signatureGradient)"
              strokeWidth="1.5"
              strokeLinecap="round"
              filter="url(#signatureGlow)"
              style={{ opacity: 0.85 }}
            />

            <circle cx="100" cy="9" r="2" fill="#F5E6A3" style={{ filter: 'drop-shadow(0 0 5px rgba(245,230,163,0.7))' }}>
              {!prefersReducedMotion.current && (
                <animate attributeName="r" values="2;2.6;2" dur="2.5s" repeatCount="indefinite" />
              )}
            </circle>

            {!prefersReducedMotion.current && (
              <ellipse cx="0" cy="10" rx="18" ry="4" fill="rgba(245,230,163,0.08)">
                <animate attributeName="cx" from="-18" to="218" dur="10s" repeatCount="indefinite" />
              </ellipse>
            )}
          </svg>
        </div>

        {/* ERUDITE wordmark - prominent */}
        <h1
          className="text-4xl md:text-5xl font-bold tracking-tight mb-0.5"
          style={{
            fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
            background: 'linear-gradient(180deg, #FFFFFF 0%, #F5F5F5 10%, #D8D8D8 22%, #D4AF37 52%, #C9A961 72%, #E5C875 100%)',
            backgroundSize: '100% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.5))',
            animation: !prefersReducedMotion.current ? 'metallicFlow 7s ease-in-out infinite' : 'none',
          }}
        >
          ERUDITE
        </h1>

        {/* REAL ESTATE - subtle */}
        <p
          className="text-[7px] font-light tracking-[0.25em] uppercase"
          style={{
            background: 'linear-gradient(135deg, #D4AF37 0%, #C9A961 50%, #E5C875 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 1px 4px rgba(212,175,55,0.3)',
          }}
        >
          Real Estate
        </p>
      </div>

      {/* Ultra-subtle vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.25) 75%, rgba(0,0,0,0.4) 100%)',
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