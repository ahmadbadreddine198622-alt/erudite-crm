import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Search, Users, Bell, MessageCircle, TrendingUp, Minus, Plus, Brain } from 'lucide-react';
import { ALL_APPS, MIN_ITEMS, MAX_ITEMS } from '@/lib/navApps';
import AppPickerSheet from '@/components/ui/AppPickerSheet';
import ExtremeLiquidIcon from '@/components/ui/ExtremeLiquidIcon';
import AIInsightsDashboard from '@/components/shared/AIInsightsDashboard';
import ActivityFeed from '@/components/shared/ActivityFeed';
import PerformanceStreaks from '@/components/shared/PerformanceStreaks';
import ClaudePresenceIcon from '@/components/ui/ClaudePresenceIcon';

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const storageKey = (email) => `dashboard_apps_${email || 'default'}`;
const LONG_PRESS_MS = 4000;
const HOLD_CUE_MS = 2000;

export default function Dashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [logoUrl] = useState(() => localStorage.getItem('erudite_logo') || '');
  const [userEmail, setUserEmail] = useState('');
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [holdingPath, setHoldingPath] = useState(null);
  const [holdCueActive, setHoldCueActive] = useState(false);
  const pressTimer = useRef(null);
  const cueTimer = useRef(null);

  // Load user email
  useEffect(() => {
    base44.auth.me().then(u => { if (u?.email) setUserEmail(u.email); }).catch(() => {});
  }, []);

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

  const startPress = useCallback((path) => {
    setHoldingPath(path);
    cueTimer.current = setTimeout(() => setHoldCueActive(true), HOLD_CUE_MS);
    pressTimer.current = setTimeout(() => {
      setEditMode(true);
      setHoldingPath(null);
      setHoldCueActive(false);
    }, LONG_PRESS_MS);
  }, []);

  const cancelPress = useCallback(() => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    if (cueTimer.current) clearTimeout(cueTimer.current);
    setHoldingPath(null);
    setHoldCueActive(false);
  }, []);

  const [apps, setApps] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey(''));
      if (saved) {
        const labels = JSON.parse(saved);
        const resolved = labels.map(l => ALL_APPS.find(a => a.label === l)).filter(Boolean);
        if (resolved.length >= MIN_ITEMS) return resolved;
      }
    } catch {}
    return ALL_APPS;
  });

  // Reload when we get user email
  useEffect(() => {
    if (!userEmail) return;
    try {
      const saved = localStorage.getItem(storageKey(userEmail));
      if (saved) {
        const labels = JSON.parse(saved);
        const resolved = labels.map(l => ALL_APPS.find(a => a.label === l)).filter(Boolean);
        if (resolved.length >= MIN_ITEMS) setApps(resolved);
      }
    } catch {}
  }, [userEmail]);

  const saveOrder = (newApps) => {
    setApps(newApps);
    localStorage.setItem(storageKey(userEmail), JSON.stringify(newApps.map(a => a.label)));
  };

  const removeApp = (path) => {
    if (apps.length <= MIN_ITEMS) return;
    saveOrder(apps.filter(a => a.path !== path));
  };

  const addApp = (app) => {
    if (apps.length >= MAX_ITEMS) return;
    saveOrder([...apps, app]);
    setShowPicker(false);
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

      {/* Claude Presence + Management Intelligence */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <ClaudePresenceIcon size={48} active={false} thinking={false} />
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'hsl(38 92% 50%)' }}>
            Claude-Powered CRM
          </p>
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
            AI actively monitoring your pipeline
          </p>
        </div>
      </div>

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
                          onMouseDown={!editMode ? () => startPress(app.path) : undefined}
                          onMouseUp={!editMode ? cancelPress : undefined}
                          onMouseLeave={!editMode ? cancelPress : undefined}
                          onTouchStart={!editMode ? () => startPress(app.path) : undefined}
                          onTouchEnd={!editMode ? cancelPress : undefined}
                          onClick={() => {
                            if (editMode) return;
                            app.href ? window.open(app.href, '_blank') : navigate(app.path);
                          }}
                          className={`flex flex-col items-center gap-1.5 select-none focus:outline-none ${editMode && !snapshot.isDragging ? 'animate-wiggle' : ''}`}
                          style={holdingPath === app.path && holdCueActive ? { transform: 'scale(1.08)', transition: 'transform 0.3s ease', filter: 'brightness(1.3)' } : { position: 'relative' }}
                        >
                          {/* Remove badge */}
                          {editMode && (
                            <button
                              onPointerDown={e => { e.stopPropagation(); removeApp(app.path); }}
                              className="absolute -top-2 -left-2 z-20 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center border border-red-300/30 shadow-md"
                              style={{ fontSize: 12 }}
                            >
                              <Minus className="w-3 h-3 text-white" strokeWidth={3} />
                            </button>
                          )}
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
                          <span className={`text-[11px] text-center leading-tight max-w-[64px] font-medium min-h-[2rem] flex items-start justify-center ${editMode ? 'text-white/50' : 'text-white/75'}`}>
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

        {/* Floating Add Button — top-right corner */}
        {editMode && apps.length < MAX_ITEMS && (
          <button
            onClick={() => setShowPicker(true)}
            className="fixed top-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg"
            style={{
              background: 'linear-gradient(135deg, hsl(38 92% 55%), hsl(38 92% 50%))',
              boxShadow: '0 8px 28px rgba(245,159,10,0.35), inset 0 1px 0 rgba(255,255,255,0.3)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Plus className="w-6 h-6 text-white" strokeWidth={3} />
          </button>
        )}
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

      {/* Picker */}
      {showPicker && (
        <AppPickerSheet
          currentItems={apps}
          onAdd={addApp}
          onClose={() => setShowPicker(false)}
          title="Add to Dashboard"
        />
      )}
    </div>
  );
}