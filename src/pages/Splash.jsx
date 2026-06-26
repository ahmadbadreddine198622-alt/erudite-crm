import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * ERUDITE Splash Screen — Premium Luxury Loading Experience
 * Dark charcoal-navy backdrop with glassmorphism card, ornate gold calligraphy, and elegant typography
 */
export default function Splash() {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    setLoaded(true);
    
    // Format: FRI · JUN 26
    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const month = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const date = now.getDate();
    setCurrentTime(`${dayName} · ${month} ${date}`);

    // Auto-redirect after animation (for demo purposes)
    const timer = setTimeout(() => {
      navigate('/');
    }, 4000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 50% -20%, rgba(212,175,55,0.06) 0%, transparent 60%), linear-gradient(180deg, #1a1f2e 0%, #15191f 100%)',
      }}
    >
      {/* Ambient glow orbs */}
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, rgba(201,165,74,0.08) 0%, transparent 70%)',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 2s ease-out',
        }}
      />
      
      {/* Main card */}
      <div
        className="relative flex flex-col items-center px-16 py-14"
        style={{
          width: 420,
          borderRadius: 36,
          background: 'rgba(26,31,46,0.65)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 40px 120px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 80px rgba(201,165,74,0.06)',
          transform: loaded ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.98)',
          opacity: loaded ? 1 : 0,
          transition: 'all 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Inner glow */}
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(245,230,184,0.06) 0%, transparent 50%)',
          }}
        />

        {/* Ornate Calligraphic Logo Mark */}
        <div
          className="relative mb-8"
          style={{
            filter: 'drop-shadow(0 8px 24px rgba(201,165,74,0.4))',
            transform: loaded ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.95)',
            opacity: loaded ? 1 : 0,
            transition: 'all 1s ease-out 0.2s',
          }}
        >
          {/* Radial halo */}
          <div
            className="absolute inset-0 rounded-full blur-2xl"
            style={{
              background: 'radial-gradient(circle, rgba(201,165,74,0.25) 0%, transparent 60%)',
              transform: 'scale(1.4)',
            }}
          />
          
          <svg width="120" height="120" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              {/* Metallic gold gradient */}
              <linearGradient id="splashGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F5E6B8" />
                <stop offset="35%" stopColor="#C9A14A" />
                <stop offset="70%" stopColor="#8A6D2F" />
                <stop offset="100%" stopColor="#C9A14A" />
              </linearGradient>
              
              {/* Vertical gradient for depth */}
              <linearGradient id="splashGoldVert" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#F5E6B8" />
                <stop offset="40%" stopColor="#C9A14A" />
                <stop offset="100%" stopColor="#8A6D2F" />
              </linearGradient>
              
              {/* Glow filter */}
              <filter id="splashGlow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            
            {/* Main flowing stroke — abstract organic ribbon */}
            <path
              d="M50 8 C58 12, 62 20, 58 30 C54 40, 46 46, 40 52 C34 58, 30 66, 34 74 C38 82, 46 86, 52 90 C58 94, 64 96, 66 98"
              stroke="url(#splashGoldVert)"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#splashGlow)"
              opacity="0.95"
            />
            
            {/* Secondary interlocking stroke */}
            <path
              d="M46 14 C52 18, 56 24, 52 32 C48 40, 40 44, 36 50 C32 56, 34 64, 42 68 C50 72, 58 70, 62 64"
              stroke="url(#splashGold)"
              strokeWidth="3.5"
              strokeLinecap="round"
              opacity="0.85"
              filter="url(#splashGlow)"
            />
            
            {/* Upper flourish */}
            <path
              d="M44 20 C50 22, 56 26, 58 32 C60 38, 56 44, 50 46"
              stroke="url(#splashGold)"
              strokeWidth="2.8"
              strokeLinecap="round"
              opacity="0.75"
            />
            
            {/* Lower accent */}
            <path
              d="M54 72 C60 76, 64 82, 60 90 C56 96, 48 96, 46 92"
              stroke="url(#splashGold)"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.7"
            />
            
            {/* Decorative dots with varying sizes */}
            <circle cx="40" cy="54" r="3" fill="url(#splashGold)">
              <animate attributeName="opacity" values="0.7;1;0.7" dur="4s" repeatCount="indefinite" />
            </circle>
            <circle cx="60" cy="60" r="2.5" fill="url(#splashGold)" opacity="0.85" />
            <circle cx="50" cy="48" r="1.8" fill="url(#splashGold)" opacity="0.7" />
            <circle cx="46" cy="66" r="1.4" fill="url(#splashGold)" opacity="0.6" />
          </svg>
        </div>

        {/* ERUDITE Wordmark */}
        <h1
          className="mb-4 tracking-wide"
          style={{
            fontSize: 52,
            fontWeight: 600,
            fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
            background: 'linear-gradient(180deg, #F5E6B8 0%, #C9A14A 35%, #8A6D2F 65%, #C9A14A 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '0.12em',
            lineHeight: 1.1,
            transform: loaded ? 'translateY(0)' : 'translateY(10px)',
            opacity: loaded ? 1 : 0,
            transition: 'all 1s ease-out 0.4s',
            filter: 'drop-shadow(0 2px 12px rgba(201,165,74,0.3))',
          }}
        >
          ERUDITE
        </h1>

        {/* Subtitle with hairline rules */}
        <div
          className="flex items-center gap-6 mb-8"
          style={{
            transform: loaded ? 'translateY(0)' : 'translateY(10px)',
            opacity: loaded ? 1 : 0,
            transition: 'all 1s ease-out 0.6s',
          }}
        >
          <div
            style={{
              flex: 1,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(201,165,74,0.4))',
              maxWidth: 80,
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 300,
              textTransform: 'uppercase',
              letterSpacing: '0.4em',
              color: 'rgba(201,165,74,0.65)',
              whiteSpace: 'nowrap',
              fontFamily: "'Montserrat', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            REAL ESTATE CRM
          </span>
          <div
            style={{
              flex: 1,
              height: 1,
              background: 'linear-gradient(90deg, rgba(201,165,74,0.4), transparent)',
              maxWidth: 80,
            }}
          />
        </div>

        {/* Ornamental divider — diamond star with lines */}
        <div
          className="flex items-center justify-center gap-4 mb-6"
          style={{
            transform: loaded ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.95)',
            opacity: loaded ? 1 : 0,
            transition: 'all 1s ease-out 0.8s',
          }}
        >
          <div
            style={{
              flex: 1,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(201,165,74,0.3))',
              maxWidth: 60,
            }}
          />
          {/* Four-point diamond sparkle */}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <defs>
              <linearGradient id="splashStar" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F5E6B8" />
                <stop offset="50%" stopColor="#C9A14A" />
                <stop offset="100%" stopColor="#8A6D2F" />
              </linearGradient>
            </defs>
            <path
              d="M5 0 L6.5 4.5 L10 5 L6.5 5.5 L5 10 L3.5 5.5 L0 5 L3.5 4.5 Z"
              fill="url(#splashStar)"
              opacity="0.85"
            />
          </svg>
          <div
            style={{
              flex: 1,
              height: 1,
              background: 'linear-gradient(90deg, rgba(201,165,74,0.3), transparent)',
              maxWidth: 60,
            }}
          />
        </div>

        {/* Footer date */}
        <div
          style={{
            transform: loaded ? 'translateY(0)' : 'translateY(10px)',
            opacity: loaded ? 1 : 0,
            transition: 'all 1s ease-out 1s',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: 'rgba(201,165,74,0.55)',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            {currentTime}
          </span>
        </div>
      </div>

      {/* Subtle grain texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
          opacity: 0.03,
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  );
}