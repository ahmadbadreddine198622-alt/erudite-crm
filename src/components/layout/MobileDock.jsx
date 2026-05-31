/**
 * MobileDock — Premium iOS-grade floating nav bar.
 * Squircle icon containers, amber glow active state, dimensional depth.
 */

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, KanbanSquare, MoreHorizontal, UserCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const NAV_ITEMS = [
  { label: 'Pipeline', icon: KanbanSquare,   path: '/pipeline',  gradient: 'linear-gradient(145deg, #7c3aed 0%, #4c1d95 100%)', glow: 'rgba(139,92,246,0.55)' },
  { label: 'Leads',    icon: Users,          path: '/leads',     gradient: 'linear-gradient(145deg, #10b981 0%, #065f46 100%)', glow: 'rgba(16,185,129,0.55)' },
  // center Home slot
  { label: 'Contacts', icon: UserCheck,      path: '/contacts',  gradient: 'linear-gradient(145deg, #0ea5e9 0%, #0e4d6e 100%)', glow: 'rgba(14,165,233,0.55)' },
  { label: 'More',     icon: MoreHorizontal, path: '/reminders', gradient: 'linear-gradient(145deg, #f43f5e 0%, #881337 100%)', glow: 'rgba(244,63,94,0.55)' },
];

const SQUIRCLE_SIZE = 46;
const SQUIRCLE_R = Math.round(SQUIRCLE_SIZE * 0.24);

function NavIcon({ icon: Icon, label, path, gradient, glow, active }) {
  const [pressed, setPressed] = React.useState(false);
  const sz = SQUIRCLE_SIZE;
  const r = `${SQUIRCLE_R}px`;
  const iconSz = Math.round(sz * 0.58);

  // Active → amber gradient; inactive → item's own gradient (slightly muted)
  const bgGradient = active
    ? 'linear-gradient(145deg, rgba(245,158,11,0.85) 0%, rgba(180,100,0,0.70) 100%)'
    : gradient;
  const activeGlow = 'rgba(245,158,11,0.55)';

  return (
    <Link
      to={path}
      className="flex flex-col items-center gap-1 select-none"
      style={{ WebkitTapHighlightColor: 'transparent' }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
    >
      {/* Glow halo — active only, contained */}
      {active && (
        <div style={{
          position: 'absolute',
          width: sz + 6, height: sz + 6,
          borderRadius: `${SQUIRCLE_R + 2}px`,
          background: activeGlow,
          filter: 'blur(8px)',
          opacity: 0.55,
          pointerEvents: 'none',
          transform: 'translate(-50%, -50%)',
          top: '50%', left: '50%',
          zIndex: 0,
        }} />
      )}

      {/* Squircle container */}
      <div style={{
        width: sz, height: sz,
        borderRadius: r,
        position: 'relative',
        transform: pressed ? 'scale(0.93)' : active ? 'scale(1.06)' : 'scale(1)',
        transition: 'transform 0.2s cubic-bezier(0.34,1.26,0.64,1), box-shadow 0.22s ease',
        boxShadow: active
          ? `0 6px 22px ${activeGlow}, 0 2px 8px rgba(0,0,0,0.40)`
          : '0 4px 14px rgba(0,0,0,0.50)',
        zIndex: 1,
      }}>
        {/* Gradient base */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: r, background: bgGradient, transition: 'background 0.22s ease' }} />

        {/* Frosted glass overlay */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: r,
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: active ? '1.5px solid rgba(255,255,255,0.30)' : '1px solid rgba(255,255,255,0.14)',
          borderTopColor: active ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.28)',
          transition: 'border-color 0.22s ease',
        }} />

        {/* iOS top gloss */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: r,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.48) 0%, rgba(255,255,255,0.08) 40%, rgba(255,255,255,0) 60%)',
          pointerEvents: 'none',
        }} />

        {/* Inner depth shadow */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: r,
          boxShadow: 'inset 0 3px 8px rgba(255,255,255,0.08), inset 0 -4px 10px rgba(0,0,0,0.28)',
          pointerEvents: 'none',
        }} />

        {/* Icon glyph */}
        <Icon style={{
          position: 'absolute',
          width: iconSz, height: iconSz,
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'rgba(255,255,255,0.95)',
          filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.65)) drop-shadow(0 2px 6px rgba(0,0,0,0.40))',
          strokeWidth: 2.2,
          zIndex: 2,
        }} />
      </div>

      <span style={{
        fontSize: 9,
        fontWeight: active ? 600 : 400,
        color: active ? 'hsl(38 92% 55%)' : 'rgba(255,255,255,0.45)',
        letterSpacing: '0.02em',
        transition: 'color 0.22s ease',
      }}>{label}</span>
    </Link>
  );
}

