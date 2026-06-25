import React, { useEffect, useRef, useState } from 'react';

/**
 * Erudite Hero Banner — Animated Logo Component
 * Premium, subtle motion: line draw, shimmer, walker dot, float, particles
 */
export default function EruditeHeroBanner() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setLoaded(true);
  }, []);

  // Particle background
  useEffect(() => {
    if (reducedMotion || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrame;
    let particles = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create particles
    const particleCount = 30;
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.4 + 0.1,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201, 162, 75, ${p.opacity})`;
        ctx.fill();
      });

      animationFrame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrame);
    };
  }, [reducedMotion]);

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        height: '320px',
        background: 'radial-gradient(ellipse at 50% 0%, #0B1F3A 0%, #0A1A30 40%, #061224 100%)',
      }}
    >
      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: reducedMotion ? 0 : 0.6 }}
      />

      {/* Main logo container with subtle float */}
      <div
        className="relative z-10 flex flex-col items-center justify-center h-full"
        style={{
          transform: loaded && !reducedMotion ? 'translateY(0)' : 'translateY(10px)',
          transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
          animation: reducedMotion ? 'none' : 'float 5s ease-in-out infinite',
        }}
      >
        {/* Top line with stepped notch */}
        <svg
          width="280"
          height="40"
          viewBox="0 0 280 40"
          className="mb-2"
          style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.6s ease 0.2s' }}
        >
          <defs>
            {/* Silver to gold gradient */}
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E8E8E8" />
              <stop offset="45%" stopColor="#C9A24B" />
              <stop offset="100%" stopColor="#D4AF37" />
            </linearGradient>
            {/* Glow filter */}
            <filter id="lineGlow">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Main line with stepped notch */}
          <path
            d="M 20 20 L 130 20 L 130 16 L 150 16 L 150 20 L 260 20"
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="2"
            strokeLinecap="round"
            style={{
              strokeDasharray: reducedMotion ? 'none' : '300',
              strokeDashoffset: reducedMotion ? '0' : (loaded ? '0' : '300'),
              transition: reducedMotion ? 'none' : 'stroke-dashoffset 1.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s',
              filter: 'url(#lineGlow)',
            }}
          />

          {/* Shimmer effect traveling along line */}
          {!reducedMotion && loaded && (
            <rect width="40" height="4" x="0" y="18" fill="rgba(255,255,255,0.4)" rx="2">
              <animateMotion
                dur="5s"
                repeatCount="indefinite"
                path="M 20 20 L 130 20 L 130 18 L 150 18 L 150 20 L 260 20"
              />
            </rect>
          )}

          {/* Walker dot */}
          {!reducedMotion && loaded && (
            <circle r="3" fill="#C9A24B" style={{ filter: 'url(#lineGlow)' }}>
              <animateMotion
                dur="8s"
                repeatCount="indefinite"
                path="M 20 20 L 130 20 L 130 18 L 150 18 L 150 20 L 260 20"
                keyPoints="0; 0.45; 0.48; 0.52; 0.55; 1"
                keyTimes="0; 0.42; 0.45; 0.55; 0.58; 1"
                calcMode="spline"
                keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1"
              />
            </circle>
          )}
        </svg>

        {/* ERUDITE TEAM */}
        <span
          className="text-xs font-light tracking-[0.3em] uppercase mb-1"
          style={{
            color: '#D0D0D0',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.6s ease 0.4s',
          }}
        >
          Erudite Team
        </span>

        {/* ERUDITE wordmark with metallic gradient */}
        <div
          className="relative"
          style={{
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.6s ease 0.5s',
          }}
        >
          <span
            className="text-6xl font-serif font-semibold"
            style={{
              fontFamily: "'Playfair Display', 'Cormorant Garamond', serif",
              background: 'linear-gradient(135deg, #E8E8E8 0%, #C9A24B 45%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.02em',
            }}
          >
            ERUDITE
          </span>

          {/* Shimmer sweep overlay */}
          {!reducedMotion && loaded && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmerSweep 6s ease-in-out infinite',
                mixBlendMode: 'overlay',
              }}
            />
          )}
        </div>

        {/* REAL ESTATE */}
        <span
          className="text-xs font-medium tracking-[0.25em] uppercase mt-2"
          style={{
            color: '#C9A24B',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.6s ease 0.6s',
          }}
        >
          REAL ESTATE
        </span>

        {/* Divider with center notch */}
        <div
          className="relative w-32 h-px mt-3 mb-3"
          style={{
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.6s ease 0.7s',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, #C9A24B 20%, #C9A24B 80%, transparent 100%)',
            }}
          />
          {/* Center notch */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-3"
            style={{ background: '#C9A24B' }}
          />
        </div>

        {/* HOLD THE LINE */}
        <span
          className="text-xs font-light tracking-[0.2em] uppercase"
          style={{
            color: '#D0D0D0',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.6s ease 0.8s',
          }}
        >
          HOLD THE LINE
        </span>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes shimmerSweep {
          0% { background-position: 200% 0%; }
          50% { background-position: -200% 0%; }
          100% { background-position: 200% 0%; }
        }
      `}</style>
    </div>
  );
}