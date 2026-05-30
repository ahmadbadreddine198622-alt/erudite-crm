/**
 * HeroDock — extreme luxury floating dock, desktop.
 * Materials: deep obsidian body, frosted crystal tiles, brushed-gold home button.
 * Icon tiles: jewel-tone inner glow — dark, muted, precious. Not candy-colored.
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutDashboard, Users, Building2, KanbanSquare, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Home',      icon: LayoutDashboard, path: '/',          gradient: 'from-blue-900 to-blue-950' },
  { label: 'Pipeline',  icon: KanbanSquare,    path: '/pipeline',  gradient: 'from-violet-900 to-purple-950' },
  { label: 'Leads',     icon: Users,           path: '/leads',     gradient: 'from-emerald-800 to-emerald-950' },
  { label: 'Property',  icon: Building2,       path: '/landlords', gradient: 'from-sky-900 to-cyan-950' },
  { label: 'More',      icon: Bell,            path: '/reminders', gradient: 'from-rose-900 to-red-950' },
];

function DockIcon({ icon: Icon, gradient, active, label }) {
  const [pressed, setPressed] = React.useState(false);
  const size = 50;
  const radius = `${Math.round(size * 0.22)}px`;

  return (
    <div
      className={cn(
        'relative flex flex-col items-center gap-2 px-3.5 py-1.5 cursor-pointer select-none transition-all duration-200',
        pressed ? 'scale-[0.96]' : active ? 'scale-105' : 'scale-100 hover:scale-[1.02]'
      )}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
    >
      <div style={{ width: size, height: size, borderRadius: radius, position: 'relative' }}>
        {/* Deep jewel-tone inner glow — dark, muted, NOT bright */}
        <div
          className={cn('absolute inset-0 bg-gradient-to-br opacity-72', gradient)}
          style={{ borderRadius: radius, filter: 'saturate(0.35) brightness(0.5)' }}
        />

        {/* Frosted crystal shell */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: active ? 'rgba(245,159,10,0.14)' : 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(32px) saturate(160%)',
            WebkitBackdropFilter: 'blur(32px) saturate(160%)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderTopColor: active ? 'rgba(245,159,10,0.38)' : 'rgba(255,255,255,0.22)',
            boxShadow: active
              ? '0 6px 20px rgba(245,159,10,0.22), inset 0 1px 0 rgba(255,255,255,0.14)'
              : '0 5px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)',
            transition: 'all 0.2s ease',
          }}
        />

        {/* Fine polished rim */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 48%)',
            pointerEvents: 'none',
          }}
        />

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
            zIndex: 2,
          }}
        />
      </div>

      {/* Label */}
      <span className={cn('text-[10px] font-medium tracking-wide transition-colors', active ? 'text-amber-500' : 'text-white/55')}>
        {label}
      </span>
    </div>
  );
}

export default function HeroDock() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 hidden md:block" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto max-w-2xl px-4 pb-7" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
        {/* Main dock bar — deep obsidian with fine gold hairline */}
        <div
          style={{
            background: 'rgba(8, 11, 18, 0.90)',
            backdropFilter: 'blur(44px) saturate(200%)',
            WebkitBackdropFilter: 'blur(44px) saturate(200%)',
            borderRadius: '30px',
            border: '1px solid rgba(255,255,255,0.10)',
            borderTopColor: 'rgba(255,255,255,0.18)',
            boxShadow: '0 20px 56px rgba(0,8,32,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
            padding: '11px 18px 11px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            position: 'relative',
          }}
        >
          {/* Fine gold hairline frame — jewelry, not paint */}
          <div className="absolute inset-0" style={{ borderRadius: '30px', border: '1px solid rgba(245,159,10,0.15)', pointerEvents: 'none' }} />

          {navItems.slice(0, 2).map((item) => (
            <Link key={item.path} to={item.path}>
              <DockIcon icon={item.icon} gradient={item.gradient} active={location.pathname === item.path} label={item.label} />
            </Link>
          ))}

          {/* Elevated center home button — the crown jewel, brushed gold */}
          <div style={{ position: 'relative', top: '-20px', zIndex: 10 }}>
            <Link to="/">
              <button
                className="transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97] group"
                style={{
                  width: 66, height: 66,
                  borderRadius: '22%',
                  background: 'rgba(245,159,10,0.10)',
                  backdropFilter: 'blur(36px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(36px) saturate(200%)',
                  border: '2px solid rgba(245,159,10,0.38)',
                  borderTopColor: 'rgba(255,255,255,0.42)',
                  boxShadow: '0 16px 48px rgba(245,159,10,0.28), inset 0 1px 0 rgba(255,255,255,0.22), 0 0 40px rgba(245,159,10,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', position: 'relative',
                }}
              >
                {/* Brushed metal gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-700 to-amber-900 opacity-30" style={{ borderRadius: '22%' }} />
                {/* Idle shimmer — slow, alive */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-[2000ms]"
                  style={{ borderRadius: '22%', background: 'linear-gradient(125deg, rgba(255,255,255,0) 35%, rgba(255,255,255,0.07) 45%, rgba(255,255,255,0) 55%)', animation: 'shimmer 4s ease-in-out infinite', pointerEvents: 'none' }} />
                {/* Polished top rim */}
                <div className="absolute inset-0" style={{ borderRadius: '22%', background: 'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 52%)', pointerEvents: 'none' }} />
                <Home className="relative z-10" style={{ width: 30, height: 30, color: 'hsl(38 92% 50%)', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.65))' }} />
              </button>
            </Link>
          </div>

          {navItems.slice(2).map((item) => (
            <Link key={item.path} to={item.path}>
              <DockIcon icon={item.icon} gradient={item.gradient} active={location.pathname === item.path} label={item.label} />
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}