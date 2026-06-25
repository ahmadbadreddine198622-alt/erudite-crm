// Refined straight divider with subtle gradient - cleaner and more sophisticated than curved valley.
import React from 'react';

export default function StraightDivider({ color = 'hsl(38 92% 50%)', opacity = 0.4, className = '' }) {
  return (
    <div className={`w-full my-3 pointer-events-none ${className}`} aria-hidden="true">
      <svg viewBox="0 0 1200 8" preserveAspectRatio="none" className="w-full h-2 block">
        <defs>
          <linearGradient id={`straight-fade-${color.replace(/\s/g, '-')}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0" />
            <stop offset="15%" stopColor={color} stopOpacity={opacity * 0.3} />
            <stop offset="50%" stopColor={color} stopOpacity={opacity} />
            <stop offset="85%" stopColor={color} stopOpacity={opacity * 0.3} />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line 
          x1="0" 
          y1="4" 
          x2="1200" 
          y2="4" 
          stroke={`url(#straight-fade-${color.replace(/\s/g, '-')})`} 
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}