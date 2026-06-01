import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ChevronLeft } from 'lucide-react';

const STORAGE_KEY = 'floating_nav_pill_pos';

export default function FloatingNavButtons() {
  const navigate = useNavigate();
  const ref = useRef(null);
  const dragging = useRef(false);
  const didDrag = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { x: window.innerWidth / 2 - 60, y: window.innerHeight - 120 };
  });

  const onPointerDown = useCallback((e) => {
    // Only start drag from the pill background, not buttons
    if (e.target.closest('button')) return;
    e.preventDefault();
    dragging.current = true;
    didDrag.current = false;
    const rect = ref.current.getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    ref.current.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    didDrag.current = true;
    const w = ref.current?.offsetWidth || 120;
    const h = ref.current?.offsetHeight || 52;
    const x = Math.max(0, Math.min(window.innerWidth - w, e.clientX - offset.current.x));
    const y = Math.max(0, Math.min(window.innerHeight - h, e.clientY - offset.current.y));
    setPos({ x, y });
  }, []);

  const onPointerUp = useCallback((e) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (didDrag.current) {
      const w = ref.current?.offsetWidth || 120;
      const h = ref.current?.offsetHeight || 52;
      const x = Math.max(0, Math.min(window.innerWidth - w, e.clientX - offset.current.x));
      const y = Math.max(0, Math.min(window.innerHeight - h, e.clientY - offset.current.y));
      const newPos = { x, y };
      setPos(newPos);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPos));
    }
  }, []);

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 9999,
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'none',
        display: 'flex',
        alignItems: 'center',
        borderRadius: 999,
        overflow: 'hidden',
        background: 'rgba(20, 28, 48, 0.75)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.18)',
        borderTopColor: 'rgba(255,255,255,0.28)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
      }}
    >
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        title="Go Back"
        style={{
          width: 52,
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          borderRight: '1px solid rgba(255,255,255,0.1)',
          transition: 'background 0.15s ease',
          color: 'rgba(255,255,255,0.75)',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <ChevronLeft size={20} />
      </button>

      {/* Divider dot */}
      <div style={{
        width: 4,
        height: 4,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.2)',
        margin: '0 2px',
        flexShrink: 0,
      }} />

      {/* Home button */}
      <button
        onClick={() => navigate('/')}
        title="Go to Home"
        style={{
          width: 52,
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          transition: 'background 0.15s ease',
          color: 'hsl(38 92% 55%)',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.12)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <Home size={20} />
      </button>
    </div>
  );
}