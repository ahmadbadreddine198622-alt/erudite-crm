/**
 * MobileDock — extreme luxury floating dock, mobile.
 * Icon tiles: deep jewel-tone glow, NOT bright candy gradients.
 */

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, LayoutDashboard, Users, Building2, KanbanSquare, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Home',      icon: LayoutDashboard, path: '/',          gradient: 'from-blue-900 to-blue-950' },
  { label: 'Pipeline',  icon: KanbanSquare,    path: '/pipeline',  gradient: 'from-violet-900 to-purple-950' },
  { label: 'Leads',     icon: Users,           path: '/leads',     gradient: 'from-emerald-800 to-emerald-950' },
  { label: 'Property',  icon: Building2,       path: '/landlords', gradient: 'from-sky-900 to-cyan-950' },
  { label: 'More',      icon: Bell,            path: '/reminders', gradient: 'from-rose-900 to-red-950' },
];

function MobileDockIcon({ icon: Icon, gradient, active, label }) {
  const [pressed, setPressed] = React.useState(false);
  const size = 46;
  const radius = `${Math.round(size * 0.22)}px`;

  return (
    <div
      className={cn(
        'relative flex flex-col items-center gap-1.5 px-2.5 py-1.5 select-none cursor-pointer transition-all duration-200',
        pressed ? 'scale-[0.96]' : active ? 'scale-105' : 'scale-100'
      )}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
    >
      <div style={{ width: size, height: size, borderRadius: radius, position: 'relative' }}>
        {/* Deep jewel-tone inner glow — dark, muted, NOT candy */}
        <div
          className={cn('absolute inset-0 bg-gradient-to-br opacity-72', gradient)}
          style={{ borderRadius: radius, filter: 'saturate(0.35) brightness(0.5)' }}
        />

        {/* Frosted crystal shell */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: active ? 'rgba(245,159,10,0.12)' : 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(28px) saturate(160%)',
            WebkitBackdropFilter: 'blur(28px) saturate(160%)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderTopColor: active ? 'rgba(245,159,10,0.35)' : 'rgba(255,255,255,0.20)',
            boxShadow: active
              ? '0 5px 18px rgba(245,159,10,0.20), inset 0 1px 0 rgba(255,255,255,0.12)'
              : '0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        />

        {/* Fine polished rim */}
        <div className="absolute inset-0" style={{ borderRadius: radius, background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 48%)', pointerEvents: 'none' }} />

        {/* Glyph */}
        <Icon
          className="absolute"
          style={{
            width: Math.round(size * 0.46),
            height: Math.round(size * 0.46),
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            color: active ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.88)',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.55))',
          }}
        />
      </div>
      <span className={cn('text-[9px] font-medium tracking-wide', active ? 'text-amber-500' : 'text-white/52')}>{label}</span>
    </div>
  );
}

export default function MobileDock() {
  const location = useLocation();
  const navigate = useNavigate();

  const goHome = React.useCallback((e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    navigate('/');
  }, [navigate]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto max-w-sm px-3 pb-5" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
        {/* Dock bar — deep obsidian, fine gold hairline */}
        <div
          style={{
            background: 'rgba(8, 11, 18, 0.92)',
            backdropFilter: 'blur(40px) saturate(200%)',
            WebkitBackdropFilter: 'blur(40px) saturate(200%)',
            borderRadius: '26px',
            border: '1px solid rgba(255,255,255,0.09)',
            borderTopColor: 'rgba(255,255,255,0.16)',
            boxShadow: '0 16px 48px rgba(0,8,32,0.65), inset 0 1px 0 rgba(255,255,255,0.05)',
            padding: '9px 12px 9px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            position: 'relative',
          }}
        >
          {/* Fine gold hairline */}
          <div className="absolute inset-0" style={{ borderRadius: '26px', border: '1px solid rgba(245,159,10,0.13)', pointerEvents: 'none' }} />

          {navItems.slice(0, 2).map((item) => (
            <Link key={item.path} to={item.path}>
              <MobileDockIcon icon={item.icon} gradient={item.gradient} active={location.pathname === item.path} label={item.label} />
            </Link>
          ))}

          {/* Elevated center home button — brushed gold crown jewel */}
          <button
            type="button"
            onClick={goHome}
            onTouchEnd={goHome}
            aria-label="Home"
            aria-current={location.pathname === '/' ? 'page' : undefined}
            className="transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97] relative group"
            style={{
              position: 'relative', top: '-16px', zIndex: 10,
              width: 58, height: 58, borderRadius: '22%',
              background: 'rgba(245,159,10,0.10)',
              backdropFilter: 'blur(32px) saturate(200%)',
              WebkitBackdropFilter: 'blur(32px) saturate(200%)',
              border: '2px solid rgba(245,159,10,0.34)',
              borderTopColor: 'rgba(255,255,255,0.40)',
              boxShadow: '0 12px 38px rgba(245,159,10,0.26), inset 0 1px 0 rgba(255,255,255,0.20)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', margin: '0 5px',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-700 to-amber-900 opacity-28 pointer-events-none" style={{ borderRadius: '22%' }} />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-[2000ms]"
              style={{ borderRadius: '22%', background: 'linear-gradient(125deg, rgba(255,255,255,0) 35%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 55%)', animation: 'shimmer 4s ease-in-out infinite', pointerEvents: 'none' }} />
            <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '22%', background: 'linear-gradient(180deg, rgba(255,255,255,0.40) 0%, rgba(255,255,255,0) 52%)' }} />
            <Home className="relative z-10 pointer-events-none" style={{ width: 26, height: 26, color: 'hsl(38 92% 50%)', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.65))' }} />
          </button>

          {navItems.slice(2).map((item) => (
            <Link key={item.path} to={item.path}>
              <MobileDockIcon icon={item.icon} gradient={item.gradient} active={location.pathname === item.path} label={item.label} />
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}