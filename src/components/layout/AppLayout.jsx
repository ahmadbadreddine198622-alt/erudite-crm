import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import QuickActionsPanel from '@/components/shared/QuickActionsPanel';
import CommandCenter from '@/components/shared/CommandCenter';
import HeroDock from '@/components/ui/HeroDock';
import { Menu } from 'lucide-react';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

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

      <main className="flex-1 overflow-x-hidden pb-36 md:pb-0 relative">
        {/* Hamburger button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-30 w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all shadow-lg"
          aria-label="Open menu"
        >
          <Menu className="w-4 h-4" />
        </button>
        <Outlet />
      </main>
      <MobileNav />
      <HeroDock />
      <QuickActionsPanel />
      {commandOpen && <CommandCenter onClose={() => setCommandOpen(false)} />}
    </div>
  );
}