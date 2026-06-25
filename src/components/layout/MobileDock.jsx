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
const DOCK_APPS = [
  { path: '/landlords', appKey: 'landlords' },
  { path: '/pipeline', appKey: 'pipeline' },
  { path: '/whatsapp', appKey: 'whatsapp' },
  { path: '/form-a-referral', appKey: 'forma' },
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
        {active && <div style={{ width: 4, height: 4, borderRadius: 2, background: 'hsl(38 92% 55%)', boxShadow: '0 0 8px hsl(38 92% 55%)' }} />}
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
              <ActionIcon className="w-4 h-4" style={{ color: 'hsl(38 92% 55%)' }} />
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
    return DOCK_APPS.map(d => ALL_APPS.find(a => a.path === d.path)).filter(Boolean).map((app, i) => ({ ...app, ...DOCK_APPS[i] }));
  }, []);

  const { data: reminders = [] } = useQuery({ queryKey: ['dock-reminders'], queryFn: () => base44.entities.Reminder.filter({ status: 'pending' }, '-due_date', 20), staleTime: 60_000 });
  const { data: conversations = [] } = useQuery({ queryKey: ['dock-wa'], queryFn: () => base44.entities.WhatsAppConversation.filter({ status: 'open' }, '-last_message_at', 20), staleTime: 60_000 });
  const urgentCount = reminders.filter(r => r.due_at && new Date(r.due_at) < new Date()).length + conversations.reduce((s, c) => s + (c.unread_count || 0), 0);
  const homeGlow = urgentCount > 0 ? 'rgba(239,68,68,0.45)' : 'rgba(212,175,55,0.45)';

  // Landscape - simple original dock
  if (!isMobilePortrait) {
    return (
      <nav className="fixed left-0 right-0 z-[9999] md:hidden flex justify-center" style={{ bottom: 8 }}>
        <button onClick={() => navigate('/')} style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,0.14)', border: '1.5px solid rgba(245,158,11,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Home style={{ width: 22, height: 22, color: 'hsl(38 92% 55%)' }} />
        </button>
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
          background: 'rgba(11,31,58,0.85)', backdropFilter: 'blur(60px) saturate(280%)',
          borderRadius: 24, border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 16px 56px rgba(0,0,0,0.65)',
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 6,
          width: '100%', maxWidth: 420, position: 'relative', margin: '0 auto 12px',
        }}>
          <PortraitDockIcon app={dockApps[0]} active={location.pathname.startsWith('/landlords')} onLongPress={(e) => handleLongPress('landlords', e)} onPress={() => navigate('/landlords')} />
          <PortraitDockIcon app={dockApps[1]} active={location.pathname.startsWith('/pipeline')} onLongPress={(e) => handleLongPress('pipeline', e)} onPress={() => navigate('/pipeline')} />
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', width: HOME_SZ+12, height: HOME_SZ+12, borderRadius: Math.round(HOME_SZ*0.28), background: homeGlow, filter: 'blur(14px)', top: '50%', left: '50%', transform: 'translate(-50%, -55%)', pointerEvents: 'none' }} />
            <button onClick={() => navigate('/')} style={{
              width: HOME_SZ, height: HOME_SZ, borderRadius: Math.round(HOME_SZ*0.28), position: 'relative', top: -8,
              border: '1.5px solid rgba(212,175,55,0.32)', background: 'rgba(212,175,55,0.12)', backdropFilter: 'blur(32px)',
              boxShadow: `0 8px 24px ${homeGlow.replace('0.45','0.20')}, 0 3px 10px rgba(0,0,0,0.45)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: Math.round(HOME_SZ*0.28), background: 'linear-gradient(145deg, rgba(212,175,55,0.55) 0%, rgba(160,120,40,0.35) 100%)' }} />
              <Home style={{ width: Math.round(HOME_SZ*0.52), height: Math.round(HOME_SZ*0.52), color: 'hsl(38 92% 55%)', strokeWidth: 2.2 }} />
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