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
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {/* Back button — lit case (slate glow) */}
      <button
        onClick={() => navigate(-1)}
        title="Go Back"
        style={{
          width: 48,
          height: 48,
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: '1px solid rgba(212,175,55,0.24)',
          background: 'radial-gradient(130% 130% at 30% 18%, rgba(154,166,192,0.18), rgba(154,166,192,0.04))',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          boxShadow: '0 0 28px -8px rgba(154,166,192,0.5), inset 0 1px 0 rgba(255,255,255,0.14)',
          color: 'rgb(195,204,221)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-3px)';
          e.currentTarget.style.boxShadow = '0 0 36px -6px rgba(154,166,192,0.65), inset 0 1px 0 rgba(255,255,255,0.18)';
          e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 0 28px -8px rgba(154,166,192,0.5), inset 0 1px 0 rgba(255,255,255,0.14)';
          e.currentTarget.style.borderColor = 'rgba(212,175,55,0.24)';
        }}
      >
        <ChevronLeft size={20} strokeWidth={1.6} />
      </button>

      {/* Home button — lit case (gold glow) */}
      <button
        onClick={() => navigate('/')}
        title="Go to Home"
        style={{
          width: 48,
          height: 48,
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: '1px solid rgba(212,175,55,0.28)',
          background: 'radial-gradient(130% 130% at 30% 18%, rgba(212,175,55,0.20), rgba(212,175,55,0.04))',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          boxShadow: '0 0 28px -8px rgba(212,175,55,0.55), inset 0 1px 0 rgba(255,255,255,0.16)',
          color: '#eccd72',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-3px)';
          e.currentTarget.style.boxShadow = '0 0 36px -6px rgba(212,175,55,0.7), inset 0 1px 0 rgba(255,255,255,0.2)';
          e.currentTarget.style.borderColor = 'rgba(212,175,55,0.45)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 0 28px -8px rgba(212,175,55,0.55), inset 0 1px 0 rgba(255,255,255,0.16)';
          e.currentTarget.style.borderColor = 'rgba(212,175,55,0.28)';
        }}
      >
        <Home size={20} strokeWidth={1.6} />
      </button>
    </div>
  );
}