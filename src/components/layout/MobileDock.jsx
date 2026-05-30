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

function MobileDockIcon({ icon: Icon, gradient, active, label, onClick }) {
  const [pressed, setPressed] = React.useState(false);
  const size = 44;
  const radius = `${Math.round(size * 0.22)}px`;

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center gap-1 px-2 py-1 transition-all duration-150',
        pressed ? 'scale-90' : active ? 'scale-105' : 'scale-100'
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
        <div className={cn('absolute inset-0 bg-gradient-to-br opacity-40', gradient)} style={{ borderRadius: radius }} />
        <div
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: active ? 'rgba(245, 159, 10, 0.2)' : 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(24px) saturate(200%)',
            WebkitBackdropFilter: 'blur(24px) saturate(200%)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderTopColor: active ? 'rgba(245, 159, 10, 0.5)' : 'rgba(255, 255, 255, 0.3)',
            boxShadow: active
              ? '0 6px 20px rgba(245, 159, 10, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              : '0 5px 16px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          }}
        />
        <div className="absolute inset-0" style={{ borderRadius: radius, background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 50%)', pointerEvents: 'none' }} />
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
          }}
        />
      </div>
      <span className={cn('text-[9px] font-medium', active ? 'text-amber-500' : 'text-white/65')}>{label}</span>
    </button>
  );
}

export default function MobileDock() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div
        className="mx-auto max-w-sm px-3 pb-4"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          gap: '2px',
        }}
      >
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(36px) saturate(200%)',
            WebkitBackdropFilter: 'blur(36px) saturate(200%)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderTopColor: 'rgba(255, 255, 255, 0.25)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            padding: '8px 10px 8px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          <div style={{ position: 'relative', top: '-14px', zIndex: 10 }}>
            <Link to="/">
              <button
                className="transition-transform duration-150 hover:scale-105 active:scale-95"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '22%',
                  background: 'rgba(245, 159, 10, 0.15)',
                  backdropFilter: 'blur(28px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(28px) saturate(200%)',
                  border: '2px solid rgba(245, 159, 10, 0.45)',
                  borderTopColor: 'rgba(255, 255, 255, 0.45)',
                  boxShadow: '0 10px 32px rgba(245, 159, 10, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-amber-700 opacity-30" style={{ borderRadius: '22%' }} />
                <div className="absolute inset-0" style={{ borderRadius: '22%', background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 55%)', pointerEvents: 'none' }} />
                <Home className="relative z-10" style={{ width: 24, height: 24, color: 'hsl(38 92% 50%)', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.6))' }} />
              </button>
            </Link>
          </div>
          {navItems.slice(0, 2).map((item) => (
            <Link key={item.path} to={item.path}>
              <MobileDockIcon
                icon={item.icon}
                gradient={item.gradient}
                active={location.pathname === item.path}
                label={item.label}
              />
            </Link>
          ))}
          {navItems.slice(2).map((item) => (
            <Link key={item.path} to={item.path}>
              <MobileDockIcon
                icon={item.icon}
                gradient={item.gradient}
                active={location.pathname === item.path}
                label={item.label}
              />
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}