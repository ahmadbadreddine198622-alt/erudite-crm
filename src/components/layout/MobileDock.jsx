/**
 * MobileDock — Smart adaptive bottom navigation.
 * - Home is permanently centered.
 * - 2 slots left + 2 slots right auto-surface based on context (current page) then usage frequency.
 * - Usage is tracked per-user in localStorage.
 * - Navy/gold palette: inactive = muted navy-glass, active = gold highlight.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Brain } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ALL_APPS, CONTEXT_DOCK_MAP } from '@/lib/navApps';
import ExtremeLiquidIcon from '@/components/ui/ExtremeLiquidIcon';
import ClaudePresenceIcon from '@/components/ui/ClaudePresenceIcon';

// ─── Constants ───────────────────────────────────────────────────────────────
const SZ       = 46;
const R        = `${Math.round(SZ * 0.245)}px`;
const GLYPH    = Math.round(SZ * 0.52);
const HOME_SZ  = 58;
const HOME_R   = `${Math.round(HOME_SZ * 0.245)}px`;
const HOME_GLYPH = Math.round(HOME_SZ * 0.55);

function usageKey(email) { return `dock_usage_${email || 'default'}`; }

function loadUsage(email) {
  try { return JSON.parse(localStorage.getItem(usageKey(email)) || '{}'); } catch { return {}; }
}

function saveUsage(email, usage) {
  try { localStorage.setItem(usageKey(email), JSON.stringify(usage)); } catch {}
}

// ─── Smart slot selection ────────────────────────────────────────────────────
function selectDockItems(pathname, usage) {
  // 1. Try context match
  const contextKey = Object.keys(CONTEXT_DOCK_MAP).find(k => pathname.startsWith(k));
  const contextPaths = contextKey ? CONTEXT_DOCK_MAP[contextKey] : [];

  // 2. Sort ALL_APPS by usage desc
  const byUsage = [...ALL_APPS].sort((a, b) => (usage[b.path] || 0) - (usage[a.path] || 0));

  // 3. Build ordered candidate list: context first, then usage-sorted, deduped
  const seen = new Set();
  const candidates = [];
  for (const path of contextPaths) {
    const app = ALL_APPS.find(a => a.path === path);
    if (app && !seen.has(app.path)) { candidates.push(app); seen.add(app.path); }
  }
  for (const app of byUsage) {
    if (!seen.has(app.path)) { candidates.push(app); seen.add(app.path); }
  }

  // 4. Pick 4 (skip if it's the home path '/')
  return candidates.filter(a => a.path !== '/').slice(0, 4);
}

// ─── NavIcon ─────────────────────────────────────────────────────────────────
function NavIcon({ app, active }) {
  const { icon: Icon, label, gradient, glowColor } = app;
  const glow = glowColor || 'rgba(255,255,255,0.25)';

  return (
    <div
      className="flex flex-col items-center select-none"
      style={{ gap: 3, WebkitTapHighlightColor: 'transparent' }}
    >
      <ExtremeLiquidIcon
        icon={Icon}
        gradient={gradient}
        glowColor={glow}
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
        fontSize: 9, fontWeight: active ? 600 : 400,
        color: active ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.42)',
        letterSpacing: '0.02em',
        transition: 'color 0.22s ease',
      }}>{label}</span>
    </div>
  );
}

// ─── Main MobileDock ──────────────────────────────────────────────────────────
export default function MobileDock() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';

  const [userEmail, setUserEmail] = useState('');
  const [usage, setUsage] = useState(() => loadUsage(''));

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.email) {
        setUserEmail(u.email);
        setUsage(loadUsage(u.email));
      }
    }).catch(() => {});
  }, []);

  // Re-derive dock items whenever pathname or usage changes
  const dockItems = useMemo(
    () => selectDockItems(location.pathname, usage),
    [location.pathname, usage]
  );

  const leftItems  = dockItems.slice(0, 2);
  const rightItems = dockItems.slice(2, 4);

  const trackUsage = useCallback((path) => {
    setUsage(prev => {
      const next = { ...prev, [path]: (prev[path] || 0) + 1 };
      saveUsage(userEmail, next);
      return next;
    });
  }, [userEmail]);

  const handleNav = (path) => {
    trackUsage(path);
    navigate(path);
  };

  // Badge/urgent data
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
  const isUrgent = urgentCount > 0;
  const homeColor = isUrgent ? 'rgba(239,68,68,1)' : 'rgba(245,158,11,1)';
  const homeGlow  = isUrgent ? 'rgba(239,68,68,0.45)' : 'rgba(245,158,11,0.45)';

  return (
    <nav
      className="fixed left-0 right-0 z-[9999] md:hidden flex justify-center"
      style={{ bottom: -8, padding: '0 16px', paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}
    >
      <div style={{
        background: 'rgba(8,12,28,0.72)',
        backdropFilter: 'blur(56px) saturate(240%) brightness(1.08)',
        WebkitBackdropFilter: 'blur(56px) saturate(240%) brightness(1.08)',
        borderRadius: 36,
        border: '1px solid rgba(255,255,255,0.13)',
        borderTopColor: 'rgba(255,255,255,0.22)',
        borderBottomColor: 'rgba(0,0,0,0.30)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.70), 0 8px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.35), 0 0 0 1px rgba(245,158,11,0.06)',
        padding: '10px 16px 10px',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 6,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Claude Presence Indicator — Top center of dock */}
        <div style={{
          position: 'absolute',
          top: -18,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          pointerEvents: 'none',
        }}>
          <ClaudePresenceIcon size={28} active={false} thinking={false} />
        </div>
        {/* Top gloss sheen */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
          borderRadius: '36px 36px 0 0',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 100%)',
          pointerEvents: 'none', zIndex: 0,
        }} />

        {/* Left 2 items */}
        <div className="flex items-end gap-1">
          {leftItems.map(item => (
            <button
              key={item.path}
              type="button"
              onClick={() => handleNav(item.path)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <NavIcon app={item} active={location.pathname === item.path} />
            </button>
          ))}
        </div>

        {/* Center Home — fixed anchor */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 3px' }}>
          {/* Bloom */}
          <div style={{
            position: 'absolute',
            width: HOME_SZ + 8, height: HOME_SZ + 8,
            borderRadius: `${Math.round(HOME_SZ * 0.245) + 2}px`,
            background: homeGlow,
            filter: 'blur(10px)',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -58%)',
            pointerEvents: 'none', zIndex: 0,
            transition: 'background 0.4s ease',
          }} />
          {isUrgent && (
            <div style={{
              position: 'absolute',
              width: HOME_SZ + 14, height: HOME_SZ + 14,
              borderRadius: `${Math.round(HOME_SZ * 0.245) + 3}px`,
              border: '2px solid rgba(239,68,68,0.50)',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -58%)',
              pointerEvents: 'none', zIndex: 1,
              animation: 'pulse 2s ease-in-out infinite',
            }} />
          )}
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Home"
            style={{
              width: HOME_SZ, height: HOME_SZ,
              borderRadius: HOME_R,
              position: 'relative',
              top: isHome ? '-12px' : '-8px',
              zIndex: 2,
              border: `2px solid ${isHome ? homeColor.replace('1)', '0.50)') : homeColor.replace('1)', '0.25)')}`,
              borderTopColor: `rgba(255,255,255,${isHome ? '0.55' : '0.30'})`,
              boxShadow: isHome
                ? `0 12px 36px ${homeGlow}, 0 4px 14px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.22)`
                : `0 6px 20px ${homeGlow.replace('0.45', '0.20')}, 0 2px 8px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.14)`,
              background: isHome ? homeColor.replace('1)', '0.18)') : homeColor.replace('1)', '0.09)'),
              backdropFilter: 'blur(32px) saturate(200%)',
              WebkitBackdropFilter: 'blur(32px) saturate(200%)',
              cursor: 'pointer',
              transition: 'all 0.22s cubic-bezier(0.34,1.26,0.64,1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div style={{
              position: 'absolute', inset: 0, borderRadius: HOME_R,
              background: isUrgent
                ? 'linear-gradient(145deg, rgba(239,68,68,0.55) 0%, rgba(180,20,20,0.40) 100%)'
                : 'linear-gradient(145deg, rgba(245,158,11,0.55) 0%, rgba(180,100,0,0.40) 100%)',
              transition: 'background 0.4s ease',
            }} />
            <div style={{
              position: 'absolute', inset: 0, borderRadius: HOME_R,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 52%)',
              pointerEvents: 'none',
            }} />
            {isUrgent && (
              <div style={{
                position: 'absolute', top: -5, right: -5,
                background: 'rgb(239,68,68)', color: '#fff',
                fontSize: 8, fontWeight: 700,
                minWidth: 16, height: 16, borderRadius: 99,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1.5px solid rgba(6,8,16,0.9)', zIndex: 5, padding: '0 3px',
              }}>{urgentCount > 99 ? '99+' : urgentCount}</div>
            )}
            <Home style={{
              width: HOME_GLYPH, height: HOME_GLYPH,
              position: 'relative', zIndex: 2,
              color: isUrgent ? 'hsl(0 84% 65%)' : 'hsl(38 92% 55%)',
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.60))',
              strokeWidth: 2.2,
              transition: 'color 0.4s ease',
            }} />
          </button>
          <span style={{
            fontSize: 9, fontWeight: isHome ? 700 : 400,
            color: isHome ? 'hsl(38 92% 55%)' : 'rgba(255,255,255,0.38)',
            letterSpacing: '0.02em', marginTop: 2,
            transition: 'color 0.22s ease',
          }}>Home</span>
        </div>

        {/* Right 2 items */}
        <div className="flex items-end gap-1">
          {rightItems.map(item => (
            <button
              key={item.path}
              type="button"
              onClick={() => handleNav(item.path)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <NavIcon app={item} active={location.pathname === item.path} />
            </button>
          ))}
        </div>

      </div>
    </nav>
  );
}