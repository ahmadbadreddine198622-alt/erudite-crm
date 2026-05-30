/**
 * LiquidGlassNavIcon — extreme iOS 26 / macOS Tahoe Liquid Glass icon for bottom navigation.
 * Features: heavy frosted blur, luminous rim highlights, refractive glass tint, layered shadows.
 *
 * Props:
 *   icon        — Lucide icon component
 *   gradient    — Tailwind gradient for color tint (e.g. "from-amber-500 to-amber-700")
 *   active      — boolean; applies gold glow and brighter glass
 *   size        — px dimension (default 48)
 *   label       — text label below icon
 *   onClick     — click handler
 */

import React from 'react';
import { cn } from '@/lib/utils';

export default function LiquidGlassNavIcon({
  icon: Icon,
  gradient = 'from-slate-500 to-slate-700',
  active = false,
  size = 48,
  label = '',
  onClick,
}) {
  const radius = `${Math.round(size * 0.22)}px`;

  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center gap-1.5 px-3 py-1 transition-transform duration-150 active:scale-95"
    >
      {/* Glass container */}
      <div
        className={cn(
          'relative flex items-center justify-center transition-all duration-200',
          active ? 'scale-105' : 'scale-100'
        )}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
        }}
      >
        {/* Gradient tint layer */}
        <div
          className={cn('absolute inset-0 bg-gradient-to-br opacity-40', gradient)}
          style={{ borderRadius: radius }}
        />

        {/* Heavy frosted glass overlay */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: active
              ? 'rgba(245, 159, 10, 0.15)'
              : 'rgba(255, 255, 255, 0.06)',
            backdropFilter: 'blur(24px) saturate(200%)',
            WebkitBackdropFilter: 'blur(24px) saturate(200%)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderTopColor: active ? 'rgba(245, 159, 10, 0.5)' : 'rgba(255, 255, 255, 0.3)',
            boxShadow: active
              ? '0 8px 24px rgba(245, 159, 10, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              : '0 6px 16px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
          }}
        />

        {/* Luminous top rim highlight */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 50%)',
            pointerEvents: 'none',
          }}
        />

        {/* Inner glow */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            boxShadow: 'inset 0 2px 8px rgba(255, 255, 255, 0.08)',
            pointerEvents: 'none',
          }}
        />

        {/* Icon glyph */}
        <Icon
          className="relative z-10"
          style={{
            width: Math.round(size * 0.5),
            height: Math.round(size * 0.5),
            color: active ? 'hsl(38 92% 50%)' : 'rgba(255, 255, 255, 0.9)',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
          }}
        />
      </div>

      {/* Label */}
      {label && (
        <span
          className={cn(
            'text-[10px] font-medium transition-colors',
            active ? 'text-amber-500' : 'text-white/60'
          )}
        >
          {label}
        </span>
      )}
    </button>
  );
}