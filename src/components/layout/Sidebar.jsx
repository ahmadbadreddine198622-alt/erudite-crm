import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import LiquidGlassIcon from '@/components/ui/LiquidGlassIcon';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, KanbanSquare, DollarSign,
  Bell, ChevronLeft, LogOut, MessageCircle, Inbox, BarChart3, UserCheck, FileSignature, Brain, Calculator, Trophy, UserCircle, Zap, Instagram, Sparkles, Link2, GitMerge, Mail, FolderOpen, Key, Percent, TrendingUp, Crown, User, FileText, Mic, ScrollText, NotebookPen,
  Handshake, Repeat, Eye, FileBox, Megaphone, LineChart, UserSearch, CheckCircle, Camera
} from 'lucide-react';

import { cn } from '@/lib/utils';

// permission: which permission key is required (undefined = everyone sees it)
// adminOnly: true = only admin role sees it
const navItems = [
  { label: 'Dashboard',           icon: LayoutDashboard, path: '/',                    gradient: 'from-blue-600 to-blue-800' },
  { label: 'My Dashboard',        icon: UserCircle,      path: '/my-dashboard',        gradient: 'from-blue-500 to-indigo-700' },
  { label: 'Pipeline',            icon: KanbanSquare,    path: '/pipeline',            gradient: 'from-violet-600 to-purple-800', permission: 'view_all_pipeline' },
  { label: 'Leads',               icon: Users,           path: '/leads',               gradient: 'from-emerald-500 to-emerald-800' },
  { label: 'Contacts',            icon: UserCheck,       path: '/contacts',            gradient: 'from-sky-500 to-cyan-800' },
  { label: 'Landlords',           icon: Building2,       path: '/landlords',           gradient: 'from-amber-500 to-orange-700', permission: 'manage_landlords' },
  { label: 'Form A Inbox',        icon: FileSignature,   path: '/form-a-inbox',        gradient: 'from-amber-600 to-yellow-700', adminOnly: true },
  { label: 'Projects',            icon: FolderOpen,      path: '/projects',            gradient: 'from-teal-500 to-teal-800' },
  { label: 'Analytics',           icon: BarChart3,       path: '/analytics',           gradient: 'from-purple-500 to-fuchsia-800', permission: 'view_analytics' },
  { label: 'Team',                icon: UserCheck,       path: '/team',                gradient: 'from-slate-500 to-slate-700' },
  { label: 'Team AI OS',          icon: Brain,           path: '/team-os',             gradient: 'from-indigo-500 to-violet-800', adminOnly: true },
  { label: 'Team Performance',    icon: Trophy,          path: '/team-dashboard',      gradient: 'from-yellow-500 to-amber-700', permission: 'view_analytics' },
  { label: 'Offers',              icon: FileSignature,   path: '/offers',              gradient: 'from-cyan-500 to-blue-800' },
  { label: 'Finance',             icon: Calculator,      path: '/finance',             gradient: 'from-green-500 to-teal-800', permission: 'view_finance' },
  { label: 'Key Handover',        icon: Key,             path: '/key-handover',        gradient: 'from-orange-500 to-red-700' },
  { label: 'Transfer Calculator', icon: Percent,         path: '/transfer-calculator', gradient: 'from-amber-500 to-yellow-700' },
  { label: 'Commissions',         icon: DollarSign,      path: '/commissions',         gradient: 'from-amber-400 to-yellow-700', permission: 'view_finance' },
  { label: 'Reminders',           icon: Bell,            path: '/reminders',           gradient: 'from-rose-500 to-red-700' },
  { label: 'WhatsApp Inbox',      icon: MessageCircle,   path: '/whatsapp',            gradient: 'from-green-500 to-green-800', permission: 'view_all_whatsapp' },
  { label: 'Inbox',               icon: Inbox,           path: '/inbox',               gradient: 'from-blue-600 to-indigo-800' },
  { label: 'WhatsApp Hub',        icon: Zap,             path: '/whatsapp-hub',        gradient: 'from-emerald-500 to-green-700', permission: 'view_all_whatsapp' },
  { label: 'Meta & Google Leads', icon: Zap,             path: '/meta-ads-leads',      gradient: 'from-blue-500 to-sky-700', adminOnly: true },
  { label: 'WhatsApp Setup',      icon: MessageCircle,   path: '/whatsapp-setup',      gradient: 'from-slate-500 to-slate-700', adminOnly: true },
  { label: 'Instagram Leads',     icon: Instagram,       path: '/instagram',           gradient: 'from-fuchsia-500 to-pink-700', adminOnly: true },
  { label: 'Duplicate Detector',  icon: GitMerge,        path: '/duplicates',          gradient: 'from-orange-500 to-amber-700', adminOnly: true },
  { label: 'Email Automations',   icon: Mail,            path: '/email-automations',   gradient: 'from-indigo-500 to-blue-800', adminOnly: true },
  { label: 'Claude AI',           icon: Sparkles,        path: '/claude-ai',           gradient: 'from-violet-500 to-purple-800' },
  { label: 'Property Finder',     icon: Link2,           path: '/property-finder',     gradient: 'from-red-500 to-rose-700', adminOnly: true },
  { label: 'Dubai Intelligence',  icon: TrendingUp,      path: '/dubai-intelligence',  gradient: 'from-amber-500 to-orange-700' },
  { label: 'Elite Desk',          icon: Crown,           path: '/elite-desk',          gradient: 'from-amber-500 to-yellow-700' },
  { label: 'Lease Agreement',     icon: FileText,        path: '/lease-agreement',     gradient: 'from-indigo-500 to-slate-700' },
  { label: 'Tenancy Contracts',   icon: ScrollText,      path: '/tenancy-contracts',   gradient: 'from-teal-500 to-cyan-800' },
  { label: 'Leaderboard',         icon: Trophy,          path: '/leaderboard',         gradient: 'from-yellow-500 to-amber-700' },
  { label: 'AI Voice',            icon: Mic,             path: '/vapi',                gradient: 'from-violet-500 to-purple-800' },
  { label: 'Smart Notes',         icon: NotebookPen,     path: '/notes',               gradient: 'from-lime-500 to-emerald-700' },
  // ERUDITE OS Modules
  { label: 'Negotiations',        icon: Handshake,       path: '/negotiations',        gradient: 'from-amber-500 to-orange-700' },
  { label: 'Follow Ups',          icon: Repeat,          path: '/follow-ups',          gradient: 'from-rose-500 to-pink-700' },
  { label: 'Viewings',            icon: Eye,             path: '/viewings',            gradient: 'from-blue-500 to-indigo-700' },
  { label: 'Email Templates',     icon: FileBox,         path: '/email-templates',     gradient: 'from-sky-500 to-cyan-700' },
  { label: 'Broadcasts',          icon: Megaphone,       path: '/broadcasts',          gradient: 'from-purple-500 to-violet-700' },
  { label: 'Property Intel',      icon: Building2,       path: '/property-intel',      gradient: 'from-emerald-500 to-teal-700' },
  { label: 'Market Intelligence', icon: LineChart,       path: '/market-intelligence', gradient: 'from-indigo-500 to-blue-700' },
  { label: 'Buyer Match AI',      icon: UserSearch,      path: '/buyer-match-ai',      gradient: 'from-pink-500 to-rose-700' },
  { label: 'Closing AI',          icon: CheckCircle,     path: '/closing-ai',          gradient: 'from-green-500 to-emerald-700' },
  { label: 'Photography',         icon: Camera,          path: '/photography',         gradient: 'from-rose-500 to-pink-700' },
];

export default function Sidebar({ open = false, onClose }) {
  const location = useLocation();
  const { isAdmin, permissions } = useCurrentUser();

  const visibleNav = navItems.filter(item => {
    if (isAdmin) return true;
    if (item.adminOnly) return false;
    if (item.permission && !permissions[item.permission]) return false;
    return true;
  });

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
        {visibleNav.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={cn(
                'group flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-medium transition-all duration-200 relative',
                isActive
                  ? 'text-white'
                  : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/5'
              )}
              style={isActive ? {
                background: 'rgba(245,158,11,0.12)',
                borderLeft: '3px solid hsl(38 92% 50%)',
                paddingLeft: 'calc(0.5rem - 3px)',
                boxShadow: '0 2px 12px rgba(245,158,11,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
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
          to="/profile"
          onClick={onClose}
          className="flex items-center gap-3 px-2 py-1.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/40 w-full transition-all"
        >
          <LiquidGlassIcon icon={User} gradient="from-slate-500 to-slate-700" size={32} className="flex-shrink-0" />
          <span>My Profile</span>
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