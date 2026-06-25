import React, { useEffect, useRef, useState } from 'react';

/**
 * Animated Waveform Line — Exact match to reference design
 * Dotted line with central waveform bars, flowing motion left→right
 */
export default function AudioWaveform({ 
  isActive = true,
  height = 32,
  width = '100%',
  primaryColor = '#E0A74D',  // Muted amber/gold
  waveformColor = '#F5B041', // Vibrant warm gold for bars
  className = ''
}) {
  const animationRef = useRef(null);
  const [barHeights, setBarHeights] = React.useState([0.3, 0.5, 0.8, 1, 0.8, 0.5, 0.3]);
  const [offset, setOffset] = React.useState(0);

  useEffect(() => {
    if (!isActive) return;
    
    let frame = 0;
    const animate = () => {
      frame += 1;
      // Animate bar heights with wave pattern
      setBarHeights(prev => prev.map((_, i) => {
        const base = [0.3, 0.5, 0.8, 1, 0.8, 0.5, 0.3][i];
        const wave = Math.sin(frame * 0.1 + i * 0.5) * 0.2;
        return Math.max(0.2, base + wave);
      }));
      // Animate dotted line flow
      setOffset(prev => (prev + 1) % 8);
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isActive]);

  const centerX = 50; // Center of waveform (percentage)
  const barSpacing = 4;
  const maxBarHeight = 14;

  return (
    <div className={className} style={{ width, height: `${height}px` }} aria-hidden="true">
      <svg viewBox="0 0 400 32" preserveAspectRatio="none" className="w-full h-full block">
        {/* Left dotted line */}
        <line
          x1="0"
          y1="16"
          x2={centerX - 20}
          y2="16"
          stroke={primaryColor}
          strokeWidth="1"
          strokeOpacity="0.5"
          strokeDasharray="2,3"
          strokeDashoffset={isActive ? -offset : 0}
        />
        
        {/* Right dotted line */}
        <line
          x1={centerX + 20}
          y1="16"
          x2="400"
          y2="16"
          stroke={primaryColor}
          strokeWidth="1"
          strokeOpacity="0.5"
          strokeDasharray="2,3"
          strokeDashoffset={isActive ? -offset : 0}
        />
        
        {/* Waveform bars in center */}
        {barHeights.map((h, i) => {
          const x = centerX - 12 + i * barSpacing;
          const barHeight = h * maxBarHeight;
          return (
            <rect
              key={i}
              x={x}
              y={16 - barHeight / 2}
              width="2.5"
              height={barHeight}
              fill={waveformColor}
              fillOpacity="0.85"
              rx="1"
            />
          );
        })}
        
        {/* Subtle glow behind waveform */}
        {isActive && (
          <ellipse
            cx={centerX}
            cy="16"
            rx="18"
            ry="10"
            fill={waveformColor}
            fillOpacity="0.15"
            filter="blur(4px)"
          />
        )}
      </svg>
    </div>
  );
}