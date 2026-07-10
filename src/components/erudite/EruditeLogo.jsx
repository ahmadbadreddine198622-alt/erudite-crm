import React from 'react';

/**
 * ERUDITE Logo — Premium Brand Design
 * Arabic calligraphy symbol + ERUDITE wordmark + REAL ESTATE CRM tagline
 * Gold gradient (#C5A059 to #A88137) on transparent background
 */
export default function EruditeLogo({ size = 'medium', className = '' }) {
  const sizes = {
    small: { container: 80, wordmark: 28, tagline: 7, icon: 32 },
    medium: { container: 140, wordmark: 48, tagline: 10, icon: 56 },
    large: { container: 200, wordmark: 72, tagline: 14, icon: 80 },
  };

  const s = sizes[size] || sizes.medium;

  return (
    <div
      className={`flex flex-col items-center justify-center ${className}`}
      style={{
        width: s.container,
        padding: '12px 8px',
      }}
    >
      {/* Arabic Calligraphy Icon */}
      <div
        style={{
          width: s.icon,
          height: s.icon,
          marginBottom: size === 'small' ? 6 : 10,
        }}
      >
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#C5A059" />
              <stop offset="50%" stopColor="#A88137" />
              <stop offset="100%" stopColor="#C5A059" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          {/* Abstract calligraphic form — fluid vertical design */}
          <path
            d="M50 10 C55 15, 52 25, 48 30 C44 35, 40 38, 38 42 C36 46, 35 52, 38 56 C41 60, 46 62, 50 65 C54 68, 58 72, 60 78 C62 84, 58 90, 52 92"
            stroke="url(#goldGradient)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
          />
          <path
            d="M50 12 C45 16, 42 22, 44 28 C46 34, 50 38, 54 40 C58 42, 62 45, 64 50 C66 55, 64 62, 58 66 C52 70, 46 68, 42 64"
            stroke="url(#goldGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.8"
          />
          <path
            d="M48 20 C52 22, 56 24, 58 28 C60 32, 58 38, 54 40"
            stroke="url(#goldGradient)"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.7"
          />
          {/* Decorative dots */}
          <circle cx="45" cy="50" r="2" fill="url(#goldGradient)" />
          <circle cx="55" cy="55" r="1.5" fill="url(#goldGradient)" opacity="0.8" />
        </svg>
      </div>

      {/* ERUDITE Wordmark */}
      <h1
        style={{
          fontSize: s.wordmark,
          fontWeight: 600,
          fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
          background: 'linear-gradient(180deg, #C5A059 0%, #A88137 50%, #C5A059 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '0.12em',
          lineHeight: 1,
          marginBottom: size === 'small' ? 6 : 8,
        }}
      >
        ERUDITE
      </h1>

      {/* REAL ESTATE CRM with flanking lines */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: size === 'small' ? 6 : 10,
          width: '100%',
        }}
      >
        <div
          style={{
            flex: 1,
            height: 1,
            background: 'linear-gradient(90deg, transparent, #C5A059)',
            opacity: 0.6,
          }}
        />
        <span
          style={{
            fontSize: s.tagline,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.35em',
            color: '#C5A059',
            whiteSpace: 'nowrap',
            textShadow: '0 0 8px rgba(197,160,89,0.3)',
          }}
        >
          Real Estate
        </span>
        <div
          style={{
            flex: 1,
            height: 1,
            background: 'linear-gradient(90deg, #C5A059, transparent)',
            opacity: 0.6,
          }}
        />
      </div>

      {/* Diamond ornament */}
      {size !== 'small' && (
        <div
          style={{
            marginTop: size === 'large' ? 10 : 6,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              width: size === 'large' ? 32 : 20,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(197,160,89,0.4), transparent)',
            }}
          />
          <svg
            width={size === 'large' ? 10 : 7}
            height={size === 'large' ? 10 : 7}
            viewBox="0 0 10 10"
            fill="none"
          >
            <path
              d="M5 0 L10 5 L5 10 L0 5 Z"
              fill="url(#goldGradient)"
              opacity="0.8"
            />
          </svg>
          <div
            style={{
              width: size === 'large' ? 32 : 20,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(197,160,89,0.4), transparent)',
            }}
          />
        </div>
      )}
    </div>
  );
}