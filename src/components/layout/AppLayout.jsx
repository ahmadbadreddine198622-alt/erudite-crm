import React, { useState, useEffect } from 'react';
import AddLeadDialog from '@/components/leads/AddLeadDialog';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileDock from './MobileDock';
import ControlRail from '@/components/ui/ControlRail';
import FloatingDialer from '@/components/twilio/FloatingDialer';
import KaraokeReader from '@/components/shared/KaraokeReader';
import MouseGlowBackground from '@/components/dashboard/MouseGlowBackground';
import { useNavigate, useLocation } from 'react-router-dom';

export default function AppLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="flex bg-background relative" style={{ minHeight: '100dvh' }}>
      {/* Mouse-reactive ambient glow — global, behind all pages */}
      <MouseGlowBackground />
      {/* Slide-over Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex-1 min-w-0 pb-36 md:pb-0 relative bg-background">
        {/* Persistent Control Rail — Home / Menu / Command */}
        {location.pathname !== '/' && <ControlRail onAddLead={() => setAddLeadOpen(true)} onNewListing={() => {}} />}
        
        <div className="page-enter w-full min-w-0">
          <Outlet />
        </div>
      </main>

      <AddLeadDialog open={addLeadOpen} onClose={() => setAddLeadOpen(false)} />
      <FloatingDialer />
      <KaraokeReader />
      <MobileDock />
    </div>
  );
}