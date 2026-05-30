import React from 'react';
import { Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function HomeButton() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate('/')}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      style={{
        width: 64,
        height: 64,
        borderRadius: '22%',
        background: 'linear-gradient(180deg, #F59F0A 0%, #D97706 100%)',
        boxShadow: '0 6px 18px rgba(0,0,0,0.45), 0 1px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'transform 0.15s ease',
      }}
      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.95)'; }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.95)'; }}
      onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {/* Inner top rim light */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: '22%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)',
          pointerEvents: 'none',
        }}
      />
      {/* Classic iOS gloss highlight (curved top bubble) */}
      <div
        className="absolute"
        style={{
          top: '3%',
          left: '8%',
          width: '84%',
          height: '52%',
          borderRadius: '50% 50% 40% 40% / 60% 60% 40% 40%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.52) 0%, rgba(255,255,255,0.08) 100%)',
          pointerEvents: 'none',
        }}
      />
      {/* Home glyph */}
      <Home
        className="w-8 h-8 text-white relative z-10"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.45))' }}
      />
    </button>
  );
}