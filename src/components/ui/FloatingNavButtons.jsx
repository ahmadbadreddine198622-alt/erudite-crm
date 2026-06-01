import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ChevronLeft } from 'lucide-react';

const STORAGE_KEY = 'floating_nav_pos';

function useDraggable(storageKey, defaultPos) {
  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return defaultPos;
  });

  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const ref = useRef(null);

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    const rect = ref.current.getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    ref.current.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const maxX = window.innerWidth - 52;
    const maxY = window.innerHeight - 52;
    const x = Math.max(0, Math.min(maxX, e.clientX - offset.current.x));
    const y = Math.max(0, Math.min(maxY, e.clientY - offset.current.y));
    setPos({ x, y });
  }, []);

  const onPointerUp = useCallback((e) => {
    if (!dragging.current) return;
    dragging.current = false;
    const maxX = window.innerWidth - 52;
    const maxY = window.innerHeight - 52;
    const x = Math.max(0, Math.min(maxX, e.clientX - offset.current.x));
    const y = Math.max(0, Math.min(maxY, e.clientY - offset.current.y));
    const newPos = { x, y };
    setPos(newPos);
    localStorage.setItem(storageKey, JSON.stringify(newPos));
  }, [storageKey]);

  return { pos, ref, onPointerDown, onPointerMove, onPointerUp };
}

export default function FloatingNavButtons() {
  const navigate = useNavigate();
  const homeClickRef = useRef(false);
  const backClickRef = useRef(false);

  const home = useDraggable(STORAGE_KEY + '_home', { x: window.innerWidth - 64, y: window.innerHeight * 0.75 });
  const back = useDraggable(STORAGE_KEY + '_back', { x: window.innerWidth - 64, y: window.innerHeight * 0.75 - 64 });

  const handleHomePointerDown = (e) => {
    homeClickRef.current = true;
    home.onPointerDown(e);
  };
  const handleHomePointerUp = (e) => {
    const wasClick = homeClickRef.current;
    home.onPointerUp(e);
    if (wasClick) navigate('/');
    homeClickRef.current = false;
  };
  const handleHomePointerMove = (e) => {
    homeClickRef.current = false;
    home.onPointerMove(e);
  };

  const handleBackPointerDown = (e) => {
    backClickRef.current = true;
    back.onPointerDown(e);
  };
  const handleBackPointerUp = (e) => {
    const wasClick = backClickRef.current;
    back.onPointerUp(e);
    if (wasClick) navigate(-1);
    backClickRef.current = false;
  };
  const handleBackPointerMove = (e) => {
    backClickRef.current = false;
    back.onPointerMove(e);
  };

  const btnStyle = (pos) => ({
    position: 'fixed',
    left: pos.x,
    top: pos.y,
    zIndex: 9999,
    width: 48,
    height: 48,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'grab',
    userSelect: 'none',
    touchAction: 'none',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    transition: 'box-shadow 0.15s ease',
  });

  return (
    <>
      {/* Home button */}
      <div
        ref={home.ref}
        style={{
          ...btnStyle(home.pos),
          background: 'rgba(245,158,11,0.9)',
          border: '1px solid rgba(255,200,80,0.5)',
          backdropFilter: 'blur(10px)',
        }}
        onPointerDown={handleHomePointerDown}
        onPointerMove={handleHomePointerMove}
        onPointerUp={handleHomePointerUp}
        title="Go to Home"
      >
        <Home className="w-5 h-5 text-black" />
      </div>

      {/* Back button */}
      <div
        ref={back.ref}
        style={{
          ...btnStyle(back.pos),
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.2)',
          backdropFilter: 'blur(10px)',
        }}
        onPointerDown={handleBackPointerDown}
        onPointerMove={handleBackPointerMove}
        onPointerUp={handleBackPointerUp}
        title="Go Back"
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </div>
    </>
  );
}