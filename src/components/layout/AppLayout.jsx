import React, { useState, useEffect } from 'react';
import AddLeadDialog from '@/components/leads/AddLeadDialog';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileDock from './MobileDock';
import CommandCenter from '@/components/shared/CommandCenter';

import { Menu, UserPlus, Home, Command, LayoutGrid } from 'lucide-react';
import FloatingDialer from '@/components/twilio/FloatingDialer';
import { useNavigate } from 'react-router-dom';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const navigate = useNavigate();

  // Global keyboard shortcut (Cmd/Ctrl + K)
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex bg-background" style={{ minHeight: '100dvh' }}>
      {/* Slide-over Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex-1 overflow-x-hidden pb-36 md:pb-0 relative bg-background">
        {/* Top-left button cluster */}
        <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 30, display: 'flex', gap: 10 }}>

        {/* Hamburger button */}
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          style={{
            position: 'fixed',
            top: 16,
            left: 16,
            zIndex: 30,
            width: 52,
            height: 52,
            borderRadius: 18,
            background: 'rgba(8,12,28,0.72)',
            backdropFilter: 'blur(40px) saturate(220%)',
            WebkitBackdropFilter: 'blur(40px) saturate(220%)',
            border: '1px solid rgba(255,255,255,0.13)',
            borderTopColor: 'rgba(255,255,255,0.22)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.10), 0 0 0 1px rgba(245,158,11,0.06)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            cursor: 'pointer',
            transition: 'all 0.22s cubic-bezier(0.34,1.26,0.64,1)',
            padding: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(245,158,11,0.12)';
            e.currentTarget.style.borderColor = 'rgba(245,158,11,0.35)';
            e.currentTarget.style.boxShadow = '0 10px 36px rgba(0,0,0,0.60), 0 0 20px rgba(245,158,11,0.15), inset 0 1px 0 rgba(255,255,255,0.14)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(8,12,28,0.72)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.10)';
          }}
        >
          {/* Top gloss */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
            borderRadius: '18px 18px 0 0',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 100%)',
            pointerEvents: 'none',
          }} />
          {/* 3 lines */}
          {[0,1,2].map(i => (
            <div key={i} style={{
              width: i === 1 ? 18 : 22,
              height: 2,
              borderRadius: 99,
              background: i === 0
                ? 'linear-gradient(90deg, hsl(38 92% 55%), rgba(255,255,255,0.6))'
                : 'rgba(255,255,255,0.45)',
              transition: 'all 0.22s ease',
              position: 'relative', zIndex: 1,
            }} />
          ))}
        </button>

        {/* Home button */}
        <button
          onClick={() => navigate('/')}
          aria-label="Go to Dashboard"
          style={{
            width: 52,
            height: 52,
            borderRadius: 18,
            background: 'rgba(245,158,11,0.10)',
            backdropFilter: 'blur(40px) saturate(220%)',
            WebkitBackdropFilter: 'blur(40px) saturate(220%)',
            border: '1px solid rgba(245,158,11,0.28)',
            borderTopColor: 'rgba(255,255,255,0.22)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.50), 0 0 20px rgba(245,158,11,0.08), inset 0 1px 0 rgba(255,255,255,0.10)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.22s cubic-bezier(0.34,1.26,0.64,1)',
            padding: 0,
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(245,158,11,0.18)';
            e.currentTarget.style.boxShadow = '0 10px 36px rgba(0,0,0,0.60), 0 0 28px rgba(245,158,11,0.22), inset 0 1px 0 rgba(255,255,255,0.14)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(245,158,11,0.10)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.50), 0 0 20px rgba(245,158,11,0.08), inset 0 1px 0 rgba(255,255,255,0.10)';
          }}
        >
          {/* Gloss */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
            borderRadius: '18px 18px 0 0',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, transparent 100%)',
            pointerEvents: 'none',
          }} />
          {/* Gold bloom */}
          <div style={{
            position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)',
            width: 36, height: 20, borderRadius: '50%',
            background: 'rgba(245,158,11,0.35)',
            filter: 'blur(10px)',
            pointerEvents: 'none',
          }} />
          <Home style={{
            width: 22, height: 22,
            color: 'hsl(38 92% 58%)',
            filter: 'drop-shadow(0 2px 6px rgba(245,158,11,0.5))',
            position: 'relative', zIndex: 1,
            strokeWidth: 2,
          }} />
        </button>

        {/* Dashboard — main dashboard only */}
        <button
          onClick={() => navigate('/')}
          aria-label="Dashboard"
          title="Dashboard"
          style={{
            width: 52,
            height: 52,
            borderRadius: 18,
            background: 'rgba(59,130,246,0.10)',
            backdropFilter: 'blur(40px) saturate(220%)',
            WebkitBackdropFilter: 'blur(40px) saturate(220%)',
            border: '1px solid rgba(59,130,246,0.28)',
            borderTopColor: 'rgba(255,255,255,0.18)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.50), 0 0 20px rgba(59,130,246,0.08), inset 0 1px 0 rgba(255,255,255,0.10)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.22s cubic-bezier(0.34,1.26,0.64,1)',
            padding: 0,
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(59,130,246,0.20)';
            e.currentTarget.style.boxShadow = '0 10px 36px rgba(0,0,0,0.60), 0 0 28px rgba(59,130,246,0.25), inset 0 1px 0 rgba(255,255,255,0.14)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(59,130,246,0.10)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.50), 0 0 20px rgba(59,130,246,0.08), inset 0 1px 0 rgba(255,255,255,0.10)';
          }}
        >
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
            borderRadius: '18px 18px 0 0',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, transparent 100%)',
            pointerEvents: 'none',
          }} />
          <LayoutGrid style={{
            width: 21, height: 21,
            color: '#93c5fd',
            filter: 'drop-shadow(0 2px 6px rgba(59,130,246,0.5))',
            position: 'relative', zIndex: 1,
            strokeWidth: 2,
          }} />
        </button>

        {/* Cmd+K palette trigger */}
        <button
          onClick={() => setCommandOpen(prev => !prev)}
          aria-label="Command palette (⌘K)"
          title="Command palette (⌘K)"
          style={{
            width: 52,
            height: 52,
            borderRadius: 18,
            background: 'rgba(139,92,246,0.10)',
            backdropFilter: 'blur(40px) saturate(220%)',
            WebkitBackdropFilter: 'blur(40px) saturate(220%)',
            border: '1px solid rgba(139,92,246,0.28)',
            borderTopColor: 'rgba(255,255,255,0.18)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.50), 0 0 20px rgba(139,92,246,0.08), inset 0 1px 0 rgba(255,255,255,0.10)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.22s cubic-bezier(0.34,1.26,0.64,1)',
            padding: 0,
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(139,92,246,0.20)';
            e.currentTarget.style.boxShadow = '0 10px 36px rgba(0,0,0,0.60), 0 0 28px rgba(139,92,246,0.25), inset 0 1px 0 rgba(255,255,255,0.14)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(139,92,246,0.10)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.50), 0 0 20px rgba(139,92,246,0.08), inset 0 1px 0 rgba(255,255,255,0.10)';
          }}
        >
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
            borderRadius: '18px 18px 0 0',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, transparent 100%)',
            pointerEvents: 'none',
          }} />
          <Command style={{
            width: 21, height: 21,
            color: '#c4b5fd',
            filter: 'drop-shadow(0 2px 6px rgba(139,92,246,0.5))',
            position: 'relative', zIndex: 1,
            strokeWidth: 2,
          }} />
        </button>

        </div> {/* end top-left cluster */}
        <div className="page-enter">
          <Outlet />
        </div>
      </main>

      {commandOpen && <CommandCenter onClose={() => setCommandOpen(false)} />}

      <AddLeadDialog open={addLeadOpen} onClose={() => setAddLeadOpen(false)} />
      <FloatingDialer />
      <MobileDock />
    </div>
  );
}