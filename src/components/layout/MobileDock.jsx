/**
 * MobileDock — Premium iOS-grade floating nav bar.
 * Squircle icon containers, amber glow active state, dimensional depth.
 */

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, Building2, KanbanSquare, MoreHorizontal, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Pipeline',  icon: KanbanSquare, path: '/pipeline',  color: 'rgba(139,92,246,1)',  glow: 'rgba(139,92,246,0.55)' },
  { label: 'Leads',     icon: Users,        path: '/leads',     color: 'rgba(16,185,129,1)',  glow: 'rgba(16,185,129,0.55)' },
  // center Home slot
  { label: 'Contacts',  icon: UserCheck,    path: '/contacts',  color: 'rgba(14,165,233,1)',  glow: 'rgba(14,165,233,0.55)' },
  { label: 'More',      icon: MoreHorizontal, path: '/reminders', color: 'rgba(244,63,94,1)', glow: 'rgba(244,63,94,0.55)' },
];

const SQUIRCLE_SIZE = 46;
const SQUIRCLE_R = Math.round(SQUIRCLE_SIZE * 0.24);

function NavIcon({ icon: Icon, label, path, color, glow, active }) {
  const [pressed, setPressed] = React.useState(false);
  const sz = SQUIRCLE_SIZE;
  const r = `${SQUIRCLE_R}px`;
  const iconSz = Math.round(sz * 0.52);

  return (
    <Link
      to={path}
      className="flex flex-col items-center gap-1 select-none"
      style={{ WebkitTapHighlightColor: 'transparent' }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
    >
      {/* Outer glow halo — only on active */}
      {active && (
        <div
          style={{
            position: 'absolute',
            width: sz + 20,
            height: sz + 20,
            borderRadius: `${SQUIRCLE_R + 5}px`,
            background: glow,
            filter: 'blur(14px)',
            opacity: 0.55,
            pointerEvents: 'none',
            transform: 'translate(-50%, -50%)',
            top: '50%', left: '50%',
            zIndex: 0,
          }}
        />
      )}

      {/* Squircle container */}
      <div
        style={{
          width: sz,
          height: sz,
          borderRadius: r,
          position: 'relative',
          transform: pressed ? 'scale(0.93)' : active ? 'scale(1.06)' : 'scale(1)',
          transition: 'transform 0.2s cubic-bezier(0.34,1.26,0.64,1), box-shadow 0.22s ease',
          boxShadow: active
            ? `0 6px 22px ${glow}, 0 2px 8px rgba(0,0,0,0.35)`
            : '0 2px 10px rgba(0,0,0,0.4)',
          zIndex: 1,
        }}
      >
        {/* Gradient base */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: r,
          background: active
            ? `linear-gradient(145deg, ${color} 0%, ${color.replace('1)', '0.7)')} 100%)`
            : 'linear-gradient(145deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 100%)',
          transition: 'background 0.22s ease',
        }} />

        {/* Frosted glass overlay */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: r,
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: active ? `1.5px solid rgba(255,255,255,0.30)` : '1px solid rgba(255,255,255,0.10)',
          borderTopColor: active ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.18)',
          transition: 'border-color 0.22s ease',
        }} />

        {/* Top gloss highlight */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: r,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 50%)',
          pointerEvents: 'none',
        }} />

        {/* Icon glyph */}
        <Icon style={{
          position: 'absolute',
          width: iconSz, height: iconSz,
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          color: active ? '#fff' : 'rgba(255,255,255,0.50)',
          filter: active ? `drop-shadow(0 2px 6px ${glow})` : 'none',
          strokeWidth: 2,
          transition: 'color 0.22s ease, filter 0.22s ease',
          zIndex: 2,
        }} />
      </div>

      <span style={{
        fontSize: 9,
        fontWeight: active ? 600 : 400,
        color: active ? 'hsl(38 92% 55%)' : 'rgba(255,255,255,0.40)',
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
            {/* Outer amber glow bloom */}
            <div style={{
              position: 'absolute',
              width: HOME_SIZE + 28,
              height: HOME_SIZE + 28,
              borderRadius: `${Math.round(HOME_SIZE * 0.24) + 7}px`,
              background: 'rgba(245,158,11,0.38)',
              filter: 'blur(18px)',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -56%)',
              pointerEvents: 'none',
              zIndex: 0,
            }} />

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
                border: `2px solid rgba(245,158,11,${isHome ? '0.55' : '0.30'})`,
                borderTopColor: `rgba(255,255,255,${isHome ? '0.55' : '0.35'})`,
                boxShadow: isHome
                  ? '0 14px 42px rgba(245,158,11,0.50), 0 4px 16px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.22)'
                  : '0 8px 28px rgba(245,158,11,0.25), 0 2px 10px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.14)',
                background: isHome ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.09)',
                backdropFilter: 'blur(32px) saturate(200%)',
                WebkitBackdropFilter: 'blur(32px) saturate(200%)',
                cursor: 'pointer',
                transition: 'all 0.22s cubic-bezier(0.34,1.26,0.64,1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {/* Amber gradient base */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: HOME_R,
                background: 'linear-gradient(145deg, rgba(245,158,11,0.55) 0%, rgba(180,100,0,0.40) 100%)',
              }} />
              {/* Top gloss */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: HOME_R,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 52%)',
                pointerEvents: 'none',
              }} />
              <Home style={{
                width: homeIconSz, height: homeIconSz,
                position: 'relative', zIndex: 2,
                color: 'hsl(38 92% 55%)',
                filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.60))',
                strokeWidth: 2.2,
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