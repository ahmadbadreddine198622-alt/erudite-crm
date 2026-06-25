import React from 'react';

/**
 * Animated Gradient Line — V-card style with motion
 * Matches the StraightDivider aesthetic from LandlordIdentityHeader with added animation
 */
export default function AudioWaveform({ 
  isActive = true,
  height = 24,
  width = '100%',
  primaryColor = '#C9A24B',  // V-card gold
  secondaryColor = '#F5E0A1', // Soft amber
  className = ''
}) {
  return (
    <div className={className} style={{ width, height }} aria-hidden="true">
      <svg viewBox="0 0 1200 24" preserveAspectRatio="none" className="w-full h-full block">
        <defs>
          {/* Animated gradient following V-card gradient style */}
          <linearGradient id="wave-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={primaryColor} stopOpacity="0">
              <animate attributeName="stop-opacity" values="0;0.3;0" dur="2.5s" repeatCount="indefinite" />
            </stop>
            <stop offset="30%" stopColor={primaryColor} stopOpacity="0.3">
              <animate attributeName="stop-opacity" values="0.3;0.6;0.3" dur="2.5s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor={primaryColor} stopOpacity="0.8">
              <animate attributeName="stop-opacity" values="0.8;1;0.8" dur="2.5s" repeatCount="indefinite" />
            </stop>
            <stop offset="70%" stopColor={primaryColor} stopOpacity="0.3">
              <animate attributeName="stop-opacity" values="0.3;0.6;0.3" dur="2.5s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor={primaryColor} stopOpacity="0">
              <animate attributeName="stop-opacity" values="0;0.3;0" dur="2.5s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          
          {/* Glow filter for premium feel */}
          <filter id="wave-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        {/* Main animated gradient line */}
        <line
          x1="0"
          y1="12"
          x2="1200"
          y2="12"
          stroke="url(#wave-gradient)"
          strokeWidth="2"
          strokeLinecap="round"
          filter={isActive ? "url(#wave-glow)" : ""}
        >
          {isActive && (
            <animate
              attributeName="stroke-dasharray"
              values="0,1200;1200,0;0,1200"
              dur="3s"
              repeatCount="indefinite"
            />
          )}
        </line>
        
        {/* Subtle secondary line for depth */}
        <line
          x1="0"
          y1="18"
          x2="1200"
          y2="18"
          stroke={secondaryColor}
          strokeWidth="1"
          strokeOpacity={isActive ? "0.2" : "0.15"}
          strokeDasharray="4,4"
        >
          {isActive && (
            <animate
              attributeName="stroke-dashoffset"
              values="0;-8"
              dur="1.5s"
              repeatCount="indefinite"
            />
          )}
        </line>
      </svg>
    </div>
  );
}