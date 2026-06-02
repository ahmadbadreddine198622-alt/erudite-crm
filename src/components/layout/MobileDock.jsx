/**
 * MobileDock — iPhone-style bottom dock.
 * 5 slots: 2 left + Home (center, elevated) + 2 right.
 * Usage-tracked, context-aware slot selection.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ALL_APPS, CONTEXT_DOCK_MAP } from '@/lib/navApps';
import ExtremeLiquidIcon from '@/components/ui/ExtremeLiquidIcon';
import ClaudeChatSheet from '@/components/chat/ClaudeChatSheet';

// ─── Constants ────────────────────────────────────────────────────────────────
const SZ      = 50;
const R       = `${Math.round(SZ * 0.28)}px`;
const GLYPH   = Math.round(SZ * 0.50);
const HOME_SZ = 62;
const HOME_R  = `${Math.round(HOME_SZ * 0.28)}px`;

function usageKey(email) { return `dock_usage_${email || 'default'}`; }
function loadUsage(email) {
  try { return JSON.parse(localStorage.getItem(usageKey(email)) || '{}'); } catch { return {}; }
}
function saveUsage(email, usage) {
  try { localStorage.setItem(usageKey(email), JSON.stringify(usage)); } catch {}
}

function selectDockItems(pathname, usage) {
  const contextKey = Object.keys(CONTEXT_DOCK_MAP).find(k => pathname.startsWith(k));
  const contextPaths = contextKey ? CONTEXT_DOCK_MAP[contextKey] : [];
  const byUsage = [...ALL_APPS].sort((a, b) => (usage[b.path] || 0) - (usage[a.path] || 0));
  const seen = new Set();
  const candidates = [];
  for (const path of contextPaths) {
    const app = ALL_APPS.find(a => a.path === path);
    if (app && !seen.has(app.path)) { candidates.push(app); seen.add(app.path); }
  }
  for (const app of byUsage) {
    if (!seen.has(app.path)) { candidates.push(app); seen.add(app.path); }
  }
  return candidates.filter(a => a.path !== '/' && a.path !== '/my-dashboard').slice(0, 4);
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

  const [userEmail, setUserEmail] = useState('');
  const [usage, setUsage]         = useState(() => loadUsage(''));
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const check = () => setIsLandscape(window.innerWidth > window.innerHeight);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.email) { setUserEmail(u.email); setUsage(loadUsage(u.email)); }
    }).catch(() => {});
  }, []);

  const dockItems = useMemo(() => selectDockItems(location.pathname, usage), [location.pathname, usage]);
  const leftItems  = dockItems.slice(0, 2);
  const rightItems = dockItems.slice(2, 4);

  const trackUsage = useCallback((path) => {
    setUsage(prev => {
      const next = { ...prev, [path]: (prev[path] || 0) + 1 };
      saveUsage(userEmail, next);
      return next;
    });
  }, [userEmail]);

  const handleNav = (path) => { trackUsage(path); navigate(path); };

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
              top: isHome ? -14 : -10,
              zIndex: 2,
              border: `1.5px solid ${isHome ? 'rgba(245,158,11,0.55)' : 'rgba(245,158,11,0.28)'}`,
              borderTopColor: `rgba(255,255,255,${isHome ? '0.50' : '0.28'})`,
              boxShadow: isHome
                ? `0 10px 32px ${homeGlow}, 0 4px 12px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.20)`
                : `0 6px 18px ${homeGlow.replace('0.40', '0.18')}, 0 2px 8px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.14)`,
              background: isHome ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.10)',
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
              background: isUrgent
                ? 'linear-gradient(145deg, rgba(239,68,68,0.50) 0%, rgba(180,20,20,0.35) 100%)'
                : 'linear-gradient(145deg, rgba(245,158,11,0.50) 0%, rgba(160,90,0,0.35) 100%)',
              transition: 'background 0.4s ease',
            }} />
            {/* Top sheen */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: HOME_R,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 52%)',
              pointerEvents: 'none',
            }} />
            {/* Urgent badge */}
            {isUrgent && (
              <div style={{
                position: 'absolute', top: -5, right: -5,
                background: '#ef4444', color: '#fff',
                fontSize: 8, fontWeight: 700,
                minWidth: 16, height: 16, borderRadius: 99,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1.5px solid rgba(6,8,16,0.9)', zIndex: 5, padding: '0 3px',
              }}>{urgentCount > 99 ? '99+' : urgentCount}</div>
            )}
            <Home style={{
              width: Math.round(HOME_SZ * 0.50),
              height: Math.round(HOME_SZ * 0.50),
              position: 'relative', zIndex: 2,
              color: isUrgent ? 'hsl(0 84% 70%)' : 'hsl(38 92% 58%)',
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.55))',
              strokeWidth: 2.2,
              transition: 'color 0.4s ease',
            }} />
          </button>

          <span style={{
            fontSize: 9.5,
            fontWeight: isHome ? 700 : 400,
            color: isHome ? 'hsl(38 92% 62%)' : 'rgba(255,255,255,0.42)',
            letterSpacing: '0.05em',
            marginTop: 6,
            textTransform: 'uppercase',
            transition: 'color 0.22s ease',
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

      <ClaudeChatSheet isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </nav>
  );
}