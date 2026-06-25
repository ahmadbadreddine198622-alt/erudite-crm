/**
 * MobileDock — iPhone-style bottom dock with app picker.
 * Tap any icon to navigate or hold to open full app picker.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ALL_APPS } from '@/lib/navApps';
import ExtremeLiquidIcon from '@/components/ui/ExtremeLiquidIcon';
import AppPickerModal from '@/components/mobile/AppPickerModal';

const SZ      = 50;
const R       = `${Math.round(SZ * 0.28)}px`;
const GLYPH   = Math.round(SZ * 0.50);
const HOME_SZ = 62;
const HOME_R  = `${Math.round(HOME_SZ * 0.28)}px`;

function loadDockSelection() {
  try {
    const saved = JSON.parse(localStorage.getItem('dock_selection') || 'null');
    if (saved) return saved.map(p => p.startsWith('/') ? p : `/${p}`);
    return ['/pipeline', '/leads', '/contacts', '/whatsapp'];
  } catch { return ['/pipeline', '/leads', '/contacts', '/whatsapp']; }
}

function DockIcon({ app, active, onPress }) {
  const { icon: Icon, label, gradient, glowColor } = app;
  return (
    <button
      type="button"
      onClick={onPress}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="flex flex-col items-center select-none" style={{ gap: 5 }}>
        <ExtremeLiquidIcon
          icon={Icon}
          gradient={gradient}
          glowColor={glowColor || 'rgba(255,255,255,0.25)'}
          size={SZ}
          iconSize={GLYPH}
          active={active}
          badge={0}
          tiltX={0}
          tiltY={0}
          index={0}
          isDragging={false}
        />
        <span style={{
          fontSize: 9.5,
          fontWeight: active ? 700 : 400,
          color: active ? 'hsl(38 92% 65%)' : 'rgba(255,255,255,0.40)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          transition: 'color 0.2s ease',
          lineHeight: 1,
          maxWidth: SZ + 8,
          textAlign: 'center',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}>{label}</span>
      </div>
    </button>
  );
}

export default function MobileDock() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const isHome    = location.pathname === '/';

  const [dockSelection, setDockSelection] = useState(() => loadDockSelection());
  const [showPicker, setShowPicker] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const check = () => setIsLandscape(window.innerWidth > window.innerHeight);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const dockApps = useMemo(() => {
    return dockSelection.slice(0, 4)
      .map(path => ALL_APPS.find(a => a.path === path))
      .filter(Boolean);
  }, [dockSelection]);

  const leftItems  = dockApps.slice(0, 2);
  const rightItems = dockApps.slice(2, 4);

  const handleNav = (path) => { navigate(path); };

  const { data: reminders = [] } = useQuery({
    queryKey: ['dock-reminders'],
    queryFn: () => base44.entities.Reminder.filter({ status: 'pending' }, '-due_date', 20),
    staleTime: 60_000,
  });
  const { data: conversations = [] } = useQuery({
    queryKey: ['dock-wa'],
    queryFn: () => base44.entities.WhatsAppConversation.filter({ status: 'open' }, '-last_message_at', 20),
    staleTime: 60_000,
  });

  const urgentCount = reminders.filter(r => r.due_at && new Date(r.due_at) < new Date()).length
    + conversations.reduce((s, c) => s + (c.unread_count || 0), 0);
  const isUrgent  = urgentCount > 0;
  const homeColor = isUrgent ? '#ef4444' : 'hsl(38 92% 52%)';
  const homeGlow  = isUrgent ? 'rgba(239,68,68,0.45)' : 'rgba(245,158,11,0.40)';

  if (isLandscape) {
    return (
      <nav className="fixed left-0 right-0 z-[9999] md:hidden flex justify-center" style={{ bottom: 8 }}>
        <button type="button" onClick={() => navigate('/')} aria-label="Home"
          style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(245,158,11,0.14)',
            border: '1.5px solid rgba(245,158,11,0.35)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Home style={{ width: 22, height: 22, color: 'hsl(38 92% 55%)' }} />
        </button>
      </nav>
    );
  }

  return (
    <>
      <nav
        className="fixed left-0 right-0 z-[9999] md:hidden flex justify-center"
        style={{ bottom: 0, padding: '0 12px', paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}
      >
        {/* Dock pill */}
        <div style={{
          background: 'rgba(10,14,30,0.80)',
          backdropFilter: 'blur(60px) saturate(280%)',
          WebkitBackdropFilter: 'blur(60px) saturate(280%)',
          borderRadius: 34,
          border: '1px solid rgba(255,255,255,0.12)',
          borderTopColor: 'rgba(255,255,255,0.22)',
          boxShadow: '0 -1px 0 rgba(255,255,255,0.05) inset, 0 24px 64px rgba(0,0,0,0.70), 0 8px 24px rgba(0,0,0,0.45)',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-around',
          gap: 6,
          width: '100%',
          maxWidth: 460,
          position: 'relative',
          overflow: 'hidden',
        }}>

          {/* Top gloss */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
            borderRadius: '34px 34px 0 0',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 100%)',
            pointerEvents: 'none',
          }} />

          {/* Left 2 */}
          {leftItems.map(item => (
            <DockIcon
              key={item.path}
              app={item}
              active={location.pathname === item.path}
              onPress={() => handleNav(item.path)}
            />
          ))}

          {/* Center Home — elevated */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            {/* Glow bloom */}
            <div style={{
              position: 'absolute',
              width: HOME_SZ + 10, height: HOME_SZ + 10,
              borderRadius: HOME_R,
              background: homeGlow,
              filter: 'blur(12px)',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -60%)',
              pointerEvents: 'none', zIndex: 0,
              transition: 'background 0.4s ease',
            }} />

            <button
              type="button"
              onClick={() => navigate('/')}
              aria-label="Home"
              style={{
                width: HOME_SZ, height: HOME_SZ,
                borderRadius: HOME_R,
                position: 'relative',
                top: -10,
                zIndex: 2,
                border: `1.5px solid rgba(245,158,11,0.28)`,
                borderTopColor: `rgba(255,255,255,0.28)`,
                boxShadow: `0 6px 18px ${homeGlow.replace('0.40', '0.18')}, 0 2px 8px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.14)`,
                background: 'rgba(245,158,11,0.10)',
                backdropFilter: 'blur(32px) saturate(200%)',
                WebkitBackdropFilter: 'blur(32px) saturate(200%)',
                cursor: 'pointer',
                transition: 'all 0.22s cubic-bezier(0.34,1.26,0.64,1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* Inner gradient */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: HOME_R,
                background: 'linear-gradient(145deg, rgba(245,158,11,0.50) 0%, rgba(160,90,0,0.35) 100%)',
              }} />
              {/* Top sheen */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: HOME_R,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 52%)',
                pointerEvents: 'none',
              }} />
              <Home style={{
                width: Math.round(HOME_SZ * 0.50),
                height: Math.round(HOME_SZ * 0.50),
                position: 'relative', zIndex: 2,
                color: 'hsl(38 92% 58%)',
                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.55))',
                strokeWidth: 2.2,
              }} />
            </button>

            <span style={{
              fontSize: 9.5,
              fontWeight: isHome ? 700 : 400,
              color: isHome ? 'hsl(38 92% 65%)' : 'rgba(255,255,255,0.42)',
              letterSpacing: '0.05em',
              marginTop: 6,
              textTransform: 'uppercase',
              lineHeight: 1,
            }}>Home</span>
          </div>

          {/* Right 2 */}
          {rightItems.map(item => (
            <DockIcon
              key={item.path}
              app={item}
              active={location.pathname === item.path}
              onPress={() => handleNav(item.path)}
            />
          ))}
        </div>
      </nav>

      {/* App Picker Modal */}
      {showPicker && <AppPickerModal onClose={() => setShowPicker(false)} />}

    </>
  );
}