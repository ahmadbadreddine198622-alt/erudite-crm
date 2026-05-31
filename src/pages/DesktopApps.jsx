import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ALL_APPS } from '@/lib/navApps';
import ExtremeLiquidIcon from '@/components/ui/ExtremeLiquidIcon';
import ClaudePresenceIcon from '@/components/ui/ClaudePresenceIcon';
import { format } from 'date-fns';

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function DesktopApps() {
  const navigate = useNavigate();
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // Pointer / orientation tracking for tilt specular
  useEffect(() => {
    if (prefersReducedMotion) return;
    let rafId;
    const handlePointer = (e) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const nx = (e.clientX / window.innerWidth - 0.5) * 2;
        const ny = (e.clientY / window.innerHeight - 0.5) * 2;
        setTilt({ x: nx, y: ny });
      });
    };
    const handleOrientation = (e) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setTilt({
          x: Math.max(-1, Math.min(1, (e.gamma || 0) / 30)),
          y: Math.max(-1, Math.min(1, (e.beta  || 0) / 40 - 0.3)),
        });
      });
    };
    window.addEventListener('pointermove', handlePointer, { passive: true });
    window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointer);
      window.removeEventListener('deviceorientation', handleOrientation);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center px-6 py-8"
      style={{
        background: 'radial-gradient(ellipse at 20% 20%, #1a2a4a 0%, #0F1419 45%, #121821 100%)',
      }}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <p className="text-4xl font-light tracking-tight mb-2" style={{ color: 'rgba(255,255,255,0.92)' }}>
          {format(new Date(), 'h:mm')}
          <span className="text-xl ml-1" style={{ color: 'hsl(38 92% 50%)' }}>{format(new Date(), 'a')}</span>
        </p>
        <p className="text-sm font-medium" style={{ color: 'hsl(38 92% 50%)' }}>
          {format(new Date(), 'EEEE, MMMM d')}
        </p>
      </div>

      {/* Claude Presence */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <ClaudePresenceIcon size={56} active={false} thinking={false} />
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'hsl(38 92% 50%)' }}>
            PropCRM Desktop
          </p>
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
            All your apps in one place
          </p>
        </div>
      </div>

      {/* App Grid */}
      <div className="w-full">
        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(7, 1fr)', maxWidth: '900px', margin: '0 auto' }}>
          {ALL_APPS.map((app, idx) => {
            const Icon = app.icon;
            return (
              <motion.button
                key={app.path || app.label}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  app.href ? window.open(app.href, '_blank') : navigate(app.path);
                }}
                className="flex flex-col items-center gap-1.5 select-none focus:outline-none"
              >
                <ExtremeLiquidIcon
                  icon={Icon}
                  gradient={app.gradient}
                  glowColor={app.glowColor}
                  tiltX={tilt.x}
                  tiltY={tilt.y}
                  index={idx}
                  isDragging={false}
                  active={false}
                  badge={0}
                />
                <span className="text-[8px] text-center leading-tight max-w-[56px] font-medium text-white/70 min-h-[2rem] flex items-start justify-center">
                  {app.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Back to Dashboard */}
      <div className="mt-12">
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.95)',
          }}
          onMouseEnter={(e) => {
            e.target.style.borderColor = 'hsl(38 92% 50%)';
            e.target.style.background = 'rgba(255,255,255,0.1)';
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = 'rgba(255,255,255,0.12)';
            e.target.style.background = 'rgba(255,255,255,0.07)';
          }}
        >
          ← Back to My Dashboard
        </button>
      </div>
    </div>
  );
}