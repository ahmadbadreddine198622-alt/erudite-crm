import React from 'react';
import LiquidGlassIcon from '@/components/ui/LiquidGlassIcon';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, KanbanSquare, DollarSign,
  Bell, ChevronLeft, LogOut, MessageCircle, Inbox, BarChart3, UserCheck, FileSignature, Brain, Calculator, Trophy, UserCircle, Zap, Instagram, Sparkles, Link2, GitMerge, Mail, FolderOpen, Key, Percent, TrendingUp, Crown
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

// Deep desaturated jewel tones matching ExtremeLiquidIcon in launcher
const navItems = [
  { label: 'Dashboard',         icon: LayoutDashboard, path: '/',                gradient: 'from-blue-900 to-blue-950' },
  { label: 'My Dashboard',      icon: UserCircle,      path: '/my-dashboard',    gradient: 'from-sky-900 to-blue-950' },
  { label: 'Pipeline',          icon: KanbanSquare,    path: '/pipeline',        gradient: 'from-violet-900 to-purple-950' },
  { label: 'Leads',             icon: Users,           path: '/leads',           gradient: 'from-emerald-800 to-emerald-950' },
  { label: 'Contacts',          icon: UserCheck,       path: '/contacts',        gradient: 'from-sky-900 to-cyan-950' },
  { label: 'Landlords',         icon: Building2,       path: '/landlords',       gradient: 'from-amber-900 to-orange-950' },
  { label: 'Projects',          icon: FolderOpen,      path: '/projects',        gradient: 'from-teal-900 to-teal-950' },
  { label: 'Analytics',         icon: BarChart3,       path: '/analytics',       gradient: 'from-purple-900 to-fuchsia-950' },
  { label: 'Team',              icon: UserCheck,       path: '/team',            gradient: 'from-slate-700 to-slate-900' },
  { label: 'Team AI OS',        icon: Brain,           path: '/team-os',         gradient: 'from-indigo-900 to-violet-950' },
  { label: 'Team Performance',  icon: Trophy,          path: '/team-dashboard',  gradient: 'from-yellow-900 to-amber-950' },
  { label: 'Offers',            icon: FileSignature,   path: '/offers',          gradient: 'from-cyan-900 to-blue-950' },
  { label: 'Finance',           icon: Calculator,      path: '/finance',         gradient: 'from-green-900 to-teal-950' },
  { label: 'Key Handover',      icon: Key,             path: '/key-handover',    gradient: 'from-orange-900 to-red-950' },
  { label: 'Transfer Calculator', icon: Percent,       path: '/transfer-calculator', gradient: 'from-amber-900 to-yellow-950' },
  { label: 'Commissions',       icon: DollarSign,      path: '/commissions',     gradient: 'from-amber-900 to-yellow-950' },
  { label: 'Reminders',         icon: Bell,            path: '/reminders',       gradient: 'from-rose-900 to-red-950' },
  { label: 'WhatsApp Inbox',    icon: MessageCircle,   path: '/whatsapp',        gradient: 'from-green-900 to-green-950' },
  { label: 'Inbox',             icon: Inbox,           path: '/inbox',           gradient: 'from-blue-900 to-indigo-950' },
  { label: 'WhatsApp Hub',      icon: Zap,             path: '/whatsapp-hub',    gradient: 'from-emerald-900 to-green-950' },
  { label: 'Meta & Google Leads', icon: Zap,           path: '/meta-ads-leads',  gradient: 'from-blue-900 to-sky-950' },
  { label: 'WhatsApp Setup',    icon: MessageCircle,   path: '/whatsapp-setup',  gradient: 'from-slate-800 to-slate-950' },
  { label: 'Instagram Leads',   icon: Instagram,       path: '/instagram',       gradient: 'from-fuchsia-900 to-pink-950' },
  { label: 'Duplicate Detector', icon: GitMerge,       path: '/duplicates',      gradient: 'from-orange-900 to-amber-950' },
  { label: 'Email Automations', icon: Mail,            path: '/email-automations', gradient: 'from-indigo-900 to-blue-950' },
  { label: 'Claude AI',         icon: Sparkles,        path: '/claude-ai',       gradient: 'from-violet-900 to-purple-950' },
  { label: 'Property Finder',   icon: Link2,           path: '/property-finder', gradient: 'from-red-900 to-rose-950' },
  { label: 'Dubai Intelligence', icon: TrendingUp,      path: '/dubai-intelligence', gradient: 'from-amber-900 to-orange-950' },
  { label: 'Elite Desk',         icon: Crown,           path: '/elite-desk',          gradient: 'from-amber-800 to-yellow-950' },
];

export default function Sidebar({ open = false, onClose }) {
  const location = useLocation();

  return (
    <aside className={cn(
      "fixed top-0 left-0 h-screen bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border z-50 w-[260px] transition-transform duration-300",
      open ? "translate-x-0" : "-translate-x-full"
    )}>
      {/* Logo + close */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-sidebar-border shrink-0">
        <img
          src="https://media.base44.com/images/public/69cabceaeeb8bb5e3a62ead3/af0e24497_EruditeLogoblack-Recovered2.png"
          alt="Erudite Property"
          className="h-10 w-auto object-contain invert"
        />
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={cn(
                'group flex items-center gap-3 px-2 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 relative',
                isActive
                  ? 'text-sidebar-foreground'
                  : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'
              )}
              style={isActive ? {
                borderLeft: '3px solid hsl(38 92% 50%)',
                paddingLeft: 'calc(0.5rem - 3px)',
                boxShadow: 'inset 0 0 16px rgba(245, 158, 11, 0.08), 0 2px 8px rgba(245, 158, 11, 0.06)',
              } : {}}
            >
              <LiquidGlassIcon
                icon={item.icon}
                gradient={item.gradient}
                size={32}
                active={isActive}
                className="flex-shrink-0"
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <Link
          to="/"
          onClick={onClose}
          className="flex items-center gap-3 px-2 py-1.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/40 w-full transition-all"
        >
          <LiquidGlassIcon icon={LayoutDashboard} gradient="from-blue-500 to-blue-700" size={32} className="flex-shrink-0" />
          <span>Dashboard</span>
        </Link>
        <button
          onClick={() => base44.auth.logout()}
          className="flex items-center gap-3 px-2 py-1.5 rounded-xl text-sm font-medium text-sidebar-foreground/60 hover:text-red-400 hover:bg-sidebar-accent/40 w-full transition-all"
        >
          <LiquidGlassIcon icon={LogOut} gradient="from-red-500 to-rose-700" size={32} className="flex-shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}