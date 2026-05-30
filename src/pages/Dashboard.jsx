import React, { useState, useRef, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  LayoutDashboard, Users, Building2, KanbanSquare, DollarSign,
  Bell, MessageCircle, Inbox, BarChart3, UserCheck, FileSignature,
  Calculator, Trophy, UserCircle, Zap, Instagram, Sparkles, Link2,
  GitMerge, Mail, FolderOpen, Brain, MapPin, Search, Handshake, Phone, Key
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
  { label: 'Key Handover',      icon: Key,            path: '/key-handover',        gradient: 'from-orange-400 to-red-500',         shadow: 'shadow-orange-500/30' },
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
  { label: 'Form A Referral',   icon: Handshake,      path: '/form-a-referral',     gradient: 'from-amber-400 to-orange-500',        shadow: 'shadow-amber-500/30',  href: 'https://claude.ai/project/019e74b5-d3a4-75d9-865e-2dccae455384' },
  { label: 'Find Property',      icon: Search,         path: '/find-property',       gradient: 'from-cyan-500 to-teal-600',           shadow: 'shadow-cyan-500/30',   href: 'https://aiboostmarketing.com/lookup/?token=971581806000-4e32601555d5aa4902807dfe6c1368&sheetId=1Qu3xT9jrEW_xSVoRDk9cmeBGQVeMdyVId0LcN5v6NyE' },
  { label: 'DLD Lookup',         icon: Phone,          path: '/dld-lookup',          gradient: 'from-purple-500 to-pink-600',         shadow: 'shadow-purple-500/30',  href: 'https://aiboostmarketing.com/smart-bot/?user=971581806000-4e32601555d5aa4902807dfe6c1368&sheetId=1Qu3xT9jrEW_xSVoRDk9cmeBGQVeMdyVId0LcN5v6NyE' },
  { label: 'Transfer Numbers',    icon: Calculator,     path: '/transfer-breakdown',  gradient: 'from-green-500 to-teal-600',        shadow: 'shadow-green-500/30',   href: 'https://claude.ai/project/019e7460-ea5f-74e0-8efb-c3a58527c3bd' },
  { label: 'Transfer Calculator', icon: Calculator,     path: '/transfer-calculator', gradient: 'from-amber-500 to-yellow-600',       shadow: 'shadow-amber-500/30' },
  { label: 'Form I Generator',     icon: FileSignature,  path: '/form-i-generator',    gradient: 'from-indigo-500 to-blue-700',         shadow: 'shadow-indigo-500/30' },
];

const STORAGE_KEY = 'dashboard_app_order';
const LONG_PRESS_MS = 5000;

export default function Dashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [logoUrl] = useState(() => localStorage.getItem('erudite_logo') || '');
  const pressTimer = useRef(null);

  const startPress = useCallback(() => {
    pressTimer.current = setTimeout(() => setEditMode(true), LONG_PRESS_MS);
  }, []);

  const cancelPress = useCallback(() => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }, []);
  const [apps, setApps] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedOrder = JSON.parse(saved);
        // If ALL_APPS has changed size, reset to default order
        if (savedOrder.length !== ALL_APPS.length) {
          localStorage.removeItem(STORAGE_KEY);
          return ALL_APPS;
        }
        return savedOrder.map(s => ALL_APPS.find(a => a.label === s.label) || s).filter(Boolean);
      }
    } catch {}
    return ALL_APPS;
  });

  const saveOrder = (newApps) => {
    setApps(newApps);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newApps.map(a => ({ label: a.label }))));
  };

  const onDragEnd = ({ source, destination }) => {
    if (!destination) return;
    const next = [...apps];
    const [moved] = next.splice(source.index, 1);
    next.splice(destination.index, 0, moved);
    saveOrder(next);
  };

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
    ? apps.filter(a => a.label.toLowerCase().includes(search.toLowerCase()))
    : apps;

  return (
    <div
      className="relative min-h-screen flex flex-col items-center py-10 px-6"
      style={{
        background: 'radial-gradient(ellipse at 20% 20%, #1a2a4a 0%, #0F1419 45%, #121821 100%)',
      }}
    >
      {/* Logo */}
      {logoUrl && (
        <div className="mb-6">
          <img src={logoUrl} alt="Erudite" className="h-12 object-contain" />
        </div>
      )}

      {/* Date & greeting */}
      <div className="text-center mb-8">
        <p className="text-4xl font-light text-white/90 tracking-tight">
          {format(new Date(), 'h:mm')}
          <span className="text-xl ml-1 text-white/50">{format(new Date(), 'a')}</span>
        </p>
        <p className="text-sm text-white/40 mt-1">{format(new Date(), 'EEEE, MMMM d')}</p>
      </div>

      {/* Done button — only visible in edit mode */}
      {editMode && (
        <button
          onClick={() => setEditMode(false)}
          className="absolute top-5 right-6 text-sm font-semibold text-accent z-20"
        >
          Done
        </button>
      )}

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
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="dashboard" direction="horizontal" isDropDisabled={!editMode}>
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="w-full max-w-5xl grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-x-4 gap-y-7"
            >
              {filtered.map((app, idx) => {
                const Icon = app.icon;
                const badgeCount = app.badgeKey ? badges[app.badgeKey] : 0;
                return (
                  <Draggable key={app.path} draggableId={app.path} index={idx} isDragDisabled={!editMode}>
                    {(p, snapshot) => (
                      <div
                        ref={p.innerRef}
                        {...p.draggableProps}
                        {...p.dragHandleProps}
                        onMouseDown={!editMode ? startPress : undefined}
                        onMouseUp={!editMode ? cancelPress : undefined}
                        onMouseLeave={!editMode ? cancelPress : undefined}
                        onTouchStart={!editMode ? startPress : undefined}
                        onTouchEnd={!editMode ? cancelPress : undefined}
                        onClick={() => {
                          if (editMode) return;
                          app.href ? window.open(app.href, '_blank') : navigate(app.path);
                        }}
                        className={`flex flex-col items-center gap-2 select-none focus:outline-none ${
                          editMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                        }`}
                      >
                        <div className="relative">
                          <div
                            className={`w-16 h-16 rounded-[22px] bg-gradient-to-br ${app.gradient} flex items-center justify-center shadow-lg ${app.shadow} ${
                              editMode && !snapshot.isDragging ? 'animate-wiggle' : ''
                            } ${
                              snapshot.isDragging ? 'scale-110 opacity-80' : ''
                            } ${
                              !editMode ? 'transition-transform duration-150 active:scale-95' : ''
                            }`}
                          >
                            <Icon className="w-8 h-8 text-white drop-shadow" />
                          </div>
                          {badgeCount > 0 && !editMode && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md z-10">
                              {badgeCount > 99 ? '99+' : badgeCount}
                            </span>
                          )}
                        </div>
                        <span className={`text-[11px] text-center leading-tight max-w-[72px] ${
                          editMode ? 'text-white/50' : 'text-white/70'
                        }`}>
                          {app.label}
                        </span>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* No results */}
      {filtered.length === 0 && (
        <p className="text-white/40 text-sm mt-20">No apps match "{search}"</p>
      )}
    </div>
  );
}