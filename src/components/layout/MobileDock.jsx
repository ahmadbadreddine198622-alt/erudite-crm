/**
 * MobileDock — Lit display case dock for mobile portrait ONLY.
 * Desktop and landscape keep original dock unchanged.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Building2, KanbanSquare, MessageCircle, FileSignature, Plus, Clock, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ALL_APPS } from '@/lib/navApps';
import AppPickerModal from '@/components/mobile/AppPickerModal';

const SZ = 50;
const HOME_SZ = 60;

// Per-item hue data — dark jewel gradient stops + rgb for glow
const HUES = {
  landlords: { lit:'#4a3413', deep:'#2a1d0a', darkest:'#170f05', rgb:'240,169,59', icon:'#f5c878' },
  pipeline:  { lit:'#2e2154', deep:'#1a1338', darkest:'#0e081c', rgb:'139,92,246', icon:'#c4b5fd' },
  whatsapp:  { lit:'#103a2c', deep:'#0a2419', darkest:'#05130e', rgb:'45,212,167', icon:'#7ce8c4' },
  forma:     { lit:'#4a3413', deep:'#2a1d0a', darkest:'#170f05', rgb:'240,169,59', icon:'#f5c878' },
};

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

// ── Lit display case icon ──────────────────────────────────────────────────────
function LitCaseIcon({ icon: Icon, hue, size, active }) {
  const radius = Math.round(size * 0.30);
  const iconSize = Math.round(size * 0.46);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: radius,
        position: 'relative', overflow: 'hidden',
        background: `radial-gradient(130% 130% at 30% 18%, ${hue.lit}, ${hue.deep} 70%, ${hue.darkest})`,
        border: '1px solid rgba(212,175,55,0.30)',
        boxShadow: `0 0 24px -8px rgba(${hue.rgb},0.6), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 0 0 1px rgba(212,175,55,0.06)`,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      {/* Top glint */}
      <div style={{
        position: 'absolute', top: 0, left: '11px', right: '11px', height: '1px',
        background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.85),transparent)',
        pointerEvents: 'none',
      }} />
      {/* Inner top-glow */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none',
        background: 'radial-gradient(80% 50% at 50% -10%, rgba(255,255,255,0.22), transparent 70%)',
      }} />
      {/* Icon */}
      <Icon
        style={{
          width: iconSize, height: iconSize,
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          color: hue.icon,
          strokeWidth: 1.7,
          filter: `drop-shadow(0 1px 3px rgba(${hue.rgb},0.5)) drop-shadow(0 2px 6px rgba(0,0,0,0.5))`,
        }}
      />
    </div>
  );
}

