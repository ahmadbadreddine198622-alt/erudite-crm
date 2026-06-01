import React from 'react';
import { cn } from '@/lib/utils';

export default function EruditeCard({ children, className, glow = false }) {
  return (
    <div
      className={cn(
        'relative rounded-2xl overflow-hidden transition-all duration-300',
        'bg-gradient-to-br from-white/[0.06] to-white/[0.03]',
        'border border-white/[0.12]',
        'backdrop-blur-2xl',
        'hover:border-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/10',
        glow && 'shadow-amber-500/5',
        className
      )}
    >
      {/* Subtle inner glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.03] to-transparent opacity-0 hover:opacity-100 transition-opacity pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}