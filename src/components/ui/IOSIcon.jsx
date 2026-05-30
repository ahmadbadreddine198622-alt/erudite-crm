/**
 * IOSIcon — reusable classic/skeuomorphic iOS-style squircle icon wrapper.
 *
 * Usage:
 *   <IOSIcon icon={CalendarIcon} gradient="from-blue-500 to-blue-700" size={56} />
 *
 * Props:
 *   icon        — Lucide (or any) React icon component
 *   gradient    — Tailwind gradient string, e.g. "from-violet-500 to-purple-700"
 *                 OR a CSS background string if you prefix with "css:"
 *   size        — outer px dimension (default 56)
 *   iconSize    — icon px dimension (default size * 0.5)
 *   active      — boolean, brightens the gloss slightly
 *   shadow      — Tailwind shadow color token string e.g. "shadow-blue-500/30"
 *   className   — extra classes on the outer wrapper
 *   style       — extra inline styles on the outer wrapper
 *   badge       — number; renders a red badge pill top-right when > 0
 *   onClick     — click handler
 *   pressed     — boolean; apply scale-down (used externally via active:scale-95)
 */

import React from 'react';
import { cn } from '@/lib/utils';

export default function IOSIcon({
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
  const radius = `${Math.round(size * 0.22)}px`;   // ~22% corner radius

  return (
    <div
      onClick={onClick}
      className={cn('relative shrink-0 select-none', className)}
      style={{ width: size, height: size, ...style }}
    >
      {/* Squircle base with gradient */}
      <div
        className={cn('absolute inset-0 bg-gradient-to-br', gradient)}
        style={{ borderRadius: radius }}
      />

      {/* Inner rim highlight (very top edge) */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: radius,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%)',
          pointerEvents: 'none',
        }}
      />

      {/* Classic iOS gloss bubble — top-half curved sheen */}
      <div
        className="absolute"
        style={{
          top: '4%',
          left: '8%',
          width: '84%',
          height: '50%',
          borderRadius: '50% 50% 38% 38% / 60% 60% 40% 40%',
          background: active
            ? 'linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.10) 100%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.48) 0%, rgba(255,255,255,0.06) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Icon glyph */}
      {Icon && (
        <Icon
          className="absolute text-white"
          style={{
            width: glyphSize,
            height: glyphSize,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
            zIndex: 2,
          }}
        />
      )}
      {children}

      {/* Badge */}
      {badge > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white flex items-center justify-center font-bold"
          style={{ fontSize: 9, zIndex: 10, lineHeight: 1 }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </div>
  );
}