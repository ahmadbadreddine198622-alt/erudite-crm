import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Users, Building2, KanbanSquare, DollarSign,
  Bell, MessageCircle, Inbox, BarChart3, UserCheck, FileSignature,
  Calculator, Trophy, UserCircle, Zap, Instagram, Sparkles, Link2,
  GitMerge, Mail, FolderOpen, Brain, MapPin, Search, Handshake, Phone, Key,
  Calendar, TrendingUp, Activity
} from 'lucide-react';
import ExtremeLiquidIcon from '@/components/ui/ExtremeLiquidIcon';
import AIInsightsDashboard from '@/components/shared/AIInsightsDashboard';
import ActivityFeed from '@/components/shared/ActivityFeed';
import PerformanceStreaks from '@/components/shared/PerformanceStreaks';

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ALL_APPS = [
  { label: 'My Dashboard',      icon: UserCircle,     path: '/my-dashboard',       gradient: 'from-blue-600 to-blue-800',          glowColor: 'rgba(59,130,246,0.45)' },
  { label: 'Pipeline',          icon: KanbanSquare,   path: '/pipeline',            gradient: 'from-violet-600 to-purple-800',       glowColor: 'rgba(139,92,246,0.45)' },
  { label: 'Leads',             icon: Users,          path: '/leads',               gradient: 'from-emerald-500 to-emerald-800',     glowColor: 'rgba(16,185,129,0.45)', badgeKey: 'leads' },
  { label: 'Contacts',          icon: UserCheck,      path: '/contacts',            gradient: 'from-sky-500 to-cyan-800',            glowColor: 'rgba(14,165,233,0.45)' },
  { label: 'Landlords',         icon: Building2,      path: '/landlords',           gradient: 'from-amber-500 to-orange-700',        glowColor: 'rgba(245,158,11,0.45)' },
  { label: 'Projects',          icon: FolderOpen,     path: '/projects',            gradient: 'from-teal-500 to-teal-800',           glowColor: 'rgba(20,184,166,0.45)' },
  { label: 'WhatsApp',          icon: MessageCircle,  path: '/whatsapp',            gradient: 'from-green-500 to-green-800',         glowColor: 'rgba(34,197,94,0.45)', badgeKey: 'whatsapp' },
  { label: 'Inbox',             icon: Inbox,          path: '/inbox',               gradient: 'from-blue-600 to-indigo-800',         glowColor: 'rgba(99,102,241,0.45)' },
  { label: 'Reminders',         icon: Bell,           path: '/reminders',           gradient: 'from-rose-500 to-red-700',            glowColor: 'rgba(244,63,94,0.45)', badgeKey: 'reminders' },
  { label: 'Analytics',         icon: BarChart3,      path: '/analytics',           gradient: 'from-purple-500 to-fuchsia-800',      glowColor: 'rgba(168,85,247,0.45)' },
  { label: 'Sales Analytics',   icon: BarChart3,      path: '/sales-analytics',     gradient: 'from-pink-500 to-rose-700',           glowColor: 'rgba(236,72,153,0.45)' },
  { label: 'Team',              icon: Users,          path: '/team',                gradient: 'from-slate-500 to-slate-700',         glowColor: 'rgba(148,163,184,0.35)' },
  { label: 'Team AI OS',        icon: Brain,          path: '/team-os',             gradient: 'from-indigo-500 to-violet-800',       glowColor: 'rgba(99,102,241,0.45)' },
  { label: 'Team Performance',  icon: Trophy,         path: '/team-dashboard',      gradient: 'from-yellow-500 to-amber-700',        glowColor: 'rgba(234,179,8,0.45)' },
  { label: 'Offers',            icon: FileSignature,  path: '/offers',              gradient: 'from-cyan-500 to-blue-800',           glowColor: 'rgba(6,182,212,0.45)' },
  { label: 'Finance',           icon: Calculator,     path: '/finance',             gradient: 'from-green-500 to-teal-800',          glowColor: 'rgba(20,184,166,0.45)' },
  { label: 'Key Handover',      icon: Key,            path: '/key-handover',        gradient: 'from-orange-500 to-red-700',          glowColor: 'rgba(249,115,22,0.45)' },
  { label: 'Commissions',       icon: DollarSign,     path: '/commissions',         gradient: 'from-amber-400 to-yellow-700',        glowColor: 'rgba(245,158,11,0.50)' },
  { label: 'Map View',          icon: MapPin,         path: '/map',                 gradient: 'from-teal-500 to-cyan-700',           glowColor: 'rgba(20,184,166,0.45)' },
  { label: 'WhatsApp Hub',      icon: Zap,            path: '/whatsapp-hub',        gradient: 'from-emerald-500 to-green-700',       glowColor: 'rgba(16,185,129,0.45)' },
  { label: 'Meta & Google',     icon: Zap,            path: '/meta-ads-leads',      gradient: 'from-blue-500 to-sky-700',            glowColor: 'rgba(59,130,246,0.45)' },
  { label: 'Instagram Leads',   icon: Instagram,      path: '/instagram',           gradient: 'from-fuchsia-500 to-pink-700',        glowColor: 'rgba(217,70,239,0.45)' },
  { label: 'Property Finder',   icon: Link2,          path: '/property-finder',     gradient: 'from-red-500 to-rose-700',            glowColor: 'rgba(239,68,68,0.45)' },
  { label: 'Duplicate Detector',icon: GitMerge,       path: '/duplicates',          gradient: 'from-orange-500 to-amber-700',        glowColor: 'rgba(249,115,22,0.45)' },
  { label: 'Email Automations', icon: Mail,           path: '/email-automations',   gradient: 'from-indigo-500 to-blue-800',         glowColor: 'rgba(99,102,241,0.45)' },
  { label: 'Claude AI',         icon: Sparkles,       path: '/claude-ai',           gradient: 'from-violet-500 to-purple-800',       glowColor: 'rgba(139,92,246,0.50)' },
  { label: 'WhatsApp Setup',    icon: MessageCircle,  path: '/whatsapp-setup',      gradient: 'from-slate-500 to-slate-700',         glowColor: 'rgba(148,163,184,0.35)' },
  { label: 'Form A Referral',   icon: Handshake,      path: '/form-a-referral',     gradient: 'from-amber-500 to-orange-700',        glowColor: 'rgba(245,158,11,0.45)' },
  { label: 'Find Property',      icon: Search,         path: '/find-property',       gradient: 'from-cyan-500 to-teal-700',           glowColor: 'rgba(6,182,212,0.45)',  href: 'https://aiboostmarketing.com/lookup/?token=971581806000-4e32601555d5aa4902807dfe6c1368&sheetId=1Qu3xT9jrEW_xSVoRDk9cmeBGQVeMdyVId0LcN5v6NyE' },
  { label: 'DLD Lookup',         icon: Phone,          path: '/dld-lookup',          gradient: 'from-purple-500 to-fuchsia-800',      glowColor: 'rgba(168,85,247,0.45)', href: 'https://aiboostmarketing.com/smart-bot/?user=971581806000-4e32601555d5aa4902807dfe6c1368&sheetId=1Qu3xT9jrEW_xSVoRDk9cmeBGQVeMdyVId0LcN5v6NyE' },
  { label: 'Transfer Numbers',    icon: Calculator,     path: '/transfer-breakdown',  gradient: 'from-green-500 to-emerald-700',       glowColor: 'rgba(34,197,94,0.45)',  href: 'https://claude.ai/project/019e7460-ea5f-74e0-8efb-c3a58527c3bd' },
  { label: 'Transfer Calculator', icon: Calculator,     path: '/transfer-calculator', gradient: 'from-amber-500 to-yellow-700',         glowColor: 'rgba(245,158,11,0.45)' },
  { label: 'Form I Generator',     icon: FileSignature,  path: '/form-i-generator',    gradient: 'from-indigo-500 to-slate-700',         glowColor: 'rgba(99,102,241,0.45)' },
];

