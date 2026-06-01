import React from 'react';
import { cn } from '@/lib/utils';

export default function EruditeBadge({ children, variant = 'default', className }) {
  const variants = {
    default: {
      bg: 'bg-white/5',
      border: 'border-white/10',
      text: 'text-white/70'
    },
    gold: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-400'
    },
    emerald: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400'
    },
    rose: {
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/30',
      text: 'text-rose-400'
    },
    blue: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      text: 'text-blue-400'
    },
    purple: {
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/30',
      text: 'text-purple-400'
    }
  };

  const style = variants[variant] || variants.default;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium tracking-wide',
        'backdrop-blur-sm transition-all',
        style.bg,
        style.border,
        style.text,
        className
      )}
    >
      {children}
    </span>
  );
}