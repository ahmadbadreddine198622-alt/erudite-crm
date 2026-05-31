import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Calendar, Flag, Clock, User, ChevronRight, Search, CheckCircle2, AlertCircle, MoreHorizontal } from 'lucide-react';
import { isToday, isTomorrow, isPast, isFuture, format, isWithinInterval, startOfToday, endOfToday } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import ReminderDetailPanel from '@/components/reminders/ReminderDetailPanel';
import AddReminderInline from '@/components/reminders/AddReminderInline';

// Smart tile component
function SmartTile({ icon: Icon, label, count, gradient, onClick, active }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="relative h-32 rounded-2xl p-4 text-left overflow-hidden group"
      style={{
        background: gradient,
        border: active ? '2px solid hsl(38 92% 50%)' : '1px solid rgba(255,255,255,0.1)',
        boxShadow: active 
          ? '0 0 0 1px hsl(38 92% 50% / 0.3), 0 8px 24px rgba(0,0,0,0.4)' 
          : '0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
      }}
    >
      <div className="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.95)' }}>
        {count}
      </div>
      {Icon && <Icon className="absolute top-3 left-3 w-5 h-5" style={{ color: 'rgba(255,255,255,0.9)' }} />}
      <div className="absolute bottom-3 left-3">
        <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>{label}</p>
      </div>
    </motion.button>
  );
}

// Suggested list banner
function SuggestedListBanner({ icon: Icon, title, subtitle, count, onTap, onAdd }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onTap}
      className="w-full rounded-2xl p-4 text-left"
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          {Icon && <Icon className="w-5 h-5 text-accent shrink-0" />}
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: 'hsl(38 92% 50%)',
            color: 'hsl(222 47% 11%)',
          }}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </motion.button>
  );
}

// List row component
function ListRow({ name, count, avatar, onClick, subtitle }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors"
    >
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-accent shrink-0"
        style={{ background: 'hsl(38 92% 50% / 0.2)' }}>
        {avatar || name[0]?.toUpperCase() || '?'}
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-sm font-semibold text-foreground">{name}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-semibold text-accent">{count}</span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </button>
  );
}

