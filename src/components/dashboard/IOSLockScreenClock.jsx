import React, { useState, useEffect } from 'react';

/**
 * IOSLockScreenClock — iPhone lock-screen style clock
 * Large chrome/silver liquid-metal numerals with date above
 * Asia/Dubai timezone, live-updating every second
 */
export default function IOSLockScreenClock() {
  const [time, setTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format for Asia/Dubai timezone
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Dubai',
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Dubai',
    });
  };

  const formattedDate = formatDate(time);
  const timeParts = formatTime(time).split(':');
  const hours = timeParts[0];
  const minutes = timeParts[1];
  const seconds = timeParts[2];

  if (!mounted) return null;

  return (
    <div
      className="w-full flex flex-col items-center justify-center mb-4"
      style={{
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Date line — compact bold label above time */}
      <div
        className="text-center mb-1"
        style={{
          opacity: 0.85,
          animation: 'clockDateFloat 4s ease-in-out infinite',
        }}
      >
        <span
          className="uppercase font-semibold tracking-widest"
          style={{
            fontFamily: "'Montserrat', 'Inter', sans-serif",
            fontSize: '13px',
            background: 'linear-gradient(180deg, #F5E6B8 0%, #C9A14A 50%, #8A6D2F 100%)',
            backgroundSize: '100% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 2px 8px rgba(201,161,74,0.3)',
            letterSpacing: '0.15em',
            animation: 'goldFlow 8s ease-in-out infinite',
          }}
        >
          {formattedDate.replace(',', ' ·')}
        </span>
      </div>

      {/* Time — large chrome/silver liquid-metal numerals */}
      <div
        className="flex items-baseline justify-center"
        style={{
          filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))',
        }}
      >
        {/* Hours:Minutes — large */}
        <span
          className="relative"
          style={{
            fontFamily: "'Montserrat', 'Inter', sans-serif",
            fontSize: 'clamp(48px, 12vw, 86px)',
            fontWeight: 700,
            background: 'linear-gradient(180deg, #F5E6B8 0%, #C9A14A 25%, #8A6D2F 50%, #C9A14A 75%, #F5E6B8 100%)',
            backgroundSize: '100% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.02em',
            animation: 'goldFlow 8s ease-in-out infinite',
            position: 'relative',
            zIndex: 2,
            filter: 'drop-shadow(0 4px 16px rgba(201,161,74,0.4))',
          }}
        >
          {hours}:{minutes}
        </span>

        {/* Seconds — smaller, dimmer trailing digits */}
        <span
          className="ml-1"
          style={{
            fontFamily: "'Montserrat', 'Inter', sans-serif",
            fontSize: 'clamp(18px, 5vw, 32px)',
            fontWeight: 500,
            background: 'linear-gradient(180deg, #F5E6B8 0%, #C9A14A 50%, #8A6D2F 100%)',
            backgroundSize: '100% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            opacity: 0.75,
            animation: 'goldFlow 8s ease-in-out infinite 0.3s',
            filter: 'drop-shadow(0 2px 8px rgba(201,161,74,0.3))',
          }}
        >
          {seconds}
        </span>
      </div>

      {/* Subtle glow behind numerals */}
      <div
        className="absolute -mt-8"
        style={{
          width: 'clamp(200px, 50vw, 400px)',
          height: 'clamp(60px, 20vw, 120px)',
          background: 'radial-gradient(ellipse, rgba(201,161,74,0.15) 0%, rgba(201,161,74,0.05) 50%, transparent 70%)',
          filter: 'blur(20px)',
          pointerEvents: 'none',
          animation: 'clockGlowPulse 6s ease-in-out infinite',
        }}
      />

      {/* CSS Animations */}
      <style>{`
        @keyframes goldFlow {
          0%, 100% { background-position: 0% 0%; }
          50% { background-position: 0% 100%; }
        }
        @keyframes clockDateFloat {
          0%, 100% { transform: translateY(0); opacity: 0.85; }
          50% { transform: translateY(-1px); opacity: 0.95; }
        }
        @keyframes clockGlowPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}