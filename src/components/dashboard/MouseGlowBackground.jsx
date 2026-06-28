import { useRef, useEffect, memo } from 'react';

/**
 * Mouse-reactive ambient gradient background.
 *
 * Drives two CSS custom properties (--mouse-x / --mouse-y) via a rAF-throttled
 * mousemove listener. The gradient layers read those properties directly.
 *
 * Key design decisions to avoid bugs:
 * - Custom properties are set ONLY via direct DOM manipulation in useEffect,
 *   never in the React style prop — otherwise parent re-renders reset them.
 * - Coordinates are viewport-relative (clientX / innerWidth) because the glow
 *   div is position: fixed, so the gradient always aligns with the cursor.
 * - getBoundingClientRect is avoided entirely; window dimensions are read
 *   inside the rAF callback (after throttle) to prevent layout thrashing.
 * - Wrapped in memo so parent re-renders never re-render this component.
 *
 * Falls back to a static gradient on touch devices and prefers-reduced-motion.
 */
function MouseGlowBackground({ containerRef }) {
  const glowRef = useRef(null);

  useEffect(() => {
    const glow = glowRef.current;
    if (!glow) return;

    const isTouch =
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isTouch || reduced) return; // static gradient via initial CSS

    let rafId = null;
    let pendingX = 50;
    let pendingY = 50;

    const update = () => {
      rafId = null;
      if (!glowRef.current) return;
      glowRef.current.style.setProperty('--mouse-x', `${pendingX}%`);
      glowRef.current.style.setProperty('--mouse-y', `${pendingY}%`);
    };

    const onMouseMove = (e) => {
      pendingX = (e.clientX / window.innerWidth) * 100;
      pendingY = (e.clientY / window.innerHeight) * 100;
      if (rafId === null) rafId = requestAnimationFrame(update);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={glowRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483646,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
        // --mouse-x / --mouse-y are set via JS only (see useEffect), NOT here.
        // Putting them here would cause React to reset them on every parent re-render.
        background: `
          radial-gradient(circle 600px at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(201,162,75,0.12) 0%, transparent 50%),
          radial-gradient(circle 500px at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(100,80,160,0.08) 0%, transparent 45%),
          radial-gradient(circle 400px at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(30,60,110,0.10) 0%, transparent 40%)
        `,
      }}
    />
  );
}

export default memo(MouseGlowBackground);