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
            color: 'rgba(255,255,255,0.75)',
            textShadow: '0 2px 8px rgba(0,0,0,0.4), 0 0 12px rgba(255,255,255,0.15)',
            letterSpacing: '0.15em',
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
            background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(192,192,192,0.85) 25%, rgba(140,140,140,0.75) 50%, rgba(180,180,180,0.85) 75%, rgba(255,255,255,0.95) 100%)',
            backgroundSize: '100% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.02em',
            animation: 'chromeFlow 8s ease-in-out infinite',
            position: 'relative',
            zIndex: 2,
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
            background: 'linear-gradient(180deg, rgba(200,200,200,0.7) 0%, rgba(150,150,150,0.5) 50%, rgba(180,180,180,0.6) 100%)',
            backgroundSize: '100% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            opacity: 0.65,
            animation: 'chromeFlow 8s ease-in-out infinite 0.3s',
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
          background: 'radial-gradient(ellipse, rgba(255,255,255,0.08) 0%, transparent 70%)',
          filter: 'blur(20px)',
          pointerEvents: 'none',
          animation: 'clockGlowPulse 6s ease-in-out infinite',
        }}
      />

      {/* CSS Animations */}
      <style>{`
        @keyframes chromeFlow {
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