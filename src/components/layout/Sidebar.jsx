import React from 'react';
import IOSIcon from '@/components/ui/IOSIcon';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, KanbanSquare, DollarSign,
  Bell, ChevronLeft, LogOut, MessageCircle, Inbox, BarChart3, UserCheck, FileSignature, Brain, Calculator, Trophy, UserCircle, Zap, Instagram, Sparkles, Link2, GitMerge, Mail, FolderOpen, Key, Percent
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

// Each nav item gets an iOS-style gradient for its squircle icon
const navItems = [
  { label: 'Dashboard',         icon: LayoutDashboard, path: '/',                gradient: 'from-blue-500 to-blue-700' },
  { label: 'My Dashboard',      icon: UserCircle,      path: '/my-dashboard',    gradient: 'from-sky-400 to-cyan-600' },
  { label: 'Pipeline',          icon: KanbanSquare,    path: '/pipeline',        gradient: 'from-violet-500 to-purple-700' },
  { label: 'Leads',             icon: Users,           path: '/leads',           gradient: 'from-emerald-400 to-emerald-600' },
  { label: 'Contacts',          icon: Users,           path: '/contacts',        gradient: 'from-sky-400 to-cyan-600' },
  { label: 'Landlords',         icon: Building2,       path: '/landlords',       gradient: 'from-amber-400 to-orange-500' },
  { label: 'Projects',          icon: FolderOpen,      path: '/projects',        gradient: 'from-teal-400 to-teal-600' },
  { label: 'Analytics',         icon: BarChart3,       path: '/analytics',       gradient: 'from-purple-400 to-fuchsia-600' },
  { label: 'Team',              icon: UserCheck,       path: '/team',            gradient: 'from-slate-400 to-slate-600' },
  { label: 'Team AI OS',        icon: Brain,           path: '/team-os',         gradient: 'from-indigo-400 to-violet-600' },
  { label: 'Team Performance',  icon: Trophy,          path: '/team-dashboard',  gradient: 'from-yellow-400 to-amber-500' },
  { label: 'Offers',            icon: FileSignature,   path: '/offers',          gradient: 'from-cyan-400 to-blue-500' },
  { label: 'Finance',           icon: Calculator,      path: '/finance',         gradient: 'from-lime-400 to-green-500' },
  { label: 'Key Handover',      icon: Key,             path: '/key-handover',    gradient: 'from-orange-400 to-red-500' },
  { label: 'Transfer Calculator', icon: Percent,       path: '/transfer-calculator', gradient: 'from-amber-500 to-yellow-600' },
  { label: 'Commissions',       icon: DollarSign,      path: '/commissions',     gradient: 'from-yellow-500 to-orange-500' },
  { label: 'Reminders',         icon: Bell,            path: '/reminders',       gradient: 'from-red-400 to-rose-600' },
  { label: 'WhatsApp Inbox',    icon: MessageCircle,   path: '/whatsapp',        gradient: 'from-green-400 to-green-600' },
  { label: 'Inbox',             icon: Inbox,           path: '/inbox',           gradient: 'from-blue-400 to-indigo-600' },
  { label: 'WhatsApp Hub',      icon: Zap,             path: '/whatsapp-hub',    gradient: 'from-green-500 to-emerald-700' },
  { label: 'Meta & Google Leads', icon: Zap,           path: '/meta-ads-leads',  gradient: 'from-blue-500 to-sky-600' },
  { label: 'WhatsApp Setup',    icon: MessageCircle,   path: '/whatsapp-setup',  gradient: 'from-slate-500 to-slate-700' },
  { label: 'Instagram Leads',   icon: Instagram,       path: '/instagram',       gradient: 'from-pink-500 to-purple-600' },
  { label: 'Duplicate Detector', icon: GitMerge,       path: '/duplicates',      gradient: 'from-orange-400 to-red-500' },
  { label: 'Email Automations', icon: Mail,            path: '/email-automations', gradient: 'from-indigo-500 to-blue-600' },
  { label: 'Claude AI',         icon: Sparkles,        path: '/claude-ai',       gradient: 'from-violet-400 to-purple-600' },
  { label: 'Property Finder',   icon: Link2,           path: '/property-finder', gradient: 'from-red-500 to-rose-700' },
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
                'flex items-center gap-3 px-2 py-1.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-accent/70 text-sidebar-foreground shadow-sm'
                  : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40'
              )}
            >
              <IOSIcon
                icon={item.icon}
                gradient={item.gradient}
                size={32}
                active={isActive}
                style={{
                  boxShadow: isActive
                    ? '0 3px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
                    : '0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
                  flexShrink: 0,
                }}
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
          <IOSIcon icon={LayoutDashboard} gradient="from-blue-500 to-blue-700" size={32}
            style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }} />
          <span>Dashboard</span>
        </Link>
        <button
          onClick={() => base44.auth.logout()}
          className="flex items-center gap-3 px-2 py-1.5 rounded-xl text-sm font-medium text-sidebar-foreground/60 hover:text-red-400 hover:bg-sidebar-accent/40 w-full transition-all"
        >
          <IOSIcon icon={LogOut} gradient="from-red-500 to-rose-700" size={32}
            style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}