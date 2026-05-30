import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, KanbanSquare, DollarSign,
  Bell, ChevronLeft, LogOut, MessageCircle, Inbox, BarChart3, UserCheck, FileSignature, Brain, Calculator, Trophy, UserCircle, Zap, Instagram, Sparkles, Link2, GitMerge, Mail, FolderOpen, Key, Percent
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'My Dashboard', icon: UserCircle, path: '/my-dashboard' },
  { label: 'Pipeline', icon: KanbanSquare, path: '/pipeline' },
  { label: 'Leads', icon: Users, path: '/leads' },
  { label: 'Contacts', icon: Users, path: '/contacts' },
  { label: 'Landlords', icon: Building2, path: '/landlords' },
  { label: 'Projects', icon: FolderOpen, path: '/projects' },

  { label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { label: 'Team', icon: UserCheck, path: '/team' },
  { label: 'Team AI OS', icon: Brain, path: '/team-os' },
  { label: 'Team Performance', icon: Trophy, path: '/team-dashboard' },
  { label: 'Offers', icon: FileSignature, path: '/offers' },
  { label: 'Finance', icon: Calculator, path: '/finance' },
  { label: 'Key Handover', icon: Key, path: '/key-handover' },
  { label: 'Transfer Calculator', icon: Percent, path: '/transfer-calculator' },
  { label: 'Commissions', icon: DollarSign, path: '/commissions' },
  { label: 'Reminders', icon: Bell, path: '/reminders' },
  { label: 'WhatsApp Inbox', icon: MessageCircle, path: '/whatsapp' },
  { label: 'Inbox', icon: Inbox, path: '/inbox' },
  { label: 'WhatsApp Hub', icon: Zap, path: '/whatsapp-hub' },
  { label: 'Meta & Google Leads', icon: Zap, path: '/meta-ads-leads' },
  { label: 'WhatsApp Setup', icon: MessageCircle, path: '/whatsapp-setup' },
  { label: 'Instagram Leads', icon: Instagram, path: '/instagram' },
  { label: 'Duplicate Detector', icon: GitMerge, path: '/duplicates' },
  { label: 'Email Automations', icon: Mail, path: '/email-automations' },
  { label: 'Claude AI', icon: Sparkles, path: '/claude-ai' },
  { label: 'Property Finder', icon: Link2, path: '/property-finder' },
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
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
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
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-primary bg-sidebar-accent/50 hover:bg-sidebar-accent w-full transition-all"
        >
          <LayoutDashboard className="w-5 h-5 shrink-0" />
          <span>Dashboard</span>
        </Link>
        <button
          onClick={() => base44.auth.logout()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/60 hover:text-red-400 hover:bg-sidebar-accent w-full transition-all"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}