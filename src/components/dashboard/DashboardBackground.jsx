import { useEffect, useRef } from 'react';

/**
 * Fixed full-bleed mouse-reactive background layer.
 * Writes CSS variables DIRECTLY to the glow element's style — zero React state,
 * zero re-renders of the workspace grid or Property Finder.
 *
 * Three layers:
 *  (a) Static radial field + base gradient
 *  (b) Cursor glow (900px circle, rAF-throttled, disabled on touch/reduced-motion)
 *  (c) Vignette
 */
export default function DashboardBackground() {
  const glowRef = useRef(null);

  useEffect(() => {
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isTouch || reducedMotion) return;

    let rafId;
    const handleMouseMove = (e) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const el = glowRef.current;
        if (!el) return;
        el.style.setProperty('--mouse-x', `${e.clientX}px`);
        el.style.setProperty('--mouse-y', `${e.clientY}px`);
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      {/* (a) Static radial field + base gradient */}
      <div className="absolute inset-0" style={{
        background: [
          'radial-gradient(1100px 700px at 18% 8%, rgba(109,77,246,0.16), transparent 60%)',
          'radial-gradient(1000px 800px at 88% 92%, rgba(212,175,55,0.10), transparent 62%)',
          'radial-gradient(900px 700px at 95% 4%, rgba(61,109,246,0.08), transparent 60%)',
          'linear-gradient(160deg, #0a0e1a 0%, #080b14 45%, #06080f 100%)',
        ].join(', '),
      }} />

      {/* (b) Cursor glow */}
      <div ref={glowRef} className="absolute" style={{
        width: '900px',
        height: '900px',
        left: 0,
        top: 0,
        marginLeft: '-450px',
        marginTop: '-450px',
        background: 'radial-gradient(circle, rgba(109,77,246,0.20), rgba(212,175,55,0.07) 38%, transparent 68%)',
        filter: 'blur(36px)',
        transform: 'translate3d(var(--mouse-x, 50vw), var(--mouse-y, 50vh), 0)',
        transition: 'transform 0.32s cubic-bezier(0.22, 0.61, 0.36, 1)',
        willChange: 'transform',
      }} />

      {/* (c) Vignette */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(120% 120% at 50% 35%, transparent 55%, rgba(0,0,0,0.45) 100%)',
      }} />
    </div>
  );
}