import React, { useEffect, useState } from 'react';

export default function EruditeSplash({ onComplete }) {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Hold for 2 seconds, then fade out
    const holdTimer = setTimeout(() => {
      setIsFading(true);
      // Fade duration is 0.8s via CSS, then call onComplete
      const fadeTimer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 800);
      return () => clearTimeout(fadeTimer);
    }, 2000);

    return () => clearTimeout(holdTimer);
  }, [onComplete]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[100]"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.03) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(59,130,246,0.04) 0%, transparent 50%), linear-gradient(180deg, #0a0f1a 0%, #0d121f 40%, #0a0f1a 100%)',
        opacity: isFading ? 0 : 1,
        transition: 'opacity 0.8s ease-out',
        pointerEvents: 'none',
      }}
    >
      <div className="flex flex-col items-center justify-center" style={{ transform: isFading ? 'scale(0.98)' : 'scale(1)', transition: 'transform 0.8s ease-out' }}>
        {/* Top Rule with notch detail */}
        <div className="relative mb-8" style={{ width: '280px', height: '2px' }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent 0%, hsl(38 92% 50%) 20%, hsl(38 92% 55%) 50%, hsl(38 92% 50%) 80%, transparent 100%)',
              boxShadow: '0 0 8px rgba(245,158,11,0.4)',
            }}
          />
          {/* Subtle rectangular notch toward right end */}
          <div
            style={{
              position: 'absolute',
              right: '60px',
              top: '-1px',
              width: '24px',
              height: '4px',
              background: 'linear-gradient(180deg, rgba(245,158,11,0.3) 0%, hsl(38 92% 50%) 50%, rgba(245,158,11,0.3) 100%)',
              borderRadius: '1px',
              filter: 'blur(0.5px)',
            }}
          />
          {/* Faint light glint */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '-2px',
              width: '60px',
              height: '6px',
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
              transform: 'translateX(-50%)',
              filter: 'blur(2px)',
              borderRadius: '3px',
            }}
          />
        </div>

        {/* ERUDITE wordmark - metallic gradient */}
        <h1
          className="font-serif font-bold uppercase tracking-widest"
          style={{
            fontSize: 'clamp(48px, 10vw, 96px)',
            lineHeight: 1,
            fontFamily: "'Cormorant Garamond', serif",
            background: 'linear-gradient(135deg, #e8e8e8 0%, #f5f5f5 15%, hsl(38 92% 55%) 50%, hsl(38 92% 50%) 85%, #b89650 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 2px 8px rgba(0,0,0,0.3)',
            letterSpacing: '0.15em',
            marginBottom: '12px',
          }}
        >
          ERUDITE
        </h1>

        {/* REAL ESTATE subtitle */}
        <p
          className="font-serif uppercase tracking-[0.25em]"
          style={{
            fontSize: 'clamp(12px, 2.5vw, 18px)',
            lineHeight: 1,
            fontFamily: "'Cormorant Garamond', serif",
            color: 'hsl(38 92% 50%)',
            textShadow: '0 1px 4px rgba(0,0,0,0.4)',
            marginBottom: '20px',
            fontWeight: 500,
          }}
        >
          REAL ESTATE
        </p>

        {/* Ornamental divider - two strokes with center tick */}
        <div className="flex items-center gap-3 mb-6" style={{ opacity: 0.8 }}>
          <div style={{ width: '40px', height: '1px', background: 'linear-gradient(90deg, transparent, hsl(38 92% 50%))' }} />
          <div
            style={{
              width: '6px',
              height: '6px',
              background: 'hsl(38 92% 50%)',
              transform: 'rotate(45deg)',
              boxShadow: '0 0 6px rgba(245,158,11,0.5)',
            }}
          />
          <div style={{ width: '40px', height: '1px', background: 'linear-gradient(90deg, hsl(38 92% 50%), transparent)' }} />
        </div>

        {/* HOLD THE LINE tagline */}
        <p
          className="uppercase tracking-[0.2em]"
          style={{
            fontSize: 'clamp(10px, 2vw, 13px)',
            lineHeight: 1,
            color: 'rgba(255,255,255,0.65)',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
            fontWeight: 500,
          }}
        >
          HOLD THE LINE
        </p>
      </div>
    </div>
  );
}