import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, KanbanSquare, DollarSign,
  Bell, Map, ChevronLeft, ChevronRight, LogOut, MessageCircle, Inbox, BarChart3, UserCheck, FileSignature, Brain, Calculator, Trophy
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Pipeline', icon: KanbanSquare, path: '/pipeline' },
  { label: 'Leads', icon: Users, path: '/leads' },
  { label: 'Contacts', icon: Users, path: '/contacts' },
  { label: 'Properties', icon: Building2, path: '/properties' },
  { label: 'Map', icon: Map, path: '/map' },
  { label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { label: 'Team', icon: UserCheck, path: '/team' },
  { label: 'Team AI OS', icon: Brain, path: '/team-os' },
  { label: 'Team Performance', icon: Trophy, path: '/team-dashboard' },
  { label: 'Offers', icon: FileSignature, path: '/offers' },
  { label: 'Finance', icon: Calculator, path: '/finance' },
  { label: 'Commissions', icon: DollarSign, path: '/commissions' },
  { label: 'Reminders', icon: Bell, path: '/reminders' },
  { label: 'WhatsApp', icon: MessageCircle, path: '/whatsapp' },
  { label: 'Inbox', icon: Inbox, path: '/inbox' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside className={cn(
      "h-screen bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border transition-all duration-300 sticky top-0",
      collapsed ? "w-[72px]" : "w-[260px]"
    )}>
      {/* Logo */}
      <div className="flex items-center justify-center px-4 h-16 border-b border-sidebar-border shrink-0">
        {collapsed ? (
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
        ) : (
          <img
            src="https://media.base44.com/images/public/69cabceaeeb8bb5e3a62ead3/af0e24497_EruditeLogoblack-Recovered2.png"
            alt="Erudite Property"
            className="h-10 w-auto object-contain invert"
          />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent w-full transition-all"
        >
          {collapsed ? <ChevronRight className="w-5 h-5 shrink-0" /> : <ChevronLeft className="w-5 h-5 shrink-0" />}
          {!collapsed && <span>Collapse</span>}
        </button>
        <button
          onClick={() => base44.auth.logout()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/60 hover:text-red-400 hover:bg-sidebar-accent w-full transition-all"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}