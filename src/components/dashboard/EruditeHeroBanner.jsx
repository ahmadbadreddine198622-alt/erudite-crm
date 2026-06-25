import React, { useEffect, useRef, useState } from 'react';

/**
 * Erudite Hero Banner — Living Crest
 * Premium animated banner using the actual logo PNG with layered light effects
 */
export default function EruditeHeroBanner() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef(null);
  const logoRef = useRef(null);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setTimeout(() => setMounted(true), 100);
  }, []);

  // Particle system for gold dust-motes
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

    // Create rising dust particles
    const particleCount = 20;
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + Math.random() * 100,
        vx: (Math.random() - 0.5) * 0.2,
        vy: -Math.random() * 0.5 - 0.3,
        radius: Math.random() * 1.2 + 0.3,
        opacity: Math.random() * 0.5 + 0.1,
        maxOpacity: Math.random() * 0.5 + 0.2,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        // Fade in then out
        p.opacity = Math.min(p.maxOpacity, p.opacity + 0.003);

        // Reset when off top
        if (p.y < -20 || p.opacity <= 0) {
          p.y = canvas.height + 20;
          p.x = Math.random() * canvas.width;
          p.opacity = 0;
        }

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
      className="relative w-full overflow-visible"
      style={{
        height: '340px',
        background: 'transparent',
      }}
    >
      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ 
          opacity: reducedMotion ? 0 : 0.5,
          mixBlendMode: 'screen',
        }}
      />

      {/* Radial bloom behind wordmark */}
      {!reducedMotion && mounted && (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            width: '400px',
            height: '200px',
            background: 'radial-gradient(ellipse, rgba(201, 162, 75, 0.08) 0%, transparent 70%)',
            mixBlendMode: 'screen',
            animation: 'bloomPulse 4s ease-in-out infinite',
          }}
        />
      )}

      {/* Main logo container */}
      <div
        ref={logoRef}
        className="relative z-10 flex flex-col items-center justify-center h-full"
        style={{
          transform: mounted && !reducedMotion ? 'translateY(0)' : 'translateY(15px)',
          opacity: mounted ? 1 : 0,
          transition: reducedMotion 
            ? 'opacity 0.6s ease' 
            : 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.8s ease',
        }}
      >
        {/* Logo image */}
        <img
          src="https://media.base44.com/images/public/69cabceaeeb8bb5e3a62ead3/bf1477d7b_Viewrecentphotos.png"
          alt="Erudite Real Estate"
          className="max-w-full h-auto"
          style={{
            maxHeight: '280px',
            filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.3))',
          }}
        />

        {/* Specular sweep overlay for metallic glint */}
        {!reducedMotion && mounted && (
          <div
            className="absolute inset-0 pointer-events-none flex items-center justify-center"
            style={{
              background: 'linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.08) 50%, transparent 55%)',
              backgroundSize: '300% 100%',
              animation: 'specularSweep 7s ease-in-out infinite',
              mixBlendMode: 'overlay',
              clipPath: 'inset(20% 15% 25% 15%)',
            }}
          />
        )}
      </div>

      {/* Animated signature line (SVG overlay) */}
      <svg
        className="absolute left-1/2 top-[28%] -translate-x-1/2 pointer-events-none"
        width="320"
        height="60"
        viewBox="0 0 320 60"
        style={{
          opacity: mounted ? 1 : 0,
          transition: reducedMotion ? 'none' : 'opacity 0.6s ease 0.3s',
        }}
      >
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#C0C0C0" />
            <stop offset="50%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#E5C45A" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="walkerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFE59A" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Base line path (matches logo's stepped notch) */}
        <path
          id="linePath"
          d="M 40 30 L 145 30 L 145 26 L 175 26 L 175 30 L 280 30"
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{
            strokeDasharray: reducedMotion ? 'none' : '350',
            strokeDashoffset: reducedMotion ? '0' : (mounted ? '0' : '350'),
            transition: reducedMotion ? 'none' : 'stroke-dashoffset 2s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s',
            filter: 'url(#glow)',
          }}
        />

        {/* Traveling light pulse */}
        {!reducedMotion && mounted && (
          <>
            <rect width="50" height="5" x="0" y="27.5" fill="rgba(255,255,255,0.5)" rx="2.5" style={{ mixBlendMode: 'screen' }}>
              <animateMotion
                dur="5s"
                repeatCount="indefinite"
                path="M 40 30 L 145 30 L 145 28 L 175 28 L 175 30 L 280 30"
              />
            </rect>

            {/* Walker dot with glow */}
            <circle r="4" fill="url(#walkerGlow)" style={{ filter: 'url(#glow)' }}>
              <animateMotion
                dur="9s"
                repeatCount="indefinite"
                path="M 40 30 L 145 30 L 145 28 L 175 28 L 175 30 L 280 30"
                keyPoints="0; 0.43; 0.46; 0.54; 0.57; 1"
                keyTimes="0; 0.40; 0.45; 0.55; 0.60; 1"
                calcMode="spline"
                keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1"
              />
            </circle>
            <circle r="2" fill="#FFE59A">
              <animateMotion
                dur="9s"
                repeatCount="indefinite"
                path="M 40 30 L 145 30 L 145 28 L 175 28 L 175 30 L 280 30"
                keyPoints="0; 0.43; 0.46; 0.54; 0.57; 1"
                keyTimes="0; 0.40; 0.45; 0.55; 0.60; 1"
                calcMode="spline"
                keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1"
              />
            </circle>
          </>
        )}
      </svg>

      {/* CSS Animations */}
      <style>{`
        @keyframes bloomPulse {
          0%, 100% { 
            opacity: 0.5;
            transform: translate(-50%, -50%) scale(1);
          }
          50% { 
            opacity: 0.8;
            transform: translate(-50%, -50%) scale(1.08);
          }
        }
        @keyframes specularSweep {
          0% { background-position: 200% 0%; }
          45% { background-position: -180% 0%; }
          55% { background-position: -200% 0%; }
          100% { background-position: 200% 0%; }
        }
      `}</style>
    </div>
  );
}