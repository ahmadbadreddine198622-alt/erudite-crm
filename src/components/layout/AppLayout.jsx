import React, { useState } from 'react';
import AddLeadDialog from '@/components/leads/AddLeadDialog';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileDock from './MobileDock';
import CommandCenter from '@/components/shared/CommandCenter';

export default function AppLayout() {
  const [commandOpen, setCommandOpen] = useState(false);
  const [addLeadOpen, setAddLeadOpen] = useState(false);

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
      {/* Permanent icon-only sidebar */}
      <Sidebar />

      <main className="flex-1 overflow-x-hidden pb-36 md:pb-0 relative bg-background" style={{ marginLeft: 64 }}>
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