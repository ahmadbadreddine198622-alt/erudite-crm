/**
 * MobileDock — Smart, modern dock with perfect dashboard color harmony.
 * More transparent, fresher design with intelligent app choices.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Building2, KanbanSquare, MessageCircle, FileSignature, Users, FileText, Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ALL_APPS } from '@/lib/navApps';
import ExtremeLiquidIcon from '@/components/ui/ExtremeLiquidIcon';
import AppPickerModal from '@/components/mobile/AppPickerModal';

const SZ = 46;
const HOME_SZ = 62;

// Smart dock apps with exact dashboard colors for perfect harmony
const SMART_DOCK_APPS = [
  { path: '/landlords', appKey: 'landlords', label: 'Landlords' },
  { path: '/pipeline', appKey: 'pipeline', label: 'Pipeline' },
  { path: '/form-a-referral', appKey: 'forma', label: 'Forms' },
  { path: '/whatsapp', appKey: 'whatsapp', label: 'WhatsApp' },
  { path: '/leads', appKey: 'leads', label: 'Leads' },
  { path: '/reminders', appKey: 'reminders', label: 'Tasks' },
];

// Expanded quick actions for smart dock
const SMART_QUICK_ACTIONS = {
  landlords: [
    { label: 'Add Landlord', icon: Building2, path: '/landlords' },
    { label: 'View Listings', icon: KanbanSquare, path: '/landlords' },
    { label: 'Form A Upload', icon: FileText, path: '/form-a-inbox' },
    { label: 'Recent Activity', icon: Bell, path: '/landlords' },
  ],
  pipeline: [
    { label: 'New Lead', icon: Users, path: '/leads' },
    { label: 'Hot Leads', icon: Building2, path: '/leads' },
    { label: "Today's Follow-ups", icon: Bell, path: '/reminders' },
    { label: 'Pipeline View', icon: KanbanSquare, path: '/pipeline' },
  ],
  forma: [
    { label: 'New Form A', icon: FileSignature, path: '/form-a-referral' },
    { label: 'Draft Contracts', icon: FileText, path: '/form-a-inbox' },
    { label: 'Templates', icon: FileSignature, path: '/email-templates' },
    { label: 'Upload Form A', icon: Building2, path: '/form-a-inbox' },
  ],
  whatsapp: [
    { label: 'New Message', icon: MessageCircle, path: '/whatsapp' },
    { label: 'Unread Chats', icon: Bell, path: '/whatsapp' },
    { label: 'Broadcasts', icon: Users, path: '/broadcasts' },
    { label: 'Templates', icon: FileSignature, path: '/email-templates' },
  ],
  leads: [
    { label: 'Add Lead', icon: Users, path: '/leads' },
    { label: 'Hot Leads', icon: Building2, path: '/leads' },
    { label: 'Import Leads', icon: FileText, path: '/leads' },
    { label: 'Follow-ups', icon: Bell, path: '/reminders' },
  ],
  reminders: [
    { label: 'Add Reminder', icon: Bell, path: '/reminders' },
    { label: "Today's Tasks", icon: FileText, path: '/reminders' },
    { label: 'Calendar View', icon: Building2, path: '/calendar' },
    { label: 'Overdue', icon: Users, path: '/reminders' },
  ],
};

function SmartDockIcon({ app, active, onPress, onLongPress }) {
  const pressTimer = useRef(null);
  if (!app?.icon) return null;

  const handleTouchStart = () => { pressTimer.current = setTimeout(() => onLongPress(), 500); };
  const handleTouchEnd = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

  return (
    <button
      type="button" onClick={onPress} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart} onMouseUp={handleTouchEnd} onMouseLeave={handleTouchEnd}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
    >
      <div className="flex flex-col items-center" style={{ gap: 3 }}>
        <ExtremeLiquidIcon icon={app.icon} gradient={app.gradient} glowColor={app.glowColor}
          size={SZ} iconSize={Math.round(SZ * 0.50)} active={active} badge={0} tiltX={0} tiltY={0} index={0} isDragging={false} />
        {active && <div style={{ width: 3, height: 3, borderRadius: 1.5, background: 'hsl(38 92% 55%)', boxShadow: '0 0 6px hsl(38 92% 55%)' }} />}
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
        background: 'rgba(10,15,25,0.88)', backdropFilter: 'blur(32px) saturate(200%)',
        border: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 16px 56px rgba(0,0,0,0.6), 0 0 32px rgba(212,175,55,0.12)',
        padding: 6, minWidth: 150, animation: 'popoverScale 0.2s cubic-bezier(0.34,1.26,0.64,1)',
      }}>
        <div className="py-1">
          {actions.map((action, idx) => {
            const ActionIcon = action.icon;
            return (
              <button key={idx} onClick={() => { navigate(action.path); onClose(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <ActionIcon className="w-4 h-4" style={{ color: 'hsl(38 92% 55%)' }} />
                <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.88)' }}>{action.label}</span>
              </button>
            );
          })}
        </div>
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

  // Get dock apps with exact colors from ALL_APPS
  const dockApps = useMemo(() => {
    return SMART_DOCK_APPS.map(dock => {
      const app = ALL_APPS.find(a => a.path === dock.path);
      return app ? { ...app, appKey: dock.appKey, dockLabel: dock.label } : null;
    }).filter(Boolean);
  }, []);

  const { data: reminders = [] } = useQuery({ queryKey: ['dock-reminders'], queryFn: () => base44.entities.Reminder.filter({ status: 'pending' }, '-due_date', 20), staleTime: 60_000 });
  const { data: conversations = [] } = useQuery({ queryKey: ['dock-wa'], queryFn: () => base44.entities.WhatsAppConversation.filter({ status: 'open' }, '-last_message_at', 20), staleTime: 60_000 });
  const urgentCount = reminders.filter(r => r.due_at && new Date(r.due_at) < new Date()).length + conversations.reduce((s, c) => s + (c.unread_count || 0), 0);
  const homeGlow = urgentCount > 0 ? 'rgba(239,68,68,0.40)' : 'rgba(212,175,55,0.40)';

  // Landscape - minimal dock
  if (!isMobilePortrait) {
    return (
      <nav className="fixed left-0 right-0 z-[9999] md:hidden flex justify-center" style={{ bottom: 8 }}>
        <button onClick={() => navigate('/')} style={{ width: 42, height: 42, borderRadius: 11, background: 'rgba(245,158,11,0.12)', border: '1.5px solid rgba(245,158,11,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Home style={{ width: 20, height: 20, color: 'hsl(38 92% 55%)' }} />
        </button>
      </nav>
    );
  }

  const handleLongPress = (appKey, event) => {
    const positions = { landlords: '15%', pipeline: '32%', forma: '49%', whatsapp: '66%', leads: '83%', reminders: '92%' };
    setPopoverPosition({ left: positions[appKey] || '50%', bottom: 82 });
    setActivePopover(appKey);
  };

  return (
    <>
      <nav className="fixed left-0 right-0 z-[9999] md:hidden flex justify-center" style={{ bottom: 0, padding: '0 12px', paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}>
        {/* Ultra-modern glass dock with high transparency */}
        <div style={{
          background: 'rgba(8,14,24,0.72)', backdropFilter: 'blur(48px) saturate(220%)',
          WebkitBackdropFilter: 'blur(48px) saturate(220%)',
          borderRadius: 22, border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.55), 0 0 24px rgba(212,175,55,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
          padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 4,
          width: '100%', maxWidth: 440, position: 'relative', margin: '0 auto 10px',
        }}>
          {/* Subtle top gloss */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', borderRadius: '22px 22px 0 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)', pointerEvents: 'none' }} />

          {/* Smart dock apps - scrollable if needed */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, justifyContent: 'space-around' }}>
            {dockApps.slice(0, 3).map(app => (
              <SmartDockIcon key={app.path} app={app} active={location.pathname.startsWith(app.path)} onLongPress={(e) => handleLongPress(app.appKey, e)} onPress={() => navigate(app.path)} />
            ))}
          </div>

          {/* Center Home - elevated hub with gold harmony */}
          <div style={{ position: 'relative', margin: '0 2px' }}>
            <div style={{ position: 'absolute', width: HOME_SZ+10, height: HOME_SZ+10, borderRadius: Math.round(HOME_SZ*0.28), background: homeGlow, filter: 'blur(12px)', top: '50%', left: '50%', transform: 'translate(-50%, -55%)', pointerEvents: 'none' }} />
            <button onClick={() => navigate('/')} style={{
              width: HOME_SZ, height: HOME_SZ, borderRadius: Math.round(HOME_SZ*0.28), position: 'relative', top: -6,
              border: '1.5px solid rgba(212,175,55,0.28)', background: 'rgba(212,175,55,0.10)', backdropFilter: 'blur(28px)',
              boxShadow: `0 6px 20px ${homeGlow.replace('0.40','0.18')}, 0 2px 8px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.12)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: Math.round(HOME_SZ*0.28), background: 'linear-gradient(145deg, rgba(212,175,55,0.48) 0%, rgba(160,120,40,0.30) 100%)' }} />
              <Home style={{ width: Math.round(HOME_SZ*0.50), height: Math.round(HOME_SZ*0.50), color: 'hsl(38 92% 55%)', strokeWidth: 2.2 }} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, justifyContent: 'space-around' }}>
            {dockApps.slice(3, 6).map(app => (
              <SmartDockIcon key={app.path} app={app} active={location.pathname.startsWith(app.path)} onLongPress={(e) => handleLongPress(app.appKey, e)} onPress={() => navigate(app.path)} />
            ))}
          </div>
        </div>
      </nav>

      {activePopover && <QuickActionsPopover actions={SMART_QUICK_ACTIONS[activePopover]} position={popoverPosition} onClose={() => { setActivePopover(null); setPopoverPosition(null); }} navigate={navigate} />}
      <style>{`@keyframes popoverScale { from { opacity: 0; transform: translateX(-50%) scale(0.90) translateY(10px); } to { opacity: 1; transform: translateX(-50%) scale(1) translateY(0); } }`}</style>
    </>
  );
}