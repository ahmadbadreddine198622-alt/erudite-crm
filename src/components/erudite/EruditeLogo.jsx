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
        padding: size === 'small' ? '8px 4px' : size === 'large' ? '16px 8px' : '12px 6px',
      }}
    >
      {/* Arabic Calligraphy Icon — Complex fluid interlocking strokes */}
      <div
        style={{
          width: s.icon,
          height: s.icon,
          marginBottom: size === 'small' ? 8 : size === 'large' ? 14 : 11,
        }}
      >
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E6C57A" />
              <stop offset="25%" stopColor="#C5A059" />
              <stop offset="50%" stopColor="#A88532" />
              <stop offset="75%" stopColor="#C5A059" />
              <stop offset="100%" stopColor="#E6C57A" />
            </linearGradient>
            <linearGradient id="goldGradientVertical" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#E6C57A" />
              <stop offset="50%" stopColor="#C5A059" />
              <stop offset="100%" stopColor="#A88532" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          {/* Main calligraphic stroke — complex fluid form */}
          <path
            d="M50 8 C56 12, 58 20, 54 28 C50 36, 44 40, 40 45 C36 50, 34 56, 36 62 C38 68, 43 72, 49 75 C55 78, 60 82, 63 88 C66 94, 62 98, 55 96"
            stroke="url(#goldGradientVertical)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
          />
          {/* Secondary flowing stroke */}
          <path
            d="M48 14 C52 18, 54 24, 50 30 C46 36, 40 38, 38 44 C36 50, 38 56, 44 60 C50 64, 56 64, 60 60"
            stroke="url(#goldGradient)"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.85"
          />
          {/* Upper decorative flourish */}
          <path
            d="M46 22 C50 24, 54 26, 56 30 C58 34, 56 40, 52 42"
            stroke="url(#goldGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.75"
          />
          {/* Lower accent stroke */}
          <path
            d="M52 68 C56 72, 58 78, 56 84 C54 88, 50 90, 48 88"
            stroke="url(#goldGradient)"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.7"
          />
          {/* Decorative dots — traditional Arabic calligraphy style */}
          <circle cx="42" cy="52" r="2.5" fill="url(#goldGradient)" />
          <circle cx="58" cy="58" r="2" fill="url(#goldGradient)" opacity="0.85" />
          <circle cx="50" cy="48" r="1.5" fill="url(#goldGradient)" opacity="0.7" />
        </svg>
      </div>

      {/* ERUDITE Wordmark — Bold serif with vertical gold gradient */}
      <h1
        style={{
          fontSize: s.wordmark,
          fontWeight: 700,
          fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
          background: 'linear-gradient(180deg, #E6C57A 0%, #C5A059 35%, #A88532 65%, #C5A059 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '0.12em',
          lineHeight: 1.1,
          marginBottom: size === 'small' ? 6 : size === 'large' ? 12 : 9,
        }}
      >
        ERUDITE
      </h1>

      {/* REAL ESTATE CRM — Monospaced style with wide tracking, dark brown/gold */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: size === 'small' ? 8 : size === 'large' ? 14 : 11,
          width: '100%',
        }}
      >
        <div
          style={{
            flex: 1,
            height: 1,
            background: 'linear-gradient(90deg, transparent, #C5A059)',
            opacity: 0.5,
          }}
        />
        <span
          style={{
            fontSize: s.tagline,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.45em',
            color: '#8B7355',
            whiteSpace: 'nowrap',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          REAL ESTATE CRM
        </span>
        <div
          style={{
            flex: 1,
            height: 1,
            background: 'linear-gradient(90deg, #C5A059, transparent)',
            opacity: 0.5,
          }}
        />
      </div>

      {/* Footer Ornament — Diamond star with horizontal lines */}
      {size !== 'small' && (
        <div
          style={{
            marginTop: size === 'large' ? 12 : 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: size === 'large' ? 12 : 8,
            width: '100%',
          }}
        >
          <div
            style={{
              flex: 1,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(197,160,89,0.35), rgba(139,115,85,0.5))',
              maxWidth: size === 'large' ? 60 : 40,
            }}
          />
          {/* Four-pointed diamond star ornament */}
          <svg
            width={size === 'large' ? 12 : 8}
            height={size === 'large' ? 12 : 8}
            viewBox="0 0 12 12"
            fill="none"
          >
            <path
              d="M6 0 L7.5 4.5 L12 6 L7.5 7.5 L6 12 L4.5 7.5 L0 6 L4.5 4.5 Z"
              fill="url(#goldGradient)"
              opacity="0.9"
            />
          </svg>
          <div
            style={{
              flex: 1,
              height: 1,
              background: 'linear-gradient(90deg, rgba(139,115,85,0.5), rgba(197,160,89,0.35), transparent)',
              maxWidth: size === 'large' ? 60 : 40,
            }}
          />
        </div>
      )}
    </div>
  );
}