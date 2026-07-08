import React, { useState, useEffect } from 'react';
import AddLeadDialog from '@/components/leads/AddLeadDialog';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileDock from './MobileDock';
import ControlRail from '@/components/ui/ControlRail';
import FloatingDialer from '@/components/twilio/FloatingDialer';
import MouseGlowBackground from '@/components/dashboard/MouseGlowBackground';
import { Zap } from 'lucide-react';
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
      {/* Global Flow launcher — one tap to the Comms Command Center from anywhere */}
      {location.pathname !== '/flow' && (
        <button
          onClick={() => navigate('/flow')}
          title="Open Flow — Comms Command Center"
          style={{
            position: 'fixed', bottom: '88px', right: '18px', zIndex: 60,
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '12px 18px', borderRadius: '9999px', border: '1px solid rgba(201,162,75,0.55)',
            background: 'linear-gradient(135deg, #C9A24B 0%, #a87f2f 100%)',
            color: '#0B1F3A', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '13px',
            letterSpacing: '0.04em', cursor: 'pointer',
            boxShadow: '0 8px 28px rgba(201,162,75,0.45), 0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          <Zap size={16} strokeWidth={2.6} />
          FLOW
        </button>
      )}
      <MobileDock />
    </div>
  );
}