export default function MobileDock() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';

  // Context-aware Home button data
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

  const urgentCount = reminders.filter(r => {
    if (!r.due_at) return false;
    const overdue = new Date(r.due_at) < new Date();
    return overdue;
  }).length + conversations.reduce((s, c) => s + (c.unread_count || 0), 0);
  const isUrgent = urgentCount > 0;

  // Dynamic Home colors
  const homeColor = isUrgent ? 'rgba(239,68,68,1)' : 'rgba(245,158,11,1)';
  const homeGlow = isUrgent ? 'rgba(239,68,68,0.50)' : 'rgba(245,158,11,0.50)';
  const homeGlowBloom = isUrgent ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.38)';
  const homeIconColor = isUrgent ? 'hsl(0 84% 65%)' : 'hsl(38 92% 55%)';

  const HOME_SIZE = 62;
  const HOME_R = `${Math.round(HOME_SIZE * 0.24)}px`;
  const homeIconSz = Math.round(HOME_SIZE * 0.52);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex justify-center" style={{ padding: '0 16px 18px' }}>
        {/* Floating pill bar */}
        <div
          style={{
            background: 'rgba(6, 8, 16, 0.88)',
            backdropFilter: 'blur(48px) saturate(220%)',
            WebkitBackdropFilter: 'blur(48px) saturate(220%)',
            borderRadius: '36px',
            border: '1px solid rgba(255,255,255,0.10)',
            borderTopColor: 'rgba(255,255,255,0.18)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.70), 0 1px 0 rgba(255,255,255,0.06) inset, 0 0 0 1px rgba(245,159,10,0.10)',
            padding: '10px 18px 10px',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '6px',
          }}
        >
          {/* Left 2 items */}
          {NAV_ITEMS.slice(0, 2).map(item => (
            <div key={item.path} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <NavIcon {...item} active={location.pathname === item.path} />
            </div>
          ))}

          {/* Center Home — largest, most elevated */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 4px' }}>
            {/* Outer glow bloom — contained, no bleed */}
            <div style={{
              position: 'absolute',
              width: HOME_SIZE + 8,
              height: HOME_SIZE + 8,
              borderRadius: `${Math.round(HOME_SIZE * 0.24) + 2}px`,
              background: homeGlowBloom,
              filter: 'blur(10px)',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -56%)',
              pointerEvents: 'none',
              zIndex: 0,
              transition: 'background 0.4s ease',
            }} />
            {/* Urgent pulse ring */}
            {isUrgent && (
              <div style={{
                position: 'absolute',
                width: HOME_SIZE + 16, height: HOME_SIZE + 16,
                borderRadius: `${Math.round(HOME_SIZE * 0.24) + 4}px`,
                border: '2px solid rgba(239,68,68,0.55)',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -56%)',
                pointerEvents: 'none',
                zIndex: 1,
                animation: 'pulse 2s ease-in-out infinite',
              }} />
            )}

            <button
              type="button"
              onClick={() => navigate('/')}
              aria-label="Home"
              aria-current={isHome ? 'page' : undefined}
              style={{
                width: HOME_SIZE, height: HOME_SIZE,
                borderRadius: HOME_R,
                position: 'relative',
                top: isHome ? '-14px' : '-10px',
                zIndex: 2,
                border: `2px solid ${isHome ? homeColor.replace('1)', '0.55)') : homeColor.replace('1)', '0.30)')}`,
                borderTopColor: `rgba(255,255,255,${isHome ? '0.55' : '0.35'})`,
                boxShadow: isHome
                  ? `0 14px 42px ${homeGlow}, 0 4px 16px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.22)`
                  : `0 8px 28px ${homeGlow.replace('0.50', '0.25')}, 0 2px 10px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.14)`,
                background: isHome ? homeColor.replace('1)', '0.18)') : homeColor.replace('1)', '0.09)'),
                transition: 'all 0.22s cubic-bezier(0.34,1.26,0.64,1), background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease',
                backdropFilter: 'blur(32px) saturate(200%)',
                WebkitBackdropFilter: 'blur(32px) saturate(200%)',
                cursor: 'pointer',
                transition: 'all 0.22s cubic-bezier(0.34,1.26,0.64,1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {/* Gradient base — shifts red when urgent */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: HOME_R,
                background: isUrgent
                  ? 'linear-gradient(145deg, rgba(239,68,68,0.55) 0%, rgba(180,20,20,0.40) 100%)'
                  : 'linear-gradient(145deg, rgba(245,158,11,0.55) 0%, rgba(180,100,0,0.40) 100%)',
                transition: 'background 0.4s ease',
              }} />
              {/* Top gloss */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: HOME_R,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 52%)',
                pointerEvents: 'none',
              }} />
              {/* Urgent count badge */}
              {isUrgent && (
                <div style={{
                  position: 'absolute', top: -5, right: -5,
                  background: 'rgb(239,68,68)',
                  color: '#fff',
                  fontSize: 8, fontWeight: 700,
                  minWidth: 16, height: 16,
                  borderRadius: 99,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1.5px solid rgba(6,8,16,0.9)',
                  zIndex: 5,
                  padding: '0 3px',
                }}>{urgentCount > 99 ? '99+' : urgentCount}</div>
              )}
              <Home style={{
                width: homeIconSz, height: homeIconSz,
                position: 'relative', zIndex: 2,
                color: homeIconColor,
                filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.60))',
                strokeWidth: 2.2,
                transition: 'color 0.4s ease',
              }} />
            </button>

            <span style={{
              fontSize: 9,
              fontWeight: isHome ? 700 : 400,
              color: isHome ? 'hsl(38 92% 55%)' : 'rgba(255,255,255,0.40)',
              letterSpacing: '0.02em',
              transition: 'color 0.22s ease',
              marginTop: 2,
            }}>Home</span>
          </div>

          {/* Right 2 items */}
          {NAV_ITEMS.slice(2).map(item => (
            <div key={item.path} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <NavIcon {...item} active={location.pathname === item.path} />
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}