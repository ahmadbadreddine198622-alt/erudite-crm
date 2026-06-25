import React, { useEffect, useRef, useState } from 'react';

/**
 * Animated Waveform Line — Flowing, reactive motion
 * Dotted line with pulsing waveform bars, organic movement
 */
export default function AudioWaveform({ 
  isActive = true,
  height = 32,
  width = '100%',
  primaryColor = '#E0A74D',
  waveformColor = '#F5B041',
  className = ''
}) {
  const animationRef = useRef(null);
  const [bars, setBars] = useState(7);
  const [phase, setPhase] = useState(0);
  const [flowOffset, setFlowOffset] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    
    let frame = 0;
    const animate = () => {
      frame += 1;
      // Continuous phase progression for organic wave motion
      setPhase(frame * 0.08);
      // Flow animation for dotted lines
      setFlowOffset(frame * 1.5);
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isActive]);

  const centerX = 200;
  const barSpacing = 5;
  const maxBarHeight = 16;

  // Generate bar heights with flowing wave pattern
  const barHeights = Array.from({ length: bars }, (_, i) => {
    const base = Math.sin(i * 0.4) * 0.3 + 0.7; // Bell curve base
    const wave1 = Math.sin(phase + i * 0.6) * 0.25;
    const wave2 = Math.cos(phase * 1.3 + i * 0.3) * 0.15;
    const combined = base + wave1 + wave2;
    return Math.max(0.15, Math.min(1.2, combined));
  });

  // Generate wavy path for dotted line
  const generateWavePath = (startX, endX, amplitude, frequency) => {
    let path = `M ${startX} 16`;
    const steps = 30;
    const stepSize = (endX - startX) / steps;
    for (let i = 1; i <= steps; i++) {
      const x = startX + i * stepSize;
      const wave = Math.sin(i * frequency + phase) * amplitude;
      path += ` L ${x} ${16 + wave}`;
    }
    return path;
  };

  return (
    <div className={className} style={{ width, height: `${height}px` }} aria-hidden="true">
      <svg viewBox="0 0 400 32" preserveAspectRatio="none" className="w-full h-full block">
        <defs>
          {/* Pulsing glow gradient */}
          <radialGradient id="waveGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={waveformColor} stopOpacity="0.4">
              <animate attributeName="stop-opacity" values="0.4;0.2;0.4" dur="1.8s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor={waveformColor} stopOpacity="0" />
          </radialGradient>
        </defs>
        
        {/* Left wavy dotted line */}
        <path
          d={generateWavePath(0, centerX - 22, 3, 0.4)}
          stroke={primaryColor}
          strokeWidth="1.2"
          strokeOpacity="0.6"
          strokeDasharray="2.5,3.5"
          strokeDashoffset={-flowOffset % 6}
          strokeLinecap="round"
          fill="none"
        />
        
        {/* Right wavy dotted line */}
        <path
          d={generateWavePath(centerX + 22, 400, 3, 0.4)}
          stroke={primaryColor}
          strokeWidth="1.2"
          strokeOpacity="0.6"
          strokeDasharray="2.5,3.5"
          strokeDashoffset={-flowOffset % 6}
          strokeLinecap="round"
          fill="none"
        />
        
        {/* Pulsing glow background */}
        {isActive && (
          <ellipse
            cx={centerX}
            cy="16"
            rx="24"
            ry="12"
            fill="url(#waveGlow)"
          />
        )}
        
        {/* Waveform bars with organic motion */}
        {barHeights.map((h, i) => {
          const x = centerX - 15 + i * barSpacing;
          const barHeight = h * maxBarHeight;
          const intensity = 0.7 + h * 0.3;
          return (
            <rect
              key={i}
              x={x}
              y={16 - barHeight / 2}
              width="3"
              height={barHeight}
              fill={waveformColor}
              fillOpacity={intensity}
              rx="1.5"
              style={{
                transition: 'height 0.08s ease-out',
              }}
            />
          );
        })}
        
        {/* Center highlight pulse */}
        {isActive && (
          <rect
            x={centerX - 2}
            y="8"
            width="4"
            height="16"
            fill="#FFF"
            fillOpacity="0.15"
            rx="2"
          >
            <animate attributeName="opacity" values="0.15;0.3;0.15" dur="1.2s" repeatCount="indefinite" />
          </rect>
        )}
      </svg>
    </div>
  );
}