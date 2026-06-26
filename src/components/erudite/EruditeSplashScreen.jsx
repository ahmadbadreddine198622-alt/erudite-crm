import React, { useEffect, useState } from 'react';

/**
 * ERUDITE Luxury Splash Screen — Premium Real Estate CRM
 * Apple-meets-luxury-watchmaking aesthetic
 * Deep charcoal-navy background with gold accents
 */
export default function EruditeSplashScreen() {
  const [mounted, setMounted] = useState(false);
  const [dateTime, setDateTime] = useState({ time: '', seconds: '', date: '' });

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const dayName = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      const month = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      const dayNum = now.getDate();
      setDateTime({
        time: `${hours}:${minutes}`,
        seconds,
        date: `${dayName} - ${month} ${dayNum}`,
      });
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="relative w-full flex items-center justify-center mb-6"
      style={{
        perspective: '1000px',
      }}
    >
      {/* Ambient background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 40%, rgba(201,161,74,0.08) 0%, transparent 60%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Main card — glassmorphism panel */}
      <div
        className="relative flex flex-col items-center justify-center px-6 py-5"
        style={{
          width: '100%',
          maxWidth: 280,
          borderRadius: 28,
          background: 'linear-gradient(135deg, rgba(26,31,46,0.75) 0%, rgba(21,25,31,0.7) 100%)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: `
            0 24px 80px rgba(0,0,0,0.6),
            0 0 0 1px rgba(255,255,255,0.04) inset,
            0 0 60px rgba(201,161,74,0.06)
          `,
          animation: 'splashFloat 8s ease-in-out infinite',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Subtle inner glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: 36,
            background: 'radial-gradient(ellipse 60% 80% at 50% 30%, rgba(245,230,184,0.04) 0%, transparent 50%)',
          }}
        />

        {/* Calligraphic glyph container with radial halo */}
        <div
          className="relative mb-3"
          style={{
            animation: 'glyphBreathe 6s ease-in-out infinite',
          }}
        >
          {/* Radial halo behind glyph */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              width: 48,
              height: 48,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, rgba(245,230,184,0.08) 0%, rgba(201,161,74,0.04) 40%, transparent 70%)',
              filter: 'blur(10px)',
            }}
          />
          
          {/* Ornate Arabic calligraphic glyph */}
          <svg
            width="38"
            height="38"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              filter: 'drop-shadow(0 2px 6px rgba(201,161,74,0.25))',
            }}
          >
            <defs>
              <linearGradient id="splashGoldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F5E6B8" />
                <stop offset="35%" stopColor="#C9A14A" />
                <stop offset="65%" stopColor="#8A6D2F" />
                <stop offset="100%" stopColor="#C9A14A" />
              </linearGradient>
              <filter id="splashGlow">
                <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            
            {/* Primary vertical emblem — regal Arabic calligraphic form, balanced & iconic */}
            <path
              d="M50 6 C55 10, 56 18, 52 26 C48 34, 42 40, 38 47 C34 54, 33 63, 37 70 C41 77, 48 81, 55 84 C62 87, 69 91, 72 97 C75 103, 72 109, 65 111"
              stroke="url(#splashGoldGradient)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#splashGlow)"
              opacity="0.95"
            />
            {/* Secondary flowing stroke — elegant counterbalance with geometric precision */}
            <path
              d="M50 8 C44 14, 42 22, 45 29 C48 36, 53 41, 59 45 C65 49, 71 54, 73 61 C75 68, 72 76, 65 80 C58 84, 51 82, 46 76"
              stroke="url(#splashGoldGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />
            {/* Inner decorative flourish — refined architectural detail */}
            <path
              d="M49 16 C54 19, 59 22, 62 28 C65 34, 62 41, 56 45"
              stroke="url(#splashGoldGradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.85"
            />
            {/* Traditional diacritical marks — elevated, symmetrical positioning */}
            <circle cx="44" cy="51" r="2.2" fill="url(#splashGoldGradient)" filter="url(#splashGlow)" />
            <circle cx="56" cy="56" r="1.8" fill="url(#splashGoldGradient)" opacity="0.9" />
            <circle cx="50" cy="62" r="1.4" fill="url(#splashGoldGradient)" opacity="0.8" />
          </svg>
        </div>

        {/* ERUDITE wordmark — high-contrast serif display */}
        <h1
          className="mb-1"
          style={{
            fontSize: 28,
            fontWeight: 600,
            fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
            background: 'linear-gradient(180deg, #F5E6B8 0%, #C9A14A 35%, #8A6D2F 65%, #C9A14A 100%)',
            backgroundSize: '100% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '0.18em',
            lineHeight: 1,
            textShadow: '0 2px 6px rgba(201,161,74,0.18)',
            animation: 'wordmarkShimmer 10s ease-in-out infinite',
          }}
        >
          ERUDITE
        </h1>

        {/* Subtitle with flanking hairline rules */}
        <div
          className="flex items-center gap-2 mb-4"
          style={{
            width: '100%',
          }}
        >
          <div
            style={{
              flex: 1,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(201,161,74,0.35))',
            }}
          />
          <span
            style={{
              fontSize: 7,
              fontWeight: 400,
              fontFamily: "'Inter', -apple-system, sans-serif",
              textTransform: 'uppercase',
              letterSpacing: '0.4em',
              color: 'rgba(201,161,74,0.7)',
              whiteSpace: 'nowrap',
            }}
          >
            REAL ESTATE CRM
          </span>
          <div
            style={{
              flex: 1,
              height: 1,
              background: 'linear-gradient(90deg, rgba(201,161,74,0.35), transparent)',
            }}
          />
        </div>

        {/* Digital Clock Display — Large modern time */}
        <div
          className="flex items-end gap-1 mb-2"
          style={{
            animation: 'clockFadeIn 1s ease-out',
          }}
        >
          <span
            style={{
              fontSize: 42,
              fontWeight: 200,
              fontFamily: "'SF Mono', 'Monaco', 'Courier New', monospace",
              color: 'rgba(255,255,255,0.95)',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            {dateTime.time}
          </span>
          <span
            style={{
              fontSize: 20,
              fontWeight: 300,
              fontFamily: "'SF Mono', 'Monaco', 'Courier New', monospace",
              color: 'rgba(201,161,74,0.8)',
              lineHeight: 1,
              marginBottom: 4,
            }}
          >
            {dateTime.seconds}
          </span>
        </div>

        {/* Date display */}
        <p
          style={{
            fontSize: 11,
            fontWeight: 400,
            fontFamily: "'Inter', -apple-system, sans-serif",
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.08em',
            marginTop: 2,
          }}
        >
          {dateTime.date}
        </p>


      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes splashFloat {
          0%, 100% {
            transform: translateY(0) rotateX(0deg) rotateY(0deg);
          }
          25% {
            transform: translateY(-3px) rotateX(0.5deg) rotateY(-0.5deg);
          }
          50% {
            transform: translateY(0) rotateX(0deg) rotateY(0deg);
          }
          75% {
            transform: translateY(-3px) rotateX(-0.5deg) rotateY(0.5deg);
          }
        }
        @keyframes glyphBreathe {
          0%, 100% {
            transform: scale(1);
            opacity: 0.95;
          }
          50% {
            transform: scale(1.02);
            opacity: 1;
          }
        }
        @keyframes wordmarkShimmer {
          0%, 100% {
            background-position: 0% 0%;
            filter: drop-shadow(0 2px 8px rgba(201,161,74,0.25));
          }
          50% {
            background-position: 0% 100%;
            filter: drop-shadow(0 3px 12px rgba(201,161,74,0.4));
          }
        }
        @keyframes clockFadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}