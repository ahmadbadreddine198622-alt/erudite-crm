import React, { useEffect, useRef, useState } from 'react';

/**
 * ERUDITE Hero Banner V5 — Premium Motion Design
 * Fully transparent container with animated logo, light sweep, particle effects, and walker line animation.
 */
export default function EruditeHeroBanner() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  const [lineProgress, setLineProgress] = useState(0);
  const [showWordmark, setShowWordmark] = useState(false);
  const [showTaglines, setShowTaglines] = useState(false);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const timeRef = useRef(0);

  useEffect(() => {
    setMounted(true);

    // Entrance animation sequence
    const lineTimer = setTimeout(() => setLineProgress(1), 100);
    const wordmarkTimer = setTimeout(() => setShowWordmark(true), 800);
    const taglinesTimer = setTimeout(() => setShowTaglines(true), 1400);

    // Initialize particle system (gold dust motes)
    particlesRef.current = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: 100 + Math.random() * 50,
      size: Math.random() * 2 + 1,
      speedY: (Math.random() * 0.3 + 0.2) * -1,
      opacity: Math.random() * 0.5 + 0.2,
      hue: 45,
    }));

    // Mouse parallax tracking
    const handleMouseMove = (e) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePos({
          x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
          y: ((e.clientY - rect.top) / rect.height - 0.5) * 2,
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Canvas animation loop
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      let animationFrameId;

      const resizeCanvas = () => {
        const dpr = window.devicePixelRatio || 1;
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          canvas.style.width = `${rect.width}px`;
          canvas.style.height = `${rect.height}px`;
          ctx.scale(dpr, dpr);
        }
      };

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      const animate = () => {
        timeRef.current += 0.016;
        const rect = containerRef.current?.getBoundingClientRect();
        const width = rect?.width || 800;
        const height = rect?.height || 140;

        ctx.clearRect(0, 0, width, height);

        // Subtle radial bloom behind wordmark (breathing)
        const bloomAlpha = 0.04 + 0.02 * Math.sin(timeRef.current * 0.5);
        const bloomGradient = ctx.createRadialGradient(
          width * 0.5,
          height * 0.5,
          0,
          width * 0.5,
          height * 0.5,
          width * 0.6
        );
        bloomGradient.addColorStop(0, `rgba(212, 175, 55, ${bloomAlpha})`);
        bloomGradient.addColorStop(1, 'rgba(212, 175, 55, 0)');
        ctx.fillStyle = bloomGradient;
        ctx.fillRect(0, 0, width, height);

        // Canvas decorative line removed - using HTML/CSS line instead for better rendering

        // Gold dust motes drifting upward
        particlesRef.current.forEach((p) => {
          p.y += p.speedY;
          p.x += Math.sin(timeRef.current * 0.5 + p.id) * 0.2;

          if (p.y < -10) {
            p.y = height + 10;
            p.x = Math.random() * width;
          }

          const screenX = (p.x / 100) * width;
          const screenY = (p.y / 100) * height;

          const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, p.size * 3);
          gradient.addColorStop(0, `rgba(212, 175, 55, ${p.opacity})`);
          gradient.addColorStop(1, 'rgba(212, 175, 55, 0)');

          ctx.beginPath();
          ctx.arc(screenX, screenY, p.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        });

        // Metallic light sweep across wordmark (every ~7s)
        const sweepCycle = (timeRef.current * 0.14) % 1;
        if (sweepCycle > 0.3 && sweepCycle < 0.7) {
          const sweepX = width * ((sweepCycle - 0.3) / 0.4);
          const sweepGradient = ctx.createLinearGradient(sweepX - 100, 0, sweepX + 100, 0);
          sweepGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
          sweepGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
          sweepGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = sweepGradient;
          ctx.fillRect(sweepX - 100, 0, 200, height);
          ctx.restore();
        }

        animationFrameId = requestAnimationFrame(animate);
      };

      animate();

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('resize', resizeCanvas);
        clearTimeout(lineTimer);
        clearTimeout(wordmarkTimer);
        clearTimeout(taglinesTimer);
        cancelAnimationFrame(animationFrameId);
      };
    }
  }, []);

  if (!mounted) return null;

  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{
        minHeight: 140,
        maxHeight: 180,
        background: 'transparent',
        backdropFilter: 'none',
        boxShadow: 'none',
        border: 'none',
        transform: `perspective(1000px) rotateX(${mousePos.y * 0.15}deg) rotateY(${mousePos.x * 0.15}deg)`,
        transition: 'transform 0.12s ease-out',
        position: 'relative',
      }}
    >
      {/* Canvas for motion effects */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 1 }}
      />

      {/* Logo and content container */}
      <div
        className="relative z-10 flex flex-col items-center justify-center h-full px-4"
        style={{
          transformStyle: 'preserve-3d',
        }}
      >
        {/* ERUDITE wordmark PNG - fully visible, centered */}
        <div
          className={`relative transition-all duration-1000 ease-out ${showWordmark ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
        >
          <h1
            className="text-6xl md:text-7xl lg:text-8xl font-medium tracking-wide"
            style={{
              fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
              background: 'linear-gradient(180deg, #FFFFFF 0%, #F0F0F0 15%, #D4AF37 48%, #C9A961 72%, #E5C875 100%)',
              backgroundSize: '100% 200%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 4px 16px rgba(212,175,55,0.3))',
              letterSpacing: '0.05em',
            }}
          >
            ERUDITE
          </h1>
        </div>

        {/* REAL ESTATE — elegant subtitle */}
        <p
          className={`text-sm md:text-base font-light tracking-[0.35em] uppercase transition-all duration-1000 delay-500 ${showTaglines ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
          style={{
            color: 'rgba(255,255,255,0.7)',
            textShadow: '0 1px 6px rgba(0,0,0,0.5)',
          }}
        >
          Real Estate
        </p>

        {/* Elegant decorative line with subtle gradient - positioned BELOW Real Estate */}
        <div
          className={`relative transition-opacity duration-1000 delay-700 ${lineProgress > 0 ? 'opacity-100' : 'opacity-0'}`}
          style={{
            width: 420,
            marginTop: 14,
          }}
        >
          <div
            className="relative w-full h-1 rounded-full overflow-hidden"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.25) 10%, rgba(212,175,55,0.45) 25%, rgba(180,200,220,0.35) 50%, rgba(212,175,55,0.45) 75%, rgba(212,175,55,0.25) 90%, transparent 100%)',
              boxShadow: '0 0 16px rgba(212,175,55,0.2), 0 0 32px rgba(180,200,220,0.15), inset 0 0 8px rgba(255,255,255,0.1)',
            }}
          >
            {/* Animated shimmer effect - slow, elegant */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                backgroundSize: '220% 100%',
                animation: 'shimmerSlide 6s ease-in-out infinite',
              }}
            />
            {/* Subtle particle glow underneath */}
            <div
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2/3 h-2 rounded-full blur-md"
              style={{
                background: 'radial-gradient(ellipse, rgba(212,175,55,0.3) 0%, rgba(180,200,220,0.25) 50%, rgba(212,175,55,0.3) 100%)',
                filter: 'blur(8px)',
                opacity: 0.5,
              }}
            />
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes metallicFlow {
          0%, 100% { background-position: 0% 0%; }
          50% { background-position: 0% 100%; }
          100% { background-position: 0% 0%; }
        }
        @keyframes shimmerGlow {
          0%, 100% { filter: drop-shadow(0 6px 24px rgba(212,175,55,0.35)) drop-shadow(0 0 8px rgba(255,255,255,0.2)); }
          50% { filter: drop-shadow(0 8px 32px rgba(212,175,55,0.5)) drop-shadow(0 0 16px rgba(255,255,255,0.4)); }
        }
        @keyframes shimmerSlide {
          0% { background-position: 200% 0%; }
          50% { background-position: -200% 0%; }
          100% { background-position: 200% 0%; }
        }
        @keyframes energyRingRotate {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes particleFloat {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          25% { transform: translateY(-30px) translateX(15px); opacity: 0.5; }
          50% { transform: translateY(-20px) translateX(-10px); opacity: 0.4; }
          75% { transform: translateY(-35px) translateX(8px); opacity: 0.55; }
        }
        @keyframes linePulse {
          0% { left: -60px; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { left: 160px; opacity: 0; }
        }
        @keyframes linePulseReverse {
          0% { left: 160px; opacity: 0; }
          30% { opacity: 0.5; }
          70% { opacity: 0.5; }
          100% { left: -40px; opacity: 0; }
        }
      `}</style>
    </div>
  );
}