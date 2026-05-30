import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Building2, KanbanSquare, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

const LEFT_ITEMS = [
  { label: 'Pipeline', icon: KanbanSquare, path: '/pipeline', gradient: 'from-violet-500 to-purple-700' },
  { label: 'Leads',    icon: Users,        path: '/leads',    gradient: 'from-emerald-400 to-emerald-600' },
];

const RIGHT_ITEMS = [
  { label: 'Property', icon: Building2, path: '/landlords', gradient: 'from-sky-400 to-cyan-600' },
  { label: 'More',     icon: Bell,      path: '/reminders', gradient: 'from-red-400 to-rose-600' },
];

function NavIcon({ icon: Icon, gradient, active, label, path }) {
  const size = 44;
  const radius = `${Math.round(size * 0.22)}px`;
  return (
    <Link
      to={path}
      className="flex flex-col items-center gap-1 px-2 py-1 active:scale-90 transition-transform duration-150"
    >
      <div style={{ width: size, height: size, borderRadius: radius, position: 'relative' }}>
        <div
          className={cn('absolute inset-0 bg-gradient-to-br opacity-45', gradient)}
          style={{ borderRadius: radius }}
        />
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: active ? 'rgba(245, 159, 10, 0.18)' : 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderTopColor: active ? 'rgba(245, 159, 10, 0.55)' : 'rgba(255, 255, 255, 0.32)',
            boxShadow: active
              ? '0 6px 18px rgba(245, 159, 10, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              : '0 5px 14px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 50%)',
            pointerEvents: 'none',
          }}
        />
        <Icon
          className="absolute"
          style={{
            width: Math.round(size * 0.48),
            height: Math.round(size * 0.48),
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: active ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.9)',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
          }}
        />
      </div>
      <span className={cn('text-[9px] font-medium', active ? 'text-amber-500' : 'text-white/60')}>
        {label}
      </span>
    </Link>
  );
}

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav
      className="fixed left-0 right-0 z-[100] md:hidden"
      style={{
        bottom: 60,
        paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 0,
      }}
    >
      {/* Floating glass dock */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: 4,
          background: 'rgba(12, 18, 35, 0.88)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          borderRadius: 28,
          border: '1px solid rgba(255,255,255,0.15)',
          borderTopColor: 'rgba(255,255,255,0.28)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.1)',
          padding: '10px 12px 12px 12px',
        }}
      >
        {/* Left items */}
        {LEFT_ITEMS.map((item) => (
          <NavIcon
            key={item.path}
            {...item}
            active={location.pathname === item.path}
          />
        ))}

        {/* Center elevated home button */}
        <div style={{ position: 'relative', bottom: 16, zIndex: 10, marginLeft: 4, marginRight: 4 }}>
          <Link to="/">
            <div
              className="active:scale-90 transition-transform duration-150 flex items-center justify-center"
              style={{
                width: 60,
                height: 60,
                borderRadius: '22%',
                background: 'rgba(245, 159, 10, 0.15)',
                backdropFilter: 'blur(32px) saturate(200%)',
                WebkitBackdropFilter: 'blur(32px) saturate(200%)',
                border: '2px solid rgba(245, 159, 10, 0.5)',
                borderTopColor: 'rgba(255,255,255,0.5)',
                boxShadow: '0 12px 36px rgba(245,159,10,0.45), inset 0 1px 0 rgba(255,255,255,0.28), 0 0 24px rgba(245,159,10,0.2)',
                position: 'relative',
              }}
            >
              <div
                className="absolute inset-0 bg-gradient-to-br from-amber-500 to-amber-700 opacity-35"
                style={{ borderRadius: '22%' }}
              />
              <div
                className="absolute inset-0"
                style={{
                  borderRadius: '22%',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 55%)',
                  pointerEvents: 'none',
                }}
              />
              <Home
                className="relative z-10"
                style={{
                  width: 26,
                  height: 26,
                  color: 'hsl(38 92% 50%)',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
                }}
              />
            </div>
          </Link>
        </div>

        {/* Right items */}
        {RIGHT_ITEMS.map((item) => (
          <NavIcon
            key={item.path}
            {...item}
            active={location.pathname === item.path}
          />
        ))}
      </div>
    </nav>
  );
}