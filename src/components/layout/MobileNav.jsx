import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, KanbanSquare, DollarSign, Bell, Map
} from 'lucide-react';
import LiquidGlassNavIcon from '@/components/ui/LiquidGlassNavIcon';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Home', icon: LayoutDashboard, path: '/', gradient: 'from-amber-500 to-amber-700' },
  { label: 'Pipeline', icon: KanbanSquare, path: '/pipeline', gradient: 'from-violet-500 to-purple-700' },
  { label: 'Leads', icon: Users, path: '/leads', gradient: 'from-emerald-400 to-emerald-600' },
  { label: 'Properties', icon: Building2, path: '/properties', gradient: 'from-sky-400 to-cyan-600' },
  { label: 'More', icon: Bell, path: '/reminders', gradient: 'from-red-400 to-rose-600' },
];

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-4 left-0 right-0 z-50 md:hidden px-4" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Floating frosted glass pill bar */}
      <div
        className="mx-auto max-w-sm"
        style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderTopColor: 'rgba(255, 255, 255, 0.25)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          padding: '8px 12px',
        }}
      >
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <LiquidGlassNavIcon
                  icon={item.icon}
                  gradient={item.gradient}
                  active={isActive}
                  size={48}
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