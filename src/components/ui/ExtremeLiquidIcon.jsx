/**
 * ExtremeLiquidIcon — living glass tile with:
 * - Tilt-responsive specular highlight (pointer on desktop, deviceorientation on mobile)
 * - Staggered cascade entrance (blur-in + rise + fade, once per mount)
 * - Wet-glass tactile press (scale + brightness flash)
 * - prefers-reduced-motion safe
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function ExtremeLiquidIcon({
  icon: Icon,
  gradient = 'from-slate-500 to-slate-700',
  size = 62,
  iconSize,
  active = false,
  badge = 0,
  onClick,
  index = 0,
  isDragging = false,
  // tiltX/tiltY: normalized -1..1 from parent (pointer or orientation)
  tiltX = 0,
  tiltY = 0,
}) {
  const [pressed, setPressed] = useState(false);
  const [entered, setEntered] = useState(false);
  const timerRef = useRef(null);

  const glyphSize = iconSize ?? Math.round(size * 0.38);
  const radius = `${Math.round(size * 0.22)}px`;

  // Staggered entrance
  useEffect(() => {
    timerRef.current = setTimeout(() => setEntered(true), prefersReducedMotion ? 0 : index * 38);
    return () => clearTimeout(timerRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePressStart = useCallback(() => {
    if (!active) setPressed(true);
  }, [active]);

  const handlePressEnd = useCallback(() => {
    setTimeout(() => setPressed(false), 160);
  }, []);

  // Specular position driven by tilt (0 = top-left, shifts with tilt)
  const specX = prefersReducedMotion ? 30 : 30 + tiltX * 35;
  const specY = prefersReducedMotion ? 15 : 15 + tiltY * 25;

  const entranceStyle = prefersReducedMotion
    ? { opacity: 1, transform: 'translateY(0)' }
    : {
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0px)' : 'translateY(14px)',
        filter: entered ? 'blur(0px)' : 'blur(6px)',
        transition: `opacity 0.4s ease ${index * 0.035}s, transform 0.4s cubic-bezier(0.34, 1.4, 0.64, 1) ${index * 0.035}s, filter 0.35s ease ${index * 0.035}s`,
      };

  return (
    <div
      className={cn(
        'relative select-none',
        active ? 'animate-wiggle cursor-grab' : 'cursor-pointer',
        isDragging && 'opacity-80',
        !active && !isDragging && 'hover:scale-105'
      )}
      style={{
        transition: 'transform 0.15s ease',
        ...entranceStyle,
      }}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
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
          transform: pressed ? 'scale(0.93)' : 'scale(1)',
          transition: 'transform 0.12s cubic-bezier(0.34, 1.5, 0.64, 1)',
        }}
      >
        {/* Gradient base — inner luminescence, not opaque block */}
        <div
          className={cn('absolute inset-0 bg-gradient-to-br opacity-55', gradient)}
          style={{ borderRadius: radius }}
        />

        {/* Ultra-frosted glass shell */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: pressed
              ? 'rgba(255,255,255,0.2)'
              : active
              ? 'rgba(255,255,255,0.13)'
              : 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(28px) saturate(200%)',
            WebkitBackdropFilter: 'blur(28px) saturate(200%)',
            border: '1px solid rgba(255,255,255,0.22)',
            borderTopColor: 'rgba(255,255,255,0.38)',
            boxShadow: pressed
              ? '0 4px 18px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.25)'
              : '0 10px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.16)',
            transition: 'background 0.15s ease, box-shadow 0.15s ease',
          }}
        />

        {/* Tilt-driven specular highlight — feels like light catching real glass */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ borderRadius: radius, pointerEvents: 'none' }}
        >
          <div
            style={{
              position: 'absolute',
              width: '90%',
              height: '60%',
              top: `${specY}%`,
              left: `${specX - 25}%`,
              background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 70%)',
              transition: prefersReducedMotion ? 'none' : 'top 0.35s ease, left 0.35s ease',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* Fixed top rim light */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 52%)',
            pointerEvents: 'none',
          }}
        />

        {/* Press brightness ripple overlay */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: pressed ? 'rgba(255,255,255,0.12)' : 'transparent',
            transition: 'background 0.15s ease',
            pointerEvents: 'none',
          }}
        />

        {/* Inner deep glow */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            boxShadow: 'inset 0 2px 10px rgba(255,255,255,0.1), inset 0 -2px 8px rgba(0,0,0,0.08)',
            pointerEvents: 'none',
          }}
        />

        {/* Icon glyph — always crisp white */}
        <Icon
          className="absolute text-white"
          style={{
            width: glyphSize,
            height: glyphSize,
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) ${pressed ? 'scale(0.92)' : 'scale(1)'}`,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.55))',
            zIndex: 2,
            transition: 'transform 0.12s ease',
          }}
        />

        {/* Badge */}
        {badge > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-5 px-1.5 rounded-full bg-red-500 text-white flex items-center justify-center font-bold shadow-lg z-10"
            style={{ fontSize: 10, lineHeight: 1.2 }}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
    </div>
  );
}