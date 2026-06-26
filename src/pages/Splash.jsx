import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * ERUDITE Splash Screen — 2026 Premium Luxury Design
 * Cream paper texture background with matte metallic gold branding
 * Clean, refined, expensive — matching reference brand identity
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

    // Auto-redirect after animation
    const timer = setTimeout(() => {
      navigate('/');
    }, 3500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{
        background: '#F8F4ED',
      }}
    >
      {/* Subtle paper texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.4\'/%3E%3C/svg%3E")',
          opacity: 0.5,
        }}
      />
      
      {/* Main card */}
      <div
        className="relative flex flex-col items-center px-20 py-16"
        style={{
          borderRadius: 36,
          background: 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: '1px solid rgba(188,157,92,0.15)',
          boxShadow: '0 40px 120px rgba(188,157,92,0.12), inset 0 1px 0 rgba(255,255,255,0.8)',
          transform: loaded ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.98)',
          opacity: loaded ? 1 : 0,
          transition: 'all 1.4s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Ornate Calligraphic Logo Mark */}
        <div
          className="relative mb-10"
          style={{
            transform: loaded ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.96)',
            opacity: loaded ? 1 : 0,
            transition: 'all 1.2s ease-out 0.15s',
          }}
        >
          <svg width="140" height="140" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              {/* Matte metallic gold gradient — matching reference */}
              <linearGradient id="brandGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#C9B578" />
                <stop offset="35%" stopColor="#BC9D5C" />
                <stop offset="70%" stopColor="#A88848" />
                <stop offset="100%" stopColor="#BC9D5C" />
              </linearGradient>
              
              {/* Vertical gradient for depth */}
              <linearGradient id="brandGoldVert" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#C9B578" />
                <stop offset="40%" stopColor="#BC9D5C" />
                <stop offset="100%" stopColor="#A88848" />
              </linearGradient>
              
              {/* Subtle glow filter */}
              <filter id="brandGlow">
                <feGaussianBlur stdDeviation="1.2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            
            {/* Main flowing stroke — abstract organic ribbon, angular + curved */}
            <path
              d="M50 5 C57 10, 61 18, 57 28 C53 38, 45 44, 39 50 C33 56, 29 64, 33 72 C37 80, 45 85, 51 89 C57 93, 63 95, 65 97"
              stroke="url(#brandGoldVert)"
              strokeWidth="4.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#brandGlow)"
              opacity="0.95"
            />
            
            {/* Secondary interlocking stroke */}
            <path
              d="M46 12 C51 17, 55 23, 51 31 C47 39, 39 43, 35 49 C31 55, 33 63, 41 67 C49 71, 57 69, 61 63"
              stroke="url(#brandGold)"
              strokeWidth="3.2"
              strokeLinecap="round"
              opacity="0.88"
              filter="url(#brandGlow)"
            />
            
            {/* Upper flourish — elegant sweep */}
            <path
              d="M44 19 C49 22, 55 26, 57 32 C59 38, 55 43, 49 45"
              stroke="url(#brandGold)"
              strokeWidth="2.6"
              strokeLinecap="round"
              opacity="0.78"
            />
            
            {/* Lower accent — balancing curve */}
            <path
              d="M53 71 C59 75, 63 81, 59 88 C55 94, 47 94, 45 90"
              stroke="url(#brandGold)"
              strokeWidth="2.3"
              strokeLinecap="round"
              opacity="0.72"
            />
            
            {/* Inner detail stroke */}
            <path
              d="M48 33 C51 37, 53 42, 49 48 C45 52, 41 54, 39 52"
              stroke="url(#brandGoldVert)"
              strokeWidth="1.8"
              strokeLinecap="round"
              opacity="0.68"
            />
            
            {/* Decorative dots — traditional Arabic calligraphy style */}
            <circle cx="39" cy="53" r="2.8" fill="url(#brandGold)">
              <animate attributeName="opacity" values="0.75;1;0.75" dur="5s" repeatCount="indefinite" />
            </circle>
            <circle cx="59" cy="59" r="2.3" fill="url(#brandGold)" opacity="0.88" />
            <circle cx="49" cy="47" r="1.6" fill="url(#brandGold)" opacity="0.72" />
            <circle cx="45" cy="63" r="1.3" fill="url(#brandGold)" opacity="0.62" />
            <circle cx="55" cy="51" r="1.1" fill="url(#brandGold)" opacity="0.55" />
          </svg>
        </div>

        {/* ERUDITE Wordmark — High-contrast serif (Trajan/Cormorant style) */}
        <h1
          className="mb-5 tracking-wide"
          style={{
            fontSize: 56,
            fontWeight: 600,
            fontFamily: "'Cormorant Garamond', 'Trajan Pro', 'Playfair Display', Georgia, serif",
            color: '#BC9D5C',
            letterSpacing: '0.18em',
            lineHeight: 1.1,
            transform: loaded ? 'translateY(0)' : 'translateY(12px)',
            opacity: loaded ? 1 : 0,
            transition: 'all 1.2s ease-out 0.3s',
            textShadow: '0 1px 3px rgba(188,157,92,0.15)',
          }}
        >
          ERUDITE
        </h1>

        {/* Subtitle with hairline rules */}
        <div
          className="flex items-center gap-8 mb-9"
          style={{
            transform: loaded ? 'translateY(0)' : 'translateY(12px)',
            opacity: loaded ? 1 : 0,
            transition: 'all 1.2s ease-out 0.45s',
          }}
        >
          <div
            style={{
              flex: 1,
              height: 1,
              background: 'linear-gradient(90deg, transparent, #BC9D5C)',
              maxWidth: 90,
              opacity: 0.5,
            }}
          />
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.38em',
              color: '#BC9D5C',
              whiteSpace: 'nowrap',
              fontFamily: "'Montserrat', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              opacity: 0.75,
            }}
          >
            REAL ESTATE CRM
          </span>
          <div
            style={{
              flex: 1,
              height: 1,
              background: 'linear-gradient(90deg, #BC9D5C, transparent)',
              maxWidth: 90,
              opacity: 0.5,
            }}
          />
        </div>

        {/* Ornamental divider — diamond star with tapering lines */}
        <div
          className="flex items-center justify-center gap-5"
          style={{
            transform: loaded ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.96)',
            opacity: loaded ? 1 : 0,
            transition: 'all 1.2s ease-out 0.6s',
          }}
        >
          <div
            style={{
              flex: 1,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(188,157,92,0.4))',
              maxWidth: 70,
            }}
          />
          {/* Four-point diamond sparkle */}
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <defs>
              <linearGradient id="brandStar" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#C9B578" />
                <stop offset="50%" stopColor="#BC9D5C" />
                <stop offset="100%" stopColor="#A88848" />
              </linearGradient>
            </defs>
            <path
              d="M5.5 0 L6.8 4.2 L11 5.5 L6.8 6.8 L5.5 11 L4.2 6.8 L0 5.5 L4.2 4.2 Z"
              fill="url(#brandStar)"
              opacity="0.85"
            />
          </svg>
          <div
            style={{
              flex: 1,
              height: 1,
              background: 'linear-gradient(90deg, rgba(188,157,92,0.4), transparent)',
              maxWidth: 70,
            }}
          />
        </div>

        {/* Footer date */}
        <div
          className="mt-10"
          style={{
            transform: loaded ? 'translateY(0)' : 'translateY(12px)',
            opacity: loaded ? 1 : 0,
            transition: 'all 1.2s ease-out 0.75s',
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              color: '#BC9D5C',
              fontFamily: "'Montserrat', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              opacity: 0.65,
            }}
          >
            {currentTime}
          </span>
        </div>
      </div>
    </div>
  );
}