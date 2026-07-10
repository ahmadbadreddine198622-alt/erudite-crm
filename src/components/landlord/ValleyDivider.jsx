// Curved valley divider matching the Landlord Pipeline design
import React from 'react';

export default function ValleyDivider({ color = 'hsl(38 92% 50%)', opacity = 0.5, width = 600, height = 16, className = '' }) {
  return (
    <div style={{ margin: '10px 0 8px', pointerEvents: 'none' }} className={className} aria-hidden="true">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-3 block">
        <defs>
          <linearGradient id={`valley-${color.replace(/\s/g, '-')}-${opacity}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0" />
            <stop offset="50%" stopColor={color} stopOpacity={opacity} />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M0 ${height * 0.2} Q ${width / 2} ${height} ${width} ${height * 0.2}`} fill="none" stroke={`url(#valley-${color.replace(/\s/g, '-')}-${opacity})`} strokeWidth="1.5" />
      </svg>
    </div>
  );
}