function PortraitDockIcon({ app, appKey, active, onPress, onLongPress }) {
  const { icon: Icon } = app || {};
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
        <LitCaseIcon icon={Icon} hue={HUES[appKey]} size={SZ} active={active} />
        <div style={{
          width: active ? 5 : 0, height: active ? 5 : 0, borderRadius: '50%',
          background: `rgb(${HUES[appKey].rgb})`,
          boxShadow: active ? `0 0 8px rgba(${HUES[appKey].rgb},0.6)` : 'none',
          transition: 'all 0.2s ease',
        }} />
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
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 1024;
  });
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth < window.innerHeight;
  });
  const [activePopover, setActivePopover] = useState(null);
  const [popoverPosition, setPopoverPosition] = useState(null);

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth <= 1024);
      setIsPortrait(window.innerWidth < window.innerHeight);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  const isMobilePortrait = isMobile && isPortrait;

  const dockApps = useMemo(() => {
    return DOCK_APPS.map((dock, i) => {
      const app = ALL_APPS.find(a => a.path === dock.path);
      return app ? { ...app, appKey: dock.appKey } : null;
    }).filter(Boolean);
  }, []);

  const { data: reminders = [] } = useQuery({ queryKey: ['dock-reminders'], queryFn: () => base44.entities.Reminder.filter({ status: 'pending' }, '-due_date', 20), staleTime: 60_000 });
  const { data: conversations = [] } = useQuery({ queryKey: ['dock-wa'], queryFn: () => base44.entities.WhatsAppConversation.filter({ status: 'open' }, '-last_message_at', 20), staleTime: 60_000 });
  const urgentCount = reminders.filter(r => r.due_at && new Date(r.due_at) < new Date()).length + conversations.reduce((s, c) => s + (c.unread_count || 0), 0);

  // Desktop — no dock (sidebar handles navigation)
  if (!isMobile) return null;

  // Landscape mobile — simple gold home button
  if (!isMobilePortrait) {
    return (
      <nav className="fixed left-0 right-0 z-[9999] flex justify-center" style={{ bottom: 8 }}>
        <div style={{
          background: 'rgba(16,20,32,0.72)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          borderRadius: 14,
          border: '1px solid rgba(212,175,55,0.20)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          padding: '6px',
        }}>
          <button onClick={() => navigate('/')} style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'radial-gradient(130% 130% at 30% 18%, #5a4618, #2e2208 70%, #171005)',
            border: '1px solid rgba(212,175,55,0.35)',
            boxShadow: '0 0 20px -6px rgba(212,175,55,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Home style={{ width: 22, height: 22, color: '#eccd72', strokeWidth: 1.8 }} />
          </button>
        </div>
      </nav>
    );
  }

  const handleLongPress = (appKey, event) => {
    const positions = { landlords: '20%', pipeline: '38%', whatsapp: '62%', forma: '80%' };
    setPopoverPosition({ left: positions[appKey], bottom: 90 });
    setActivePopover(appKey);
  };

  const homeRadius = Math.round(HOME_SZ * 0.30);

  return (
    <>
      <nav
        className="fixed left-0 right-0 z-[9999] flex justify-center"
        style={{
          bottom: 0,
          paddingLeft: 12,
          paddingRight: 12,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
          paddingTop: 0,
        }}
      >
        {/* Floating glass dock — lit display case tray */}
        <div style={{
          background: 'rgba(16,20,32,0.72)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          borderRadius: 26,
          border: '1px solid rgba(212,175,55,0.16)',
          boxShadow: '0 36px 80px -36px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: 14,
          width: '100%',
          maxWidth: 400,
          position: 'relative',
        }}>
          {/* Gold hairline across top edge */}
          <div style={{
            position: 'absolute', top: 0, left: '24px', right: '24px', height: '1px',
            background: 'linear-gradient(90deg,transparent,rgba(212,175,55,0.5),transparent)',
            pointerEvents: 'none',
          }} />

          <PortraitDockIcon app={dockApps[0]} appKey="landlords" active={location.pathname.startsWith('/landlords')} onLongPress={(e) => handleLongPress('landlords', e)} onPress={() => navigate('/landlords')} />
          <PortraitDockIcon app={dockApps[1]} appKey="pipeline" active={location.pathname.startsWith('/pipeline')} onLongPress={(e) => handleLongPress('pipeline', e)} onPress={() => navigate('/pipeline')} />

          {/* Center elevated gold home button */}
          <div style={{ position: 'relative', marginTop: '-10px', zIndex: 10 }}>
            <button
              onClick={() => navigate('/')}
              aria-label="Go to Home"
              style={{
                width: HOME_SZ, height: HOME_SZ, borderRadius: homeRadius,
                position: 'relative', overflow: 'hidden', cursor: 'pointer',
                background: 'radial-gradient(130% 130% at 30% 18%, #5a4618, #2e2208 70%, #171005)',
                border: '1px solid rgba(212,175,55,0.40)',
                boxShadow: urgentCount > 0
                  ? '0 0 36px -4px rgba(239,68,68,0.7), inset 0 1px 0 rgba(255,255,255,0.24), inset 0 0 0 1px rgba(212,175,55,0.08)'
                  : '0 0 36px -4px rgba(212,175,55,0.7), inset 0 1px 0 rgba(255,255,255,0.24), inset 0 0 0 1px rgba(212,175,55,0.08)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              {/* Top glint — brightest cream */}
              <div style={{
                position: 'absolute', top: 0, left: '11px', right: '11px', height: '1px',
                background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.9),transparent)',
                pointerEvents: 'none',
              }} />
              {/* Inner top-glow */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: homeRadius, pointerEvents: 'none',
                background: 'radial-gradient(80% 50% at 50% -10%, rgba(255,255,255,0.28), transparent 70%)',
              }} />
              <Home
                style={{
                  width: Math.round(HOME_SZ * 0.46), height: Math.round(HOME_SZ * 0.46),
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: '#eccd72',
                  strokeWidth: 1.7,
                  filter: 'drop-shadow(0 1px 4px rgba(212,175,55,0.6)) drop-shadow(0 2px 6px rgba(0,0,0,0.5))',
                }}
              />
            </button>
          </div>

          <PortraitDockIcon app={dockApps[2]} appKey="whatsapp" active={location.pathname.startsWith('/whatsapp')} onLongPress={(e) => handleLongPress('whatsapp', e)} onPress={() => navigate('/whatsapp')} />
          <PortraitDockIcon app={dockApps[3]} appKey="forma" active={location.pathname.startsWith('/form-a')} onLongPress={(e) => handleLongPress('forma', e)} onPress={() => navigate('/form-a-referral')} />
        </div>
      </nav>
      {activePopover && <QuickActionsPopover actions={QUICK_ACTIONS[activePopover]} position={popoverPosition} onClose={() => { setActivePopover(null); setPopoverPosition(null); }} navigate={navigate} />}
      <style>{`@keyframes popoverScale { from { opacity: 0; transform: translateX(-50%) scale(0.92) translateY(8px); } to { opacity: 1; transform: translateX(-50%) scale(1) translateY(0); } }`}</style>
    </>
  );
}