// Animated lion-themed decorative divider with motion effects.
import React from 'react';

export default function LionAnimatedDivider({ color = 'hsl(38 92% 50%)', className = '' }) {
  return (
    <div className={`w-full my-3 pointer-events-none overflow-hidden ${className}`} aria-hidden="true">
      <svg viewBox="0 0 1200 40" preserveAspectRatio="none" className="w-full h-10 block">
        <defs>
          {/* Gradient for the lion trail */}
          <linearGradient id="lion-trail-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0" />
            <stop offset="20%" stopColor={color} stopOpacity="0.3" />
            <stop offset="50%" stopColor={color} stopOpacity="0.8" />
            <stop offset="80%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          
          {/* Glow filter */}
          <filter id="lion-glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        {/* Main flowing line with lion silhouette */}
        <g>
          {/* Background trail line */}
          <line 
            x1="0" 
            y1="20" 
            x2="1200" 
            y2="20" 
            stroke="url(#lion-trail-gradient)" 
            strokeWidth="2"
            strokeLinecap="round"
          />
          
          {/* Animated lion silhouette moving across */}
          <g>
            <animateTransform 
              attributeName="transform" 
              type="translate" 
              from="-100 0" 
              to="1300 0" 
              dur="8s" 
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.2 1"
            />
            
            {/* Lion icon/silhouette */}
            <circle cx="0" cy="20" r="6" fill={color} filter="url(#lion-glow)" opacity="0.9" />
            
            {/* Motion trail circles */}
            <circle cx="-15" cy="20" r="4" fill={color} opacity="0.6" />
            <circle cx="-28" cy="20" r="3" fill={color} opacity="0.4" />
            <circle cx="-38" cy="20" r="2" fill={color} opacity="0.2" />
            
            {/* Lion mane suggestion */}
            <path 
              d="M -8 20 Q -4 14 0 20 Q 4 14 8 20 Q 4 26 0 20 Q -4 26 -8 20" 
              fill="none" 
              stroke={color} 
              strokeWidth="1.5" 
              opacity="0.7"
            />
          </g>
          
          {/* Secondary decorative wave line */}
          <path 
            d="M 0 20 Q 300 10 600 20 T 1200 20" 
            fill="none" 
            stroke={color} 
            strokeWidth="1" 
            strokeDasharray="4 8"
            opacity="0.3"
          >
            <animate 
              attributeName="stroke-dashoffset" 
              from="0" 
              to="100" 
              dur="3s" 
              repeatCount="indefinite"
            />
          </path>
        </g>
      </svg>
      
      {/* CSS for additional animations */}
      <style>{`
        @keyframes lion-pulse {
          0%, 100% { opacity: 0.9; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}