// Reminder row component
function ReminderRow({ reminder, onClick, onToggleComplete }) {
  const isOverdue = reminder.due_at && isPast(new Date(reminder.due_at)) && !isToday(new Date(reminder.due_at));
  const dueLabel = reminder.due_at
    ? isToday(new Date(reminder.due_at)) ? 'Today'
    : isTomorrow(new Date(reminder.due_at)) ? 'Tomorrow'
    : isPast(new Date(reminder.due_at)) ? 'Overdue'
    : format(new Date(reminder.due_at), 'MMM d')
    : 'No date';

  const isDone = reminder.status === 'done';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full text-left p-4 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors"
    >
      <div className="flex items-start gap-3">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleComplete(reminder.id, !isDone); }}
          className={`w-5 h-5 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center transition-all ${
            isDone 
              ? 'bg-accent border-accent' 
              : isOverdue 
                ? 'border-red-500' 
                : 'border-white/30 hover:border-white/50'
          }`}
        >
          {isDone && <CheckCircle2 className="w-4 h-4 text-accent-foreground" />}
        </button>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
          <div className="flex items-center gap-2">
            <p className={`text-sm font-semibold truncate ${
              isDone ? 'line-through text-muted-foreground' : 'text-foreground'
            }`}>
              {reminder.title}
            </p>
            {reminder.flagged && <Flag className="w-3.5 h-3.5 text-accent fill-accent shrink-0" />}
            {reminder.priority && reminder.priority !== 'none' && (
              <div className="w-2 h-2 rounded-full shrink-0"
                style={{
                  background: reminder.priority === 'urgent' ? '#ef4444' : 
                             reminder.priority === 'high' ? '#f97316' : '#94a3b8'
                }}
              />
            )}
          </div>
          {reminder.lead_id && reminder.lead_name && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{reminder.lead_name}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-medium ${
              isOverdue ? 'text-red-500' : 'text-muted-foreground'
            }`}>
              {dueLabel}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Reminders() {
  const qc = useQueryClient();
  const [activeView, setActiveView] = useState('today');
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => base44.entities.Reminder.list('-due_at', 500),
    staleTime: 30000,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 500),
    staleTime: 30000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 60000,
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: (data) => base44.entities.Reminder.update(data.id, { status: data.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] }),
  });

  // Enrich reminders with lead names and normalize date field
  const enrichedReminders = reminders.map(r => ({
    ...r,
    due_at: r.due_at || r.due_date, // Support both due_at (standard) and due_date (iOS)
    lead_name: r.lead_id ? leads.find(l => l.id === r.lead_id)?.full_name : null,
  }));

  // Smart list logic
  const today = new Date();
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const todayItems = enrichedReminders.filter(r => 
    r.status === 'pending' && r.due_at && isWithinInterval(new Date(r.due_at), { start: todayStart, end: todayEnd })
  );
  const scheduledItems = enrichedReminders.filter(r => 
    r.status === 'pending' && r.due_at && isFuture(new Date(r.due_at))
  );
  const allItems = enrichedReminders.filter(r => r.status !== 'done');
  const flaggedItems = enrichedReminders.filter(r => r.flagged && r.status !== 'done');
  const completedItems = enrichedReminders.filter(r => r.status === 'done');
  const urgentItems = enrichedReminders.filter(r => r.priority === 'urgent' && r.status !== 'done');
  const overdueItems = enrichedReminders.filter(r => 
    r.status === 'pending' && r.due_at && isPast(new Date(r.due_at)) && !isToday(new Date(r.due_at))
  );

  // Group by assigned_to for "My Lists"
  const userGroups = useMemo(() => {
    const map = {};
    allItems.forEach(r => {
      const assignee = r.assigned_to || 'Unassigned';
      if (!map[assignee]) {
        map[assignee] = { name: assignee, count: 0, reminders: [] };
      }
      map[assignee].count++;
      map[assignee].reminders.push(r);
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [allItems]);

  // Get current user for assigned_to grouping
  const currentUser = users[0]; // Assuming first user is current

  // Filter active items based on view
  const activeItems = useMemo(() => {
    let items;
    if (activeView === 'today') items = todayItems;
    else if (activeView === 'scheduled') items = scheduledItems;
    else if (activeView === 'all') items = allItems;
    else if (activeView === 'flagged') items = flaggedItems;
    else if (activeView === 'completed') items = completedItems;
    else if (activeView === 'urgent') items = urgentItems;
    else if (activeView === 'overdue') items = overdueItems;
    else if (userGroups.find(u => u.name === activeView)) {
      items = userGroups.find(u => u.name === activeView).reminders;
    } else {
      items = allItems;
    }

    if (search) {
      items = items.filter(r =>
        r.title?.toLowerCase().includes(search.toLowerCase()) ||
        r.body?.toLowerCase().includes(search.toLowerCase()) ||
        r.lead_name?.toLowerCase().includes(search.toLowerCase())
      );
    }
    return items.sort((a, b) => {
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at) - new Date(b.due_at);
    });
  }, [activeView, search, todayItems, scheduledItems, allItems, completedItems, flaggedItems, urgentItems, overdueItems, userGroups]);

  const viewTitle = activeView === 'today' ? 'Today'
    : activeView === 'scheduled' ? 'Scheduled'
    : activeView === 'all' ? 'All Reminders'
    : activeView === 'flagged' ? 'Flagged'
    : activeView === 'completed' ? 'Completed'
    : activeView === 'urgent' ? 'Urgent'
    : activeView === 'overdue' ? 'Overdue'
    : userGroups.find(u => u.name === activeView)?.name || 'Reminders';

  return (
    <div className="min-h-screen page-root">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title text-4xl">Reminders</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
              <MoreHorizontal className="w-5 h-5 text-foreground" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search reminders..."
            className="w-full pl-9 pr-3 py-2.5 text-sm glass-input rounded-xl"
          />
        </div>

        {/* Smart Tiles Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <SmartTile
            icon={Calendar}
            label="Today"
            count={todayItems.length}
            gradient="linear-gradient(135deg, rgba(245,158,11,0.3) 0%, rgba(180,100,0,0.2) 100%)"
            onClick={() => setActiveView('today')}
            active={activeView === 'today'}
          />
          <SmartTile
            icon={Clock}
            label="Scheduled"
            count={scheduledItems.length}
            gradient="linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(30,60,120,0.2) 100%)"
            onClick={() => setActiveView('scheduled')}
            active={activeView === 'scheduled'}
          />
          <SmartTile
            icon={CheckCircle2}
            label="All"
            count={allItems.length}
            gradient="linear-gradient(135deg, rgba(16,185,129,0.3) 0%, rgba(10,80,60,0.2) 100%)"
            onClick={() => setActiveView('all')}
            active={activeView === 'all'}
          />
          <SmartTile
            icon={Flag}
            label="Flagged"
            count={flaggedItems.length}
            gradient="linear-gradient(135deg, rgba(236,72,153,0.3) 0%, rgba(140,40,80,0.2) 100%)"
            onClick={() => setActiveView('flagged')}
            active={activeView === 'flagged'}
          />
          <SmartTile
            icon={CheckCircle2}
            label="Completed"
            count={completedItems.length}
            gradient="linear-gradient(135deg, rgba(139,92,246,0.3) 0%, rgba(80,50,120,0.2) 100%)"
            onClick={() => setActiveView('completed')}
            active={activeView === 'completed'}
          />
          <SmartTile
            icon={AlertCircle}
            label="Urgent"
            count={urgentItems.length}
            gradient="linear-gradient(135deg, rgba(239,68,68,0.3) 0%, rgba(140,20,20,0.2) 100%)"
            onClick={() => setActiveView('urgent')}
            active={activeView === 'urgent'}
          />
          <SmartTile
            icon={User}
            label="Assigned"
            count={userGroups.reduce((s, u) => s + u.count, 0)}
            gradient="linear-gradient(135deg, rgba(168,85,247,0.3) 0%, rgba(80,40,100,0.2) 100%)"
            onClick={() => setActiveView(userGroups[0]?.name || 'all')}
            active={userGroups.some(u => u.name === activeView)}
          />
        </div>

        {/* Suggested List Banner */}
        {overdueItems.length > 0 && activeView !== 'overdue' && (
          <SuggestedListBanner
            icon={AlertCircle}
            title="Overdue"
            subtitle={`${overdueItems.length} reminder${overdueItems.length !== 1 ? 's' : ''} need attention`}
            count={overdueItems.length}
            onTap={() => setActiveView('overdue')}
            onAdd={() => { setShowAdd(true); }}
          />
        )}

        {/* My Lists Section */}
        {userGroups.length > 0 && (
          <div className="glass-card rounded-2xl p-4">
            <h2 className="text-lg font-semibold text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>My Lists</h2>
            <div className="space-y-1">
              {userGroups.map(group => (
                <ListRow
                  key={group.name}
                  name={group.name === 'Unassigned' ? 'Unassigned' : group.name}
                  count={group.count}
                  avatar={group.name !== 'Unassigned' ? group.name[0]?.toUpperCase() : '?'}
                  subtitle={group.name !== 'Unassigned' ? 'Shared by Erudite 2025' : null}
                  onClick={() => setActiveView(group.name)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Reminder List */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">{viewTitle}</h2>
            <span className="text-xs text-muted-foreground">{activeItems.length} reminder{activeItems.length !== 1 ? 's' : ''}</span>
          </div>
          
          <AnimatePresence>
            {showAdd && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-b border-white/10"
              >
                <AddReminderInline onClose={() => setShowAdd(false)} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="divide-y divide-white/5">
            {activeItems.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto">
                  <Calendar className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">No reminders</p>
                <button
                  onClick={() => setShowAdd(true)}
                  className="text-sm text-accent hover:text-accent/80 font-medium"
                >
                  + Add a reminder
                </button>
              </div>
            ) : (
              activeItems.map(r => (
                <ReminderRow
                  key={r.id}
                  reminder={r}
                  onClick={() => setSelectedReminder(r)}
                  onToggleComplete={(id, newStatus) => {
                    toggleCompleteMutation.mutate({ id, status: newStatus ? 'done' : 'pending' });
                  }}
                />
              ))
            )}
          </div>
        </div>

      </div>

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedReminder && (
          <motion.div
            initial={{ x: 80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 80, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed right-0 top-0 h-full w-full max-w-md z-50"
          >
            <ReminderDetailPanel
              reminder={selectedReminder}
              onClose={() => setSelectedReminder(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Add Button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowAdd(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-40"
        style={{
          background: 'hsl(38 92% 50%)',
          color: 'hsl(222 47% 11%)',
          boxShadow: '0 8px 24px hsl(38 92% 50% / 0.4)',
        }}
      >
        <Plus className="w-6 h-6" />
      </motion.button>
    </div>
  );
}