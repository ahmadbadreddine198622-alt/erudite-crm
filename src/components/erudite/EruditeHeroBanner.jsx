import React, { useEffect, useRef, useState } from 'react';

/**
 * ERUDITE Hero Identity V4 — The Future of Luxury Software
 * A living, breathing brand experience that feels like stepping into the Burj Al Arab
 */
export default function EruditeHeroBanner() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const timeRef = useRef(0);

  useEffect(() => {
    setMounted(true);

    // Initialize particle system
    particlesRef.current = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      z: Math.random() * 0.5 + 0.5,
      size: Math.random() * 1.5 + 0.5,
      speedX: (Math.random() - 0.5) * 0.02,
      speedY: (Math.random() - 0.5) * 0.02,
      opacity: Math.random() * 0.4 + 0.1,
      hue: Math.random() > 0.7 ? 45 : Math.random() > 0.5 ? 200 : 280,
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
        timeRef.current += 0.008;
        const rect = containerRef.current?.getBoundingClientRect();
        const width = rect?.width || 800;
        const height = rect?.height || 280;

        ctx.clearRect(0, 0, width, height);

        // Update and draw particles
        particlesRef.current.forEach((p) => {
          p.x += p.speedX;
          p.y += p.speedY;

          // Wrap around
          if (p.x < 0) p.x = 100;
          if (p.x > 100) p.x = 0;
          if (p.y < 0) p.y = 100;
          if (p.y > 100) p.y = 0;

          const screenX = (p.x / 100) * width;
          const screenY = (p.y / 100) * height;
          const parallaxX = mousePos.x * 20 * p.z;
          const parallaxY = mousePos.y * 20 * p.z;

          // Draw particle with glow
          const gradient = ctx.createRadialGradient(
            screenX + parallaxX,
            screenY + parallaxY,
            0,
            screenX + parallaxX,
            screenY + parallaxY,
            p.size * 4
          );

          const alpha = p.opacity * (0.5 + 0.5 * Math.sin(timeRef.current * 2 + p.id));
          gradient.addColorStop(0, `hsla(${p.hue}, 70%, 60%, ${alpha})`);
          gradient.addColorStop(1, `hsla(${p.hue}, 70%, 60%, 0)`);

          ctx.beginPath();
          ctx.arc(screenX + parallaxX, screenY + parallaxY, p.size * 4, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        });

        // Draw architectural grid lines
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.03)';
        ctx.lineWidth = 0.5;

        // Vertical grid lines with subtle wave
        for (let x = 0; x < width; x += 60) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }

        // Horizontal grid lines
        for (let y = 0; y < height; y += 60) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        // Draw energy ribbon flowing across
        const ribbonY = height * 0.3 + Math.sin(timeRef.current) * 20;
        const ribbonGradient = ctx.createLinearGradient(0, ribbonY, width, ribbonY);
        ribbonGradient.addColorStop(0, 'rgba(212, 175, 55, 0)');
        ribbonGradient.addColorStop(0.5, 'rgba(212, 175, 55, 0.08)');
        ribbonGradient.addColorStop(1, 'rgba(212, 175, 55, 0)');

        ctx.beginPath();
        ctx.moveTo(0, ribbonY);
        for (let x = 0; x <= width; x += 50) {
          const wave = Math.sin(x * 0.01 + timeRef.current * 2) * 15;
          ctx.lineTo(x, ribbonY + wave);
        }
        ctx.strokeStyle = ribbonGradient;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw concentric architectural circles
        const centerX = width * 0.5;
        const centerY = height * 0.5;
        for (let r = 100; r < 400; r += 80) {
          const alpha = 0.02 * (1 - r / 400);
          ctx.beginPath();
          ctx.arc(centerX, centerY, r + Math.sin(timeRef.current + r * 0.01) * 5, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(212, 175, 55, ${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }

        animationFrameId = requestAnimationFrame(animate);
      };

      animate();

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('resize', resizeCanvas);
        cancelAnimationFrame(animationFrameId);
      };
    }
  }, []);

  if (!mounted) return null;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-2xl mb-6"
      style={{
        minHeight: 100,
        maxHeight: 120,
        background: 'transparent',
        backdropFilter: 'none',
        boxShadow: 'none',
        border: 'none',
        transform: `perspective(1000px) rotateX(${mousePos.y * 0.25}deg) rotateY(${mousePos.x * 0.25}deg)`,
        transition: 'transform 0.12s ease-out',
        position: 'relative',
      }}
    >
      {/* Canvas layer for particles and subtle effects */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ pointerEvents: 'none', opacity: 0.3 }}
      />

      {/* Ultra-subtle atmospheric haze */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 35% 50%, rgba(100,140,200,0.008) 0%, transparent 55%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Minimal glass reflections */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.008) 0%, transparent 50%, rgba(255,255,255,0.004) 100%)',
        }}
      />

      {/* Main content — refined logo */}
      <div
        className="relative z-10 flex flex-col items-center justify-center h-full px-4 py-3"
        style={{
          transformStyle: 'preserve-3d',
        }}
      >
        {/* ERUDITE wordmark — larger and more prominent */}
        <div className="relative mb-1.5">
          <h1
            className="text-5xl md:text-6xl lg:text-7xl font-medium tracking-wide"
            style={{
              fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
              background: 'linear-gradient(180deg, #FFFFFF 0%, #F0F0F0 15%, #D4AF37 48%, #C9A961 72%, #E5C875 100%)',
              backgroundSize: '100% 200%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 4px 16px rgba(212,175,55,0.25))',
              animation: 'metallicBreath 10s ease-in-out infinite',
              letterSpacing: '0.05em',
            }}
          >
            ERUDITE
          </h1>
        </div>

        {/* REAL ESTATE — elegant subtitle */}
        <p
          className="text-[10px] md:text-[11px] font-light tracking-[0.35em] uppercase"
          style={{
            color: 'rgba(255,255,255,0.6)',
            textShadow: '0 1px 6px rgba(0,0,0,0.5)',
          }}
        >
          Real Estate
        </p>

        {/* Minimal energy arc — signature element */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            width: 380,
            height: 380,
            border: '1px solid rgba(212,175,55,0.04)',
            borderRadius: '50%',
            animation: 'energyRingRotate 50s linear infinite',
          }}
        >
          {/* Single top accent mark */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-10"
            style={{
              background: 'linear-gradient(180deg, rgba(212,175,55,0.2) 0%, transparent 100%)',
            }}
          />
        </div>
      </div>

      {/* Subtle vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.12) 75%, rgba(0,0,0,0.18) 100%)',
        }}
      />

      {/* CSS Animations */}
      <style>{`
        @keyframes metallicBreath {
          0%, 100% { background-position: 0% 0%; filter: drop-shadow(0 8px 32px rgba(212,175,55,0.35)); }
          50% { background-position: 0% 100%; filter: drop-shadow(0 12px 48px rgba(212,175,55,0.5)); }
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
      `}</style>
    </div>
  );
}