const STORAGE_KEY = 'dashboard_app_order';
const LONG_PRESS_MS = 1000;

export default function Dashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [logoUrl] = useState(() => localStorage.getItem('erudite_logo') || '');
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const pressTimer = useRef(null);

  // Pointer / orientation tracking for tilt specular
  useEffect(() => {
    if (prefersReducedMotion) return;
    let rafId;
    const handlePointer = (e) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const nx = (e.clientX / window.innerWidth - 0.5) * 2;
        const ny = (e.clientY / window.innerHeight - 0.5) * 2;
        setTilt({ x: nx, y: ny });
      });
    };
    const handleOrientation = (e) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setTilt({
          x: Math.max(-1, Math.min(1, (e.gamma || 0) / 30)),
          y: Math.max(-1, Math.min(1, (e.beta  || 0) / 40 - 0.3)),
        });
      });
    };
    window.addEventListener('pointermove', handlePointer, { passive: true });
    window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointer);
      window.removeEventListener('deviceorientation', handleOrientation);
      cancelAnimationFrame(rafId);
    };
  }, []);

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
  
  // Management intelligence
  const todayDeals = leads.filter(l => l.stage === 'negotiation_deal_lock' || l.stage === 'closing_dld').length;
  const hotLeads = leads.filter(l => (l.ai_lead_score || 0) >= 75).length;

  const filtered = search.trim()
    ? apps.filter(a => a.label.toLowerCase().includes(search.toLowerCase()))
    : apps;

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center px-6 py-8"
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

      {/* Management Intelligence Strip */}
      <div className="grid grid-cols-4 gap-3 mb-8 w-full max-w-3xl">
        <div
          className="rounded-xl p-3 text-center"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Users className="w-3.5 h-3.5" style={{ color: 'hsl(38 92% 50%)' }} />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Active Leads</p>
          <p className="text-xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>{badges.leads}</p>
        </div>
        <div
          className="rounded-xl p-3 text-center"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Bell className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Reminders</p>
          <p className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{badges.reminders}</p>
        </div>
        <div
          className="rounded-xl p-3 text-center"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Unread</p>
          <p className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{badges.whatsapp}</p>
        </div>
        <div
          className="rounded-xl p-3 text-center"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Hot Leads</p>
          <p className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{hotLeads}</p>
        </div>
      </div>

      {/* Date & greeting */}
      <div className="text-center mb-8">
        <p className="text-4xl font-light tracking-tight" style={{ color: 'rgba(255,255,255,0.92)' }}>
          {format(new Date(), 'h:mm')}
          <span className="text-xl ml-1" style={{ color: 'hsl(38 92% 50%)' }}>{format(new Date(), 'a')}</span>
        </p>
        <p className="text-sm mt-1 font-medium" style={{ color: 'hsl(38 92% 50%)' }}>{format(new Date(), 'EEEE, MMMM d')}</p>
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'hsl(38 92% 50%)' }} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search apps"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border focus:outline-none transition-all"
          style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.95)',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'hsl(38 92% 50%)';
            e.target.style.background = 'rgba(255,255,255,0.1)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'rgba(255,255,255,0.12)';
            e.target.style.background = 'rgba(255,255,255,0.07)';
          }}
        />
      </div>

      {/* App Grid — pb-44 (176px) ensures last row clears the floating dock + raised home button + iOS safe-area on notch devices */}
      <div className="ios-grid-enter w-full flex flex-col items-center pb-44">
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
                        className={`flex flex-col items-center gap-2 select-none focus:outline-none ${editMode && !snapshot.isDragging ? 'animate-wiggle' : ''}`}
                      >
                        <ExtremeLiquidIcon
                         icon={Icon}
                         gradient={app.gradient}
                         glowColor={app.glowColor}
                         tiltX={tilt.x}
                         tiltY={tilt.y}
                         index={idx}
                         isDragging={snapshot.isDragging}
                         active={editMode && !snapshot.isDragging}
                         badge={!editMode && badgeCount > 0 ? badgeCount : 0}
                        />
                        <span className={`text-[11px] text-center leading-tight max-w-[72px] font-medium ${
                          editMode ? 'text-white/50' : 'text-white/75'
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

      </div>

      {/* AI Insights + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-5xl mt-8">
        <div className="space-y-6">
          <AIInsightsDashboard />
          <PerformanceStreaks />
        </div>
        <div>
          <ActivityFeed />
        </div>
      </div>

      {/* No results */}
      {filtered.length === 0 && (
        <p className="text-white/40 text-sm mt-20">No apps match "{search}"</p>
      )}
    </div>
  );
}