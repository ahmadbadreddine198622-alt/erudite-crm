import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  LayoutDashboard, Users, Building2, KanbanSquare, DollarSign,
  Bell, MessageCircle, Inbox, BarChart3, UserCheck, FileSignature,
  Calculator, Trophy, UserCircle, Zap, Instagram, Sparkles, Link2,
  GitMerge, Mail, FolderOpen, Brain, MapPin, Search, Handshake
} from 'lucide-react';

const ALL_APPS = [
  { label: 'My Dashboard',      icon: UserCircle,     path: '/my-dashboard',       gradient: 'from-blue-500 to-blue-700',          shadow: 'shadow-blue-500/30' },
  { label: 'Pipeline',          icon: KanbanSquare,   path: '/pipeline',            gradient: 'from-violet-500 to-purple-700',       shadow: 'shadow-violet-500/30' },
  { label: 'Leads',             icon: Users,          path: '/leads',               gradient: 'from-emerald-400 to-emerald-600',     shadow: 'shadow-emerald-500/30',  badgeKey: 'leads' },
  { label: 'Contacts',          icon: UserCheck,      path: '/contacts',            gradient: 'from-sky-400 to-cyan-600',            shadow: 'shadow-sky-500/30' },
  { label: 'Landlords',         icon: Building2,      path: '/landlords',           gradient: 'from-amber-400 to-orange-500',        shadow: 'shadow-amber-500/30' },
  { label: 'Projects',          icon: FolderOpen,     path: '/projects',            gradient: 'from-teal-400 to-teal-600',           shadow: 'shadow-teal-500/30' },
  { label: 'WhatsApp',          icon: MessageCircle,  path: '/whatsapp',            gradient: 'from-green-400 to-green-600',         shadow: 'shadow-green-500/30',    badgeKey: 'whatsapp' },
  { label: 'Inbox',             icon: Inbox,          path: '/inbox',               gradient: 'from-blue-400 to-indigo-600',         shadow: 'shadow-indigo-500/30' },
  { label: 'Reminders',         icon: Bell,           path: '/reminders',           gradient: 'from-red-400 to-rose-600',            shadow: 'shadow-red-500/30',       badgeKey: 'reminders' },
  { label: 'Analytics',         icon: BarChart3,      path: '/analytics',           gradient: 'from-purple-400 to-fuchsia-600',      shadow: 'shadow-purple-500/30' },
  { label: 'Sales Analytics',   icon: BarChart3,      path: '/sales-analytics',     gradient: 'from-pink-400 to-rose-500',           shadow: 'shadow-pink-500/30' },
  { label: 'Team',              icon: Users,          path: '/team',                gradient: 'from-slate-400 to-slate-600',         shadow: 'shadow-slate-500/30' },
  { label: 'Team AI OS',        icon: Brain,          path: '/team-os',             gradient: 'from-indigo-400 to-violet-600',       shadow: 'shadow-indigo-500/30' },
  { label: 'Team Performance',  icon: Trophy,         path: '/team-dashboard',      gradient: 'from-yellow-400 to-amber-500',        shadow: 'shadow-yellow-500/30' },
  { label: 'Offers',            icon: FileSignature,  path: '/offers',              gradient: 'from-cyan-400 to-blue-500',           shadow: 'shadow-cyan-500/30' },
  { label: 'Finance',           icon: Calculator,     path: '/finance',             gradient: 'from-lime-400 to-green-500',          shadow: 'shadow-lime-500/30' },
  { label: 'Commissions',       icon: DollarSign,     path: '/commissions',         gradient: 'from-yellow-500 to-orange-500',       shadow: 'shadow-orange-500/30' },
  { label: 'Map View',          icon: MapPin,         path: '/map',                 gradient: 'from-teal-500 to-cyan-600',           shadow: 'shadow-teal-500/30' },
  { label: 'WhatsApp Hub',      icon: Zap,            path: '/whatsapp-hub',        gradient: 'from-green-500 to-emerald-700',       shadow: 'shadow-green-500/30' },
  { label: 'Meta & Google',     icon: Zap,            path: '/meta-ads-leads',      gradient: 'from-blue-500 to-sky-600',            shadow: 'shadow-blue-500/30' },
  { label: 'Instagram Leads',   icon: Instagram,      path: '/instagram',           gradient: 'from-pink-500 to-purple-600',         shadow: 'shadow-pink-500/30' },
  { label: 'Property Finder',   icon: Link2,          path: '/property-finder',     gradient: 'from-red-500 to-rose-700',            shadow: 'shadow-red-500/30' },
  { label: 'Duplicate Detector',icon: GitMerge,       path: '/duplicates',          gradient: 'from-orange-400 to-red-500',          shadow: 'shadow-orange-500/30' },
  { label: 'Email Automations', icon: Mail,           path: '/email-automations',   gradient: 'from-indigo-500 to-blue-600',         shadow: 'shadow-indigo-500/30' },
  { label: 'Claude AI',         icon: Sparkles,       path: '/claude-ai',           gradient: 'from-violet-400 to-purple-600',       shadow: 'shadow-violet-500/30' },
  { label: 'WhatsApp Setup',    icon: MessageCircle,  path: '/whatsapp-setup',      gradient: 'from-slate-500 to-slate-700',         shadow: 'shadow-slate-500/30' },
  { label: 'Form A Referral',   icon: Handshake,      path: '/form-a-referral',     gradient: 'from-amber-400 to-orange-500',        shadow: 'shadow-amber-500/30' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 200),
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders-pending'],
    queryFn: () => base44.entities.Reminder.filter({ status: 'pending' }, '-due_date', 50),
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['wa-conversations'],
    queryFn: () => base44.entities.WhatsAppConversation.filter({ status: 'open' }, '-last_message_at', 50),
  });

  const badges = {
    leads:     leads.filter(l => l.status === 'active').length,
    reminders: reminders.length,
    whatsapp:  conversations.reduce((s, c) => s + (c.unread_count || 0), 0),
  };

  const filtered = search.trim()
    ? ALL_APPS.filter(a => a.label.toLowerCase().includes(search.toLowerCase()))
    : ALL_APPS;

  return (
    <div
      className="min-h-screen flex flex-col items-center py-10 px-6"
      style={{
        background: 'radial-gradient(ellipse at 20% 20%, #1a2a4a 0%, #0F1419 45%, #121821 100%)',
      }}
    >
      {/* Date & greeting */}
      <div className="text-center mb-8">
        <p className="text-4xl font-light text-white/90 tracking-tight">
          {format(new Date(), 'h:mm')}
          <span className="text-xl ml-1 text-white/50">{format(new Date(), 'a')}</span>
        </p>
        <p className="text-sm text-white/40 mt-1">{format(new Date(), 'EEEE, MMMM d')}</p>
      </div>

      {/* Search */}
      <div className="relative mb-10 w-full max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search"
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/10 backdrop-blur-md text-white placeholder-white/40 text-sm border border-white/10 focus:outline-none focus:border-white/30 focus:bg-white/15 transition-all"
        />
      </div>

      {/* App Grid */}
      <div className="w-full max-w-5xl grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-x-4 gap-y-7">
        {filtered.map((app) => {
          const Icon = app.icon;
          const badgeCount = app.badgeKey ? badges[app.badgeKey] : 0;

          return (
            <button
              key={app.path}
              onClick={() => navigate(app.path)}
              className="flex flex-col items-center gap-2 group focus:outline-none"
            >
              {/* Icon */}
              <div className="relative">
                <div
                  className={`w-16 h-16 rounded-[22px] bg-gradient-to-br ${app.gradient} flex items-center justify-center shadow-lg ${app.shadow}
                    group-hover:scale-110 group-active:scale-95 transition-transform duration-150`}
                >
                  <Icon className="w-8 h-8 text-white drop-shadow" />
                </div>
                {/* Badge */}
                {badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md z-10">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </div>
              {/* Label */}
              <span className="text-[11px] text-white/70 text-center leading-tight max-w-[72px] group-hover:text-white transition-colors">
                {app.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* No results */}
      {filtered.length === 0 && (
        <p className="text-white/40 text-sm mt-20">No apps match "{search}"</p>
      )}
    </div>
  );
}