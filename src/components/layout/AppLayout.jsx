import React, { useState, useEffect } from 'react';
import AddLeadDialog from '@/components/leads/AddLeadDialog';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import QuickActionsPanel from '@/components/shared/QuickActionsPanel';
import CommandCenter from '@/components/shared/CommandCenter';
import HeroDock from '@/components/ui/HeroDock';
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
          className="fixed top-4 left-4 z-30 w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all shadow-lg"
          aria-label="Open menu"
        >
          <Menu className="w-4 h-4" />
        </button>
        <div className="page-enter">
          <Outlet />
        </div>
      </main>
      <MobileNav />
      <HeroDock />
      <QuickActionsPanel />
      {commandOpen && <CommandCenter onClose={() => setCommandOpen(false)} />}

      {/* Global floating New Lead button */}
      <button
        onClick={() => setAddLeadOpen(true)}
        title="Add New Lead (Buyer / Tenant)"
        className="fixed bottom-24 right-5 z-40 md:bottom-6 md:right-6 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
        style={{
          background: 'hsl(38 92% 50%)',
          boxShadow: '0 4px 20px rgba(245,159,10,0.45)',
        }}
      >
        <UserPlus className="w-5 h-5 text-black" />
      </button>

      <AddLeadDialog open={addLeadOpen} onClose={() => setAddLeadOpen(false)} />
    </div>
  );
}