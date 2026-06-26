import React, { useEffect, useRef } from 'react';

/**
 * ERUDITE Logo — Ultra-Premium Brand Design
 * Complex Arabic calligraphy + ERUDITE wordmark + REAL ESTATE CRM + Diamond ornament
 * Rich metallic gold gradients with motion and depth
 */
export default function EruditeLogo({ size = 'medium', className = '' }) {
  const sizes = {
    small: { container: 100, wordmark: 32, tagline: 8, icon: 40, taglineGap: 10, ornamentGap: 10 },
    medium: { container: 160, wordmark: 52, tagline: 11, icon: 64, taglineGap: 12, ornamentGap: 12 },
    large: { container: 220, wordmark: 78, tagline: 15, icon: 92, taglineGap: 16, ornamentGap: 16 },
  };

  const s = sizes[size] || sizes.medium;
  const svgRef = useRef(null);

  // Subtle shimmer animation for metallic effect
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    let animationFrame;
    let time = 0;
    
    const animate = () => {
      time += 0.01;
      const gradient = svg.querySelector('#goldGradientAnimated');
      if (gradient) {
        const offset1 = gradient.children[0];
        const offset2 = gradient.children[2];
        const offset3 = gradient.children[4];
        if (offset1 && offset2 && offset3) {
          const shift = (Math.sin(time) * 10 + 50);
          offset1.setAttribute('offset', `${Math.max(0, shift - 25)}%`);
          offset2.setAttribute('offset', `${shift}%`);
          offset3.setAttribute('offset', `${Math.min(100, shift + 25)}%`);
        }
      }
      animationFrame = requestAnimationFrame(animate);
    };
    
    animate();
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <div
      className={`flex flex-col items-center justify-center ${className}`}
      style={{
        width: s.container,
        padding: size === 'small' ? '10px 6px' : size === 'large' ? '20px 10px' : '14px 8px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: size === 'small' ? 16 : size === 'large' ? 28 : 20,
        border: '1px solid rgba(197,160,89,0.15)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* Arabic Calligraphy Icon — Ultra-complex fluid interlocking strokes with depth */}
      <div
        style={{
          width: s.icon,
          height: s.icon,
          marginBottom: size === 'small' ? 10 : size === 'large' ? 18 : 14,
          filter: 'drop-shadow(0 4px 12px rgba(197,160,89,0.4))',
        }}
      >
        <svg ref={svgRef} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* Animated metallic gold gradient */}
            <linearGradient id="goldGradientAnimated" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="25%" stopColor="#F4D69A">
                <animate attributeName="stop-color" values="#F4D69A;#E6C57A;#F4D69A" dur="4s" repeatCount="indefinite" />
              </stop>
              <stop offset="50%" stopColor="#C5A059" />
              <stop offset="75%" stopColor="#8B6B2E">
                <animate attributeName="stop-color" values="#8B6B2E;#A88532;#8B6B2E" dur="4s" repeatCount="indefinite" />
              </stop>
              <stop offset="85%" stopColor="#C5A059" />
              <stop offset="100%" stopColor="#F4D69A" />
            </linearGradient>
            
            {/* Vertical gradient for main stroke */}
            <linearGradient id="goldGradientVertical" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F4D69A" />
              <stop offset="30%" stopColor="#E6C57A" />
              <stop offset="60%" stopColor="#C5A059" />
              <stop offset="100%" stopColor="#8B6B2E" />
            </linearGradient>
            
            {/* Radial glow */}
            <radialGradient id="glowRadial" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(197,160,89,0.4)" />
              <stop offset="100%" stopColor="rgba(197,160,89,0)" />
            </radialGradient>
            
            {/* Glow filter */}
            <filter id="glowStrong">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            
            {/* Inner shadow for depth */}
            <filter id="innerShadow">
              <feOffset dx="0" dy="1" />
              <feGaussianBlur stdDeviation="1" />
              <feComposite operator="out" in2="SourceGraphic" />
              <feColorMatrix type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.42  0 0 0 0 0.18  0 0 0 0.4 0" />
              <feComposite operator="in" in2="SourceGraphic" />
            </filter>
          </defs>
          
          {/* Background glow aura */}
          <ellipse cx="50" cy="50" rx="45" ry="45" fill="url(#glowRadial)" opacity="0.3" />
          
          {/* Main calligraphic stroke — complex fluid form with depth */}
          <path
            d="M50 6 C58 10, 62 18, 58 28 C54 38, 46 44, 40 50 C34 56, 30 64, 34 72 C38 80, 46 84, 52 88 C58 92, 64 94, 66 96"
            stroke="url(#goldGradientVertical)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glowStrong)"
            opacity="0.95"
          />
          
          {/* Secondary flowing stroke — interlocking */}
          <path
            d="M46 12 C52 16, 56 22, 52 30 C48 38, 40 42, 36 48 C32 54, 34 62, 42 66 C50 70, 58 68, 62 62"
            stroke="url(#goldGradientAnimated)"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.9"
            filter="url(#glowStrong)"
          />
          
          {/* Upper decorative flourish — elegant sweep */}
          <path
            d="M44 18 C50 20, 56 24, 58 30 C60 36, 56 42, 50 44"
            stroke="url(#goldGradientAnimated)"
            strokeWidth="2.8"
            strokeLinecap="round"
            opacity="0.8"
          />
          
          {/* Lower accent stroke — balancing curve */}
          <path
            d="M54 70 C60 74, 64 80, 60 88 C56 94, 48 94, 46 90"
            stroke="url(#goldGradientAnimated)"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.75"
          />
          
          {/* Inner detail stroke */}
          <path
            d="M48 32 C52 36, 54 42, 50 48 C46 52, 42 54, 40 52"
            stroke="url(#goldGradientVertical)"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.7"
          />
          
          {/* Decorative dots — traditional Arabic calligraphy style with varying sizes */}
          <circle cx="40" cy="54" r="3" fill="url(#goldGradientAnimated)">
            <animate attributeName="opacity" values="0.8;1;0.8" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx="60" cy="60" r="2.5" fill="url(#goldGradientAnimated)" opacity="0.9" />
          <circle cx="50" cy="46" r="1.8" fill="url(#goldGradientAnimated)" opacity="0.75" />
          <circle cx="46" cy="64" r="1.5" fill="url(#goldGradientAnimated)" opacity="0.65" />
          <circle cx="56" cy="52" r="1.2" fill="url(#goldGradientAnimated)" opacity="0.6" />
        </svg>
      </div>

      {/* ERUDITE Wordmark — Bold elegant serif with rich metallic gradient */}
      <h1
        style={{
          fontSize: s.wordmark,
          fontWeight: 800,
          fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
          background: 'linear-gradient(180deg, #F4D69A 0%, #E6C57A 20%, #C5A059 45%, #A88532 65%, #C5A059 85%, #F4D69A 100%)',
          backgroundSize: '100% 160%',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '0.14em',
          lineHeight: 1.1,
          marginBottom: size === 'small' ? 8 : size === 'large' ? 16 : 11,
          filter: 'drop-shadow(0 2px 8px rgba(197,160,89,0.4))',
          animation: 'wordmarkShimmer 6s ease-in-out infinite',
        }}
      >
        ERUDITE
      </h1>

      {/* REAL ESTATE CRM — Monospaced style with wide tracking, dark brown/gold */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: size === 'small' ? 10 : size === 'large' ? 18 : 14,
          width: '100%',
        }}
      >
        <div
          style={{
            flex: 1,
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(139,115,85,0.6), rgba(197,160,89,0.4))',
            opacity: 0.6,
          }}
        />
        <span
          style={{
            fontSize: s.tagline,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5em',
            color: '#8B7355',
            whiteSpace: 'nowrap',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace",
            textShadow: '0 0 4px rgba(139,115,85,0.3)',
          }}
        >
          REAL ESTATE CRM
        </span>
        <div
          style={{
            flex: 1,
            height: 1,
            background: 'linear-gradient(90deg, rgba(197,160,89,0.4), rgba(139,115,85,0.6), transparent)',
            opacity: 0.6,
          }}
        />
      </div>

      {/* Footer Ornament — Diamond star with horizontal lines */}
      {size !== 'small' && (
        <div
          style={{
            marginTop: size === 'large' ? 16 : 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: size === 'large' ? 16 : 11,
            width: '100%',
          }}
        >
          <div
            style={{
              flex: 1,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(139,115,85,0.5), rgba(197,160,89,0.35))',
              maxWidth: size === 'large' ? 80 : 50,
            }}
          />
          {/* Four-pointed diamond star ornament with sparkle */}
          <svg
            width={size === 'large' ? 14 : 10}
            height={size === 'large' ? 14 : 10}
            viewBox="0 0 14 14"
            fill="none"
            style={{
              filter: 'drop-shadow(0 2px 6px rgba(197,160,89,0.5))',
            }}
          >
            <defs>
              <linearGradient id="starGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F4D69A" />
                <stop offset="50%" stopColor="#C5A059" />
                <stop offset="100%" stopColor="#8B6B2E" />
              </linearGradient>
            </defs>
            {/* Main diamond */}
            <path
              d="M7 0 L8.5 5.5 L14 7 L8.5 8.5 L7 14 L5.5 8.5 L0 7 L5.5 5.5 Z"
              fill="url(#starGradient)"
              opacity="0.95"
            />
            {/* Inner sparkle */}
            <path
              d="M7 2 L7.8 5.2 L11 6 L7.8 6.8 L7 10 L6.2 6.8 L3 6 L6.2 5.2 Z"
              fill="#F4D69A"
              opacity="0.6"
            />
          </svg>
          <div
            style={{
              flex: 1,
              height: 1,
              background: 'linear-gradient(90deg, rgba(197,160,89,0.35), rgba(139,115,85,0.5), transparent)',
              maxWidth: size === 'large' ? 80 : 50,
            }}
          />
        </div>
      )}
      
      {/* CSS Animations */}
      <style>{`
        @keyframes wordmarkShimmer {
          0%, 100% { 
            background-position: 0% 0%;
            filter: drop-shadow(0 2px 8px rgba(197,160,89,0.4));
          }
          50% { 
            background-position: 0% 100%;
            filter: drop-shadow(0 3px 12px rgba(197,160,89,0.6));
          }
        }
      `}</style>
    </div>
  );
}