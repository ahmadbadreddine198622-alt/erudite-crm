/**
 * ExtremeLiquidIcon — beyond Apple: ultra-refractive glass with parallax tilt, animated sheen, and wet-glass press.
 * Features: heavy blur, luminous rim, inner glow, specular highlight, staggered entrance, tactile feedback.
 *
 * Props:
 *   icon        — Lucide icon component
 *   gradient    — Tailwind gradient for tint
 *   size        — px dimension (default 62)
 *   iconSize    — icon px (default size * 0.38)
 *   active      — edit mode / brighter state
 *   badge       — badge count (>0 shows)
 *   onClick     — click handler
 *   index       — for staggered entrance
 */

import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';

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
}) {
  const [pressed, setPressed] = useState(false);
  const glyphSize = iconSize ?? Math.round(size * 0.38);
  const radius = `${Math.round(size * 0.22)}px`;
  const sheenRef = useRef(null);

  const handlePress = () => {
    setPressed(true);
    setTimeout(() => setPressed(false), 150);
  };

  return (
    <div
      className={cn(
        'relative flex flex-col items-center gap-2 select-none transition-transform duration-100',
        active ? 'animate-wiggle cursor-grab' : 'cursor-pointer',
        isDragging ? 'opacity-80' : '',
        !active && !isDragging && 'hover:scale-105'
      )}
      style={{
        animationDelay: `${index * 30}ms`,
      }}
      onMouseDown={!active ? handlePress : undefined}
      onTouchStart={!active ? handlePress : undefined}
      onClick={!active ? onClick : undefined}
    >
      {/* Icon container with parallax tilt */}
      <div
        className={cn('relative transition-all duration-150', pressed ? 'scale-95' : 'scale-100')}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
        }}
      >
        {/* Gradient base tint */}
        <div
          className={cn('absolute inset-0 bg-gradient-to-br opacity-50', gradient)}
          style={{ borderRadius: radius }}
        />

        {/* Ultra-frosted glass */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: pressed
              ? 'rgba(255, 255, 255, 0.18)'
              : active
              ? 'rgba(255, 255, 255, 0.12)'
              : 'rgba(255, 255, 255, 0.07)',
            backdropFilter: 'blur(32px) saturate(220%)',
            WebkitBackdropFilter: 'blur(32px) saturate(220%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderTopColor: 'rgba(255, 255, 255, 0.35)',
            boxShadow: pressed
              ? '0 6px 20px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25)'
              : '0 10px 32px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
            transition: 'all 0.15s ease',
          }}
        />

        {/* Animated sheen layer */}
        <div
          ref={sheenRef}
          className="absolute inset-0 overflow-hidden"
          style={{
            borderRadius: radius,
            pointerEvents: 'none',
          }}
        >
          <div
            className={cn(
              'absolute w-[200%] h-[200%] opacity-30',
              pressed ? 'animate-none' : 'animate-shimmer'
            )}
            style={{
              background: 'linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%)',
              transform: 'rotate(-25deg)',
            }}
          />
        </div>

        {/* Luminous top rim */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 55%)',
            pointerEvents: 'none',
          }}
        />

        {/* Inner specular glow */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            boxShadow: 'inset 0 2px 12px rgba(255, 255, 255, 0.12), inset 0 -2px 8px rgba(0, 0, 0, 0.1)',
            pointerEvents: 'none',
          }}
        />

        {/* Icon glyph */}
        <Icon
          className="absolute text-white transition-transform duration-150"
          style={{
            width: glyphSize,
            height: glyphSize,
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) ${pressed ? 'scale(0.95)' : 'scale(1)'}`,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
            zIndex: 2,
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