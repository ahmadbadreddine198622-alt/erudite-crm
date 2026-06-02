import React, { useState, useEffect } from 'react';
import AddLeadDialog from '@/components/leads/AddLeadDialog';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileDock from './MobileDock';
import CommandCenter from '@/components/shared/CommandCenter';

import { Menu, UserPlus } from 'lucide-react';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [addLeadOpen, setAddLeadOpen] = useState(false);

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
        <div className="page-enter">
          <Outlet />
        </div>
      </main>

      {commandOpen && <CommandCenter onClose={() => setCommandOpen(false)} />}

      <AddLeadDialog open={addLeadOpen} onClose={() => setAddLeadOpen(false)} />
      <MobileDock />
    </div>
  );
}