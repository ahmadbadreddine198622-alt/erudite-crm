/**
 * MobileDock — Redesigned for mobile portrait ONLY.
 * Desktop and landscape keep original dock unchanged.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Building2, KanbanSquare, MessageCircle, FileSignature, Plus, Clock, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ALL_APPS } from '@/lib/navApps';
import ExtremeLiquidIcon from '@/components/ui/ExtremeLiquidIcon';
import AppPickerModal from '@/components/mobile/AppPickerModal';

const SZ = 48;
const HOME_SZ = 64;

// Fixed dock order: Landlord · Pipeline · [HOME] · WhatsApp · Forms
// Colors pulled directly from ALL_APPS gradients for perfect harmony
const DOCK_APPS = [
  { path: '/landlords', appKey: 'landlords', gradient: 'from-amber-500 to-orange-700', glowColor: 'rgba(245,158,11,0.40)' },
  { path: '/pipeline', appKey: 'pipeline', gradient: 'from-indigo-500 to-purple-700', glowColor: 'rgba(106,90,205,0.40)' },
  { path: '/whatsapp', appKey: 'whatsapp', gradient: 'from-green-500 to-green-700', glowColor: 'rgba(34,197,94,0.40)' },
  { path: '/form-a-referral', appKey: 'forma', gradient: 'from-amber-500 to-orange-700', glowColor: 'rgba(245,158,11,0.40)' },
];

// Quick actions per dock app
const QUICK_ACTIONS = {
  landlords: [
    { label: 'Add Landlord', icon: Building2, path: '/landlords' },
    { label: 'View Listings', icon: KanbanSquare, path: '/landlords' },
    { label: 'Recent', icon: Clock, path: '/landlords' },
  ],
  pipeline: [
    { label: 'New Lead', icon: Plus, path: '/leads' },
    { label: 'Hot Leads', icon: Star, path: '/leads' },
    { label: "Today's Follow-ups", icon: Clock, path: '/reminders' },
  ],
  whatsapp: [
    { label: 'New Message', icon: MessageCircle, path: '/whatsapp' },
    { label: 'Unread', icon: MessageCircle, path: '/whatsapp' },
    { label: 'Broadcasts', icon: Star, path: '/broadcasts' },
  ],
  forma: [
    { label: 'New Form A', icon: FileSignature, path: '/form-a-referral' },
    { label: 'Drafts', icon: FileSignature, path: '/form-a-inbox' },
    { label: 'Templates', icon: FileSignature, path: '/email-templates' },
  ],
};

function PortraitDockIcon({ app, active, onPress, onLongPress }) {
  const { icon: Icon, label, gradient, glowColor } = app || {};
  const pressTimer = useRef(null);
  if (!Icon) return null;

  const handleTouchStart = () => { pressTimer.current = setTimeout(() => onLongPress(), 600); };
  const handleTouchEnd = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

  return (
    <button
      type="button" onClick={onPress} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart} onMouseUp={handleTouchEnd} onMouseLeave={handleTouchEnd}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
    >
      <div className="flex flex-col items-center" style={{ gap: 4 }}>
        <ExtremeLiquidIcon icon={Icon} gradient={gradient} glowColor={glowColor || 'rgba(255,255,255,0.25)'}
          size={SZ} iconSize={Math.round(SZ * 0.50)} active={active} badge={0} tiltX={0} tiltY={0} index={0} isDragging={false} />
        {active && <div style={{ width: 4, height: 4, borderRadius: 2, background: '#D4AF37', boxShadow: '0 0 8px rgba(212,175,55,0.5)' }} />}
      </div>
    </button>
  );
}

function QuickActionsPopover({ actions, position, onClose, navigate }) {
  if (!actions || !position) return null;
  return (
    <>
      <div className="fixed inset-0 z-[10000]" onClick={onClose} style={{ background: 'transparent' }} />
      <div className="absolute z-[10001] rounded-2xl overflow-hidden" style={{
        left: position.left, bottom: position.bottom, transform: 'translateX(-50%)',
        background: 'rgba(15,20,30,0.92)', backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
        padding: 8, minWidth: 140, animation: 'popoverScale 0.18s cubic-bezier(0.34,1.26,0.64,1)',
      }}>
        {actions.map((action, idx) => {
          const ActionIcon = action.icon;
          return (
            <button key={idx} onClick={() => { navigate(action.path); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/5"
            >
              <ActionIcon className="w-4 h-4" style={{ color: '#D4AF37' }} />
              <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>{action.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export default function MobileDock() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  const [activePopover, setActivePopover] = useState(null);
  const [popoverPosition, setPopoverPosition] = useState(null);

  useEffect(() => {
    const check = () => setIsMobilePortrait(window.innerWidth <= 768 && window.innerWidth < window.innerHeight);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const dockApps = useMemo(() => {
    // Merge DOCK_APPS config with ALL_APPS for complete app data
    return DOCK_APPS.map((dock, i) => {
      const app = ALL_APPS.find(a => a.path === dock.path);
      return app ? { ...app, appKey: dock.appKey } : null;
    }).filter(Boolean);
  }, []);

  const { data: reminders = [] } = useQuery({ queryKey: ['dock-reminders'], queryFn: () => base44.entities.Reminder.filter({ status: 'pending' }, '-due_date', 20), staleTime: 60_000 });
  const { data: conversations = [] } = useQuery({ queryKey: ['dock-wa'], queryFn: () => base44.entities.WhatsAppConversation.filter({ status: 'open' }, '-last_message_at', 20), staleTime: 60_000 });
  const urgentCount = reminders.filter(r => r.due_at && new Date(r.due_at) < new Date()).length + conversations.reduce((s, c) => s + (c.unread_count || 0), 0);
  const homeGlow = urgentCount > 0 ? 'rgba(239,68,68,0.45)' : 'rgba(212,175,55,0.45)';

  // Landscape - simple original dock with exact dashboard colors
  if (!isMobilePortrait) {
    return (
      <nav className="fixed left-0 right-0 z-[9999] md:hidden flex justify-center" style={{ bottom: 8 }}>
        <div style={{
          background: 'radial-gradient(ellipse at 50% -20%, rgba(212,175,55,0.08) 0%, transparent 60%), linear-gradient(180deg, #0A1628 0%, #0D1F3A 40%, #081020 100%)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderRadius: 12,
          border: '1px solid rgba(212,175,55,0.35)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <button onClick={() => navigate('/')} style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(184,141,60,0.15) 100%)', border: '1px solid rgba(212,175,55,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Home style={{ width: 22, height: 22, color: '#D4AF37' }} />
          </button>
        </div>
      </nav>
    );
  }

  const handleLongPress = (appKey, event) => {
    const positions = { landlords: '20%', pipeline: '38%', whatsapp: '62%', forma: '80%' };
    setPopoverPosition({ left: positions[appKey], bottom: 85 });
    setActivePopover(appKey);
  };

  return (
    <>
      <nav className="fixed left-0 right-0 z-[9999] md:hidden flex justify-center" style={{ bottom: 0, padding: '0 16px', paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
        <div style={{
          background: 'radial-gradient(ellipse at 50% -20%, rgba(212,175,55,0.08) 0%, transparent 60%), linear-gradient(180deg, #0A1628 0%, #0D1F3A 40%, #081020 100%)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderRadius: 24,
          border: '1px solid rgba(212,175,55,0.35)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          maxWidth: 420,
          position: 'relative',
          margin: '0 auto 12px',
        }}>
          <PortraitDockIcon app={dockApps[0]} active={location.pathname.startsWith('/landlords')} onLongPress={(e) => handleLongPress('landlords', e)} onPress={() => navigate('/landlords')} />
          <PortraitDockIcon app={dockApps[1]} active={location.pathname.startsWith('/pipeline')} onLongPress={(e) => handleLongPress('pipeline', e)} onPress={() => navigate('/pipeline')} />
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', width: HOME_SZ+12, height: HOME_SZ+12, borderRadius: Math.round(HOME_SZ*0.28), background: homeGlow, filter: 'blur(14px)', top: '50%', left: '50%', transform: 'translate(-50%, -55%)', pointerEvents: 'none' }} />
            <button onClick={() => navigate('/')} style={{
              width: HOME_SZ, height: HOME_SZ, borderRadius: Math.round(HOME_SZ*0.28), position: 'relative', top: -8,
              border: '1px solid rgba(212,175,55,0.4)',
              background: 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(184,141,60,0.15) 100%)',
              backdropFilter: 'blur(32px) saturate(200%)',
              WebkitBackdropFilter: 'blur(32px) saturate(200%)',
              boxShadow: '0 4px 12px rgba(212,175,55,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Home style={{ width: Math.round(HOME_SZ*0.52), height: Math.round(HOME_SZ*0.52), color: '#D4AF37', strokeWidth: 2.2 }} />
            </button>
          </div>
          <PortraitDockIcon app={dockApps[2]} active={location.pathname.startsWith('/whatsapp')} onLongPress={(e) => handleLongPress('whatsapp', e)} onPress={() => navigate('/whatsapp')} />
          <PortraitDockIcon app={dockApps[3]} active={location.pathname.startsWith('/form-a')} onLongPress={(e) => handleLongPress('forma', e)} onPress={() => navigate('/form-a-referral')} />
        </div>
      </nav>
      {activePopover && <QuickActionsPopover actions={QUICK_ACTIONS[activePopover]} position={popoverPosition} onClose={() => { setActivePopover(null); setPopoverPosition(null); }} navigate={navigate} />}
      <style>{`@keyframes popoverScale { from { opacity: 0; transform: translateX(-50%) scale(0.92) translateY(8px); } to { opacity: 1; transform: translateX(-50%) scale(1) translateY(0); } }`}</style>
    </>
  );
}