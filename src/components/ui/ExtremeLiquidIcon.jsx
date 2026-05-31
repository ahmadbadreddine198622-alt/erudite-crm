/**
 * ExtremeLiquidIcon — luxury frosted-crystal tile.
 * Jewel-tone inner glow: deep, muted luminescence like light within a cut stone.
 * NOT surface color — NOT candy gradients.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function ExtremeLiquidIcon({
  icon: Icon,
  gradient = 'from-slate-700 to-slate-900',
  glowColor = 'rgba(255,255,255,0.15)',
  size = 62,
  iconSize,
  active = false,
  badge = 0,
  onClick,
  index = 0,
  isDragging = false,
  tiltX = 0,
  tiltY = 0,
}) {
  const [pressed, setPressed] = useState(false);
  const [entered, setEntered] = useState(false);
  const timerRef = useRef(null);

  const glyphSize = iconSize ?? Math.round(size * 0.38);
  const radius = `${Math.round(size * 0.22)}px`;

  useEffect(() => {
    timerRef.current = setTimeout(() => setEntered(true), prefersReducedMotion ? 0 : index * 55);
    return () => clearTimeout(timerRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePressStart = useCallback(() => {
    if (!active) setPressed(true);
  }, [active]);

  const handlePressEnd = useCallback(() => {
    setTimeout(() => setPressed(false), 180);
  }, []);

  // Slow, barely-perceptible specular drift
  const specX = prefersReducedMotion ? 30 : 30 + tiltX * 20;
  const specY = prefersReducedMotion ? 18 : 18 + tiltY * 14;

  const entranceStyle = prefersReducedMotion
    ? { opacity: 1, transform: 'translateY(0)' }
    : {
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0)' : 'translateY(10px)',
        filter: entered ? 'blur(0)' : 'blur(4px)',
        transition: `opacity 0.6s ease ${index * 0.05}s, transform 0.6s cubic-bezier(0.22, 0.61, 0.36, 1) ${index * 0.05}s, filter 0.5s ease ${index * 0.05}s`,
      };

  return (
    <div
      className={cn(
        'relative select-none',
        active ? 'cursor-grab' : 'cursor-pointer',
        isDragging && 'opacity-70',
        !active && !isDragging && 'hover:scale-[1.02]'
      )}
      style={{
        transition: 'transform 0.18s ease',
        ...entranceStyle,
      }}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onClick={!active ? onClick : undefined}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          position: 'relative',
          transform: pressed ? 'scale(0.97)' : 'scale(1)',
          transition: 'transform 0.22s cubic-bezier(0.22, 0.61, 0.36, 1)',
        }}
      >
        {/* Vibrant jewel base — saturated, lit from within */}
        <div
          className={cn('absolute inset-0 bg-gradient-to-br opacity-90', gradient)}
          style={{
            borderRadius: radius,
            filter: 'saturate(1.1) brightness(0.78)',
          }}
        />

        {/* Frosted crystal shell with colored glow */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: pressed
              ? 'rgba(255,255,255,0.13)'
              : active
              ? 'rgba(255,255,255,0.10)'
              : 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1.5px solid rgba(255,255,255,0.18)',
            borderTopColor: 'rgba(255,255,255,0.42)',
            boxShadow: pressed
              ? `0 3px 10px rgba(0,0,0,0.35), 0 0 0 0 ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.18)`
              : `0 8px 28px rgba(0,0,0,0.4), 0 0 22px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.14)`,
            transition: 'background 0.18s ease, box-shadow 0.18s ease',
          }}
        />

        {/* Fine polished bevel rim */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.36) 0%, rgba(255,255,255,0) 48%)',
            pointerEvents: 'none',
          }}
        />

        {/* Slow-drift specular sheen — barely alive, like light over crystal */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ borderRadius: radius, pointerEvents: 'none' }}
        >
          <div
            style={{
              position: 'absolute',
              width: '80%',
              height: '50%',
              top: `${specY}%`,
              left: `${specX - 20}%`,
              background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 75%)',
              transition: prefersReducedMotion ? 'none' : 'top 0.6s ease, left 0.6s ease',
              pointerEvents: 'none',
              filter: 'blur(2px)',
            }}
          />
        </div>

        {/* Whisper of inner depth */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            boxShadow: 'inset 0 2px 8px rgba(255,255,255,0.04), inset 0 -3px 8px rgba(0,0,0,0.18)',
            pointerEvents: 'none',
          }}
        />

        {/* Press bloom — soft light at touch point */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: pressed ? 'rgba(255,255,255,0.07)' : 'transparent',
            transition: 'background 0.18s ease',
            pointerEvents: 'none',
          }}
        />

        {/* Glyph — crisp soft off-white, never harsh */}
        <Icon
          className="absolute"
          style={{
            width: glyphSize,
            height: glyphSize,
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) ${pressed ? 'scale(0.95)' : 'scale(1)'}`,
            color: 'rgba(255, 255, 255, 0.90)',
            filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.6))',
            zIndex: 2,
            transition: 'transform 0.15s ease',
          }}
        />

        {/* Badge — high contrast, elegant */}
        {badge > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white flex items-center justify-center font-semibold shadow-xl z-10"
            style={{ fontSize: 10, lineHeight: 1.1, border: '1.5px solid rgba(10,14,23,0.6)' }}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
    </div>
  );
}