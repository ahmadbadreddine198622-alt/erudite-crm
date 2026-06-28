import { useRef, useEffect } from 'react';

/**
 * Mouse-reactive ambient gradient background.
 *
 * Drives two CSS custom properties (--mouse-x / --mouse-y) via a rAF-throttled
 * mousemove listener on the dashboard container. The gradient layers use CSS
 * transitions for smooth trailing — zero React re-renders on cursor move.
 *
 * Falls back to a static gradient on touch devices and prefers-reduced-motion.
 */
export default function MouseGlowBackground({ containerRef }) {
  const glowRef = useRef(null);

  useEffect(() => {
    const isTouch =
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isTouch || reduced) return; // static fallback via CSS

    const container = containerRef?.current || glowRef.current?.parentElement;
    if (!container) return;

    let rafId = null;
    let pendingX = 50;
    let pendingY = 50;

    const update = () => {
      rafId = null;
      glowRef.current.style.setProperty('--mouse-x', `${pendingX}%`);
      glowRef.current.style.setProperty('--mouse-y', `${pendingY}%`);
    };

    const onMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      pendingX = ((e.clientX - rect.left) / rect.width) * 100;
      pendingY = ((e.clientY - rect.top) / rect.height) * 100;
      if (rafId === null) rafId = requestAnimationFrame(update);
    };

    container.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => {
      container.removeEventListener('mousemove', onMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [containerRef]);

  return (
    <div
      ref={glowRef}
      aria-hidden="true"
      className="mouse-glow-bg"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        '--mouse-x': '50%',
        '--mouse-y': '50%',
        background: `
          radial-gradient(circle 600px at var(--mouse-x) var(--mouse-y), rgba(201,162,75,0.07) 0%, transparent 50%),
          radial-gradient(circle 500px at var(--mouse-x) var(--mouse-y), rgba(100,80,160,0.05) 0%, transparent 45%),
          radial-gradient(circle 400px at var(--mouse-x) var(--mouse-y), rgba(30,60,110,0.06) 0%, transparent 40%)
        `,
        transition: 'background 0.18s ease-out',
      }}
    />
  );
}