/**
 * LiquidGlassIcon — iOS 26 / macOS Tahoe "Liquid Glass" material icon wrapper.
 * Translucent frosted-glass with blur, subtle translucency, rim highlights, and depth.
 *
 * Usage:
 *   <LiquidGlassIcon icon={CalendarIcon} gradient="from-blue-500 to-blue-700" size={56} />
 *
 * Props:
 *   icon        — Lucide (or any) React icon component
 *   gradient    — Tailwind gradient string, e.g. "from-violet-500 to-purple-700"
 *   size        — outer px dimension (default 56)
 *   iconSize    — icon px dimension (default size * 0.5)
 *   active      — boolean, slightly brightens the glass
 *   className   — extra classes on the outer wrapper
 *   style       — extra inline styles on the outer wrapper
 *   badge       — number; renders a red badge pill top-right when > 0
 *   onClick     — click handler
 */

import React from 'react';
import { cn } from '@/lib/utils';

export default function LiquidGlassIcon({
  icon: Icon,
  gradient = 'from-slate-500 to-slate-700',
  size = 56,
  iconSize,
  active = false,
  className = '',
  style = {},
  badge = 0,
  onClick,
  children,
}) {
  const glyphSize = iconSize ?? Math.round(size * 0.5);
  const radius = `${Math.round(size * 0.22)}px`;

  return (
    <div
      onClick={onClick}
      className={cn('relative shrink-0 select-none group', className)}
      style={{ width: size, height: size, ...style }}
    >
      {/* Gradient base layer */}
      <div
        className={cn('absolute inset-0 bg-gradient-to-br', gradient)}
        style={{ borderRadius: radius }}
      />

      {/* Liquid Glass frosted overlay */}
      <div
        className="absolute inset-0 liquid-glass"
        style={{
          borderRadius: radius,
          background: active
            ? 'rgba(255, 255, 255, 0.12)'
            : 'rgba(255, 255, 255, 0.08)',
        }}
      />

      {/* Top rim highlight */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: radius,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 55%)',
          pointerEvents: 'none',
        }}
      />

      {/* Soft outer glow/rim */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: radius,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 8px 24px rgba(0,0,0,0.35)',
          pointerEvents: 'none',
        }}
      />

      {/* Icon glyph */}
      {Icon && (
        <Icon
          className="absolute text-white transition-transform duration-150 group-active:scale-95"
          style={{
            width: glyphSize,
            height: glyphSize,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))',
            zIndex: 2,
          }}
        />
      )}
      {children}

      {/* Badge */}
      {badge > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white flex items-center justify-center font-bold shadow-lg"
          style={{ fontSize: 9, zIndex: 10, lineHeight: 1 }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </div>
  );
}