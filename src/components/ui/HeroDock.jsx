/**
 * HeroDock — extreme liquid glass floating dock with elevated center home button.
 * Features: heavy frosted blur, luminous rim, gold active glow, tactile center button.
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutDashboard, Users, Building2, KanbanSquare, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Home', icon: LayoutDashboard, path: '/', gradient: 'from-amber-500 to-amber-700' },
  { label: 'Pipeline', icon: KanbanSquare, path: '/pipeline', gradient: 'from-violet-500 to-purple-700' },
  { label: 'Leads', icon: Users, path: '/leads', gradient: 'from-emerald-400 to-emerald-600' },
  { label: 'Properties', icon: Building2, path: '/properties', gradient: 'from-sky-400 to-cyan-600' },
  { label: 'More', icon: Bell, path: '/reminders', gradient: 'from-red-400 to-rose-600' },
];

function DockIcon({ icon: Icon, gradient, active, label, onClick }) {
  const [pressed, setPressed] = React.useState(false);
  const size = 48;
  const radius = `${Math.round(size * 0.22)}px`;

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center gap-1.5 px-3 py-1 transition-all duration-150',
        pressed ? 'scale-90' : active ? 'scale-110' : 'scale-100 hover:scale-105'
      )}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          position: 'relative',
        }}
      >
        {/* Gradient tint */}
        <div
          className={cn('absolute inset-0 bg-gradient-to-br opacity-40', gradient)}
          style={{ borderRadius: radius }}
        />

        {/* Frosted glass */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: active
              ? 'rgba(245, 159, 10, 0.2)'
              : 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(28px) saturate(200%)',
            WebkitBackdropFilter: 'blur(28px) saturate(200%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderTopColor: active ? 'rgba(245, 159, 10, 0.6)' : 'rgba(255, 255, 255, 0.35)',
            boxShadow: active
              ? '0 8px 24px rgba(245, 159, 10, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)'
              : '0 6px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
            transition: 'all 0.15s ease',
          }}
        />

        {/* Top rim highlight */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 50%)',
            pointerEvents: 'none',
          }}
        />

        {/* Icon */}
        <Icon
          className="absolute"
          style={{
            width: Math.round(size * 0.5),
            height: Math.round(size * 0.5),
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: active ? 'hsl(38 92% 50%)' : 'rgba(255, 255, 255, 0.95)',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
            zIndex: 2,
          }}
        />
      </div>

      {/* Label */}
      <span
        className={cn(
          'text-[10px] font-medium transition-colors',
          active ? 'text-amber-500' : 'text-white/65'
        )}
      >
        {label}
      </span>
    </button>
  );
}

export default function HeroDock() {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 hidden md:block"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Floating dock container */}
      <div
        className="mx-auto max-w-2xl px-4 pb-6"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          position: 'relative',
        }}
      >
        {/* Main dock bar */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(40px) saturate(220%)',
            WebkitBackdropFilter: 'blur(40px) saturate(220%)',
            borderRadius: '28px',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderTopColor: 'rgba(255, 255, 255, 0.3)',
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
            padding: '10px 16px 10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            position: 'relative',
          }}
        >
          {navItems.slice(0, 2).map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <DockIcon
                  icon={item.icon}
                  gradient={item.gradient}
                  active={isActive}
                  label={item.label}
                />
              </Link>
            );
          })}

          {/* Elevated center home button */}
          <div
            style={{
              position: 'relative',
              top: '-18px',
              zIndex: 10,
            }}
          >
            <Link to="/">
              <button
                className="transition-transform duration-150 hover:scale-105 active:scale-95"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '22%',
                  background: 'rgba(245, 159, 10, 0.15)',
                  backdropFilter: 'blur(32px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(32px) saturate(200%)',
                  border: '2px solid rgba(245, 159, 10, 0.5)',
                  borderTopColor: 'rgba(255, 255, 255, 0.5)',
                  boxShadow: '0 12px 40px rgba(245, 159, 10, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 0 30px rgba(245, 159, 10, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                {/* Gradient tint */}
                <div
                  className="absolute inset-0 bg-gradient-to-br from-amber-500 to-amber-700 opacity-30"
                  style={{ borderRadius: '22%' }}
                />

                {/* Top rim */}
                <div
                  className="absolute inset-0"
                  style={{
                    borderRadius: '22%',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 55%)',
                    pointerEvents: 'none',
                  }}
                />

                {/* Home icon */}
                <Home
                  className="relative z-10"
                  style={{
                    width: 28,
                    height: 28,
                    color: 'hsl(38 92% 50%)',
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
                  }}
                />
              </button>
            </Link>
          </div>

          {navItems.slice(2).map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <DockIcon
                  icon={item.icon}
                  gradient={item.gradient}
                  active={isActive}
                  label={item.label}
                />
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}