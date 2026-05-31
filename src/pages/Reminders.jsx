import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Calendar, CheckCircle, Clock, User, ChevronRight, Search } from 'lucide-react';
import { isToday, isTomorrow, isPast, isFuture, format } from 'date-fns';
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
      className="relative h-32 rounded-2xl p-4 text-left overflow-hidden"
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

// List row component
function ListRow({ name, count, avatar, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors"
    >
      <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-accent shrink-0">
        {avatar || name[0]?.toUpperCase() || '?'}
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-semibold text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{count} reminder{count !== 1 ? 's' : ''}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );
}

// Reminder row component
function ReminderRow({ reminder, onClick }) {
  const isOverdue = reminder.due_date && isPast(new Date(reminder.due_date)) && !isToday(new Date(reminder.due_date));
  const dueLabel = reminder.due_date
    ? isToday(new Date(reminder.due_date)) ? 'Today'
    : isTomorrow(new Date(reminder.due_date)) ? 'Tomorrow'
    : format(new Date(reminder.due_date), 'MMM d')
    : 'No date';

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
    >
      <div className="flex items-start gap-3">
        <div className={`w-5 h-5 rounded-full border-2 mt-0.5 shrink-0 ${
          reminder.status === 'completed' 
            ? 'bg-accent border-accent' 
            : isOverdue 
              ? 'border-red-500' 
              : 'border-white/30'
        }`}>
          {reminder.status === 'completed' && <CheckCircle className="w-4 h-4 text-accent-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${
            reminder.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'
          }`}>
            {reminder.title}
          </p>
          {reminder.lead_name && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{reminder.lead_name}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-medium ${
              isOverdue ? 'text-red-500' : 'text-muted-foreground'
            }`}>
              {dueLabel}
            </span>
            {reminder.priority && reminder.priority !== 'none' && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{
                background: reminder.priority === 'urgent' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.1)',
                color: reminder.priority === 'urgent' ? '#f87171' : 'rgba(255,255,255,0.7)'
              }}>
                {reminder.priority}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export default function Reminders() {
  const qc = useQueryClient();
  const [activeView, setActiveView] = useState('today'); // today, scheduled, all, completed, or user email
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [showUserLists, setShowUserLists] = useState(false);

  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => base44.entities.Reminder.list('-due_date', 500),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const completeMutation = useMutation({
    mutationFn: (id) => base44.entities.Reminder.update(id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] }),
  });

  // Smart list calculations
  const pending = reminders.filter(r => r.status === 'pending');
  const todayItems = pending.filter(r => r.due_date && isToday(new Date(r.due_date)));
  const scheduledItems = pending.filter(r => r.due_date && isFuture(new Date(r.due_date)));
  const completedItems = reminders.filter(r => r.status === 'completed');

  // Group by assigned_to
  const userGroups = useMemo(() => {
    const map = {};
    pending.forEach(r => {
      const user = r.assigned_to || 'Unassigned';
      if (!map[user]) map[user] = { name: user, count: 0, reminders: [] };
      map[user].count++;
      map[user].reminders.push(r);
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [pending]);

  const counts = {
    today: todayItems.length,
    scheduled: scheduledItems.length,
    all: pending.length,
    completed: completedItems.length,
  };

  // Filter reminders for active view
  const activeItems = useMemo(() => {
    let items;
    if (activeView === 'today') items = todayItems;
    else if (activeView === 'scheduled') items = scheduledItems;
    else if (activeView === 'all') items = pending;
    else if (activeView === 'completed') items = completedItems;
    else if (userGroups.find(u => u.name === activeView)) {
      items = userGroups.find(u => u.name === activeView).reminders;
    } else {
      items = pending;
    }

    if (search) {
      items = items.filter(r =>
        r.title?.toLowerCase().includes(search.toLowerCase()) ||
        r.notes?.toLowerCase().includes(search.toLowerCase()) ||
        r.lead_name?.toLowerCase().includes(search.toLowerCase())
      );
    }
    return items.sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    });
  }, [activeView, search, todayItems, scheduledItems, pending, completedItems, userGroups]);

  const viewTitle = activeView === 'today' ? 'Today'
    : activeView === 'scheduled' ? 'Scheduled'
    : activeView === 'all' ? 'All Reminders'
    : activeView === 'completed' ? 'Completed'
    : userGroups.find(u => u.name === activeView)?.name || 'Reminders';

  const currentUser = users.find(u => u.email === activeView);

  return (
    <div className="min-h-screen page-root">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title text-3xl">Reminders</h1>
            <p className="page-subtitle mt-1">Stay on top of your tasks</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: 'hsl(38 92% 50%)',
              color: 'hsl(222 47% 11%)',
              boxShadow: '0 4px 12px hsl(38 92% 50% / 0.3)',
            }}
          >
            <Plus className="w-4 h-4" /> New
          </button>
        </div>

        {/* Smart Tiles Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <SmartTile
            icon={Calendar}
            label="Today"
            count={counts.today}
            gradient="linear-gradient(135deg, rgba(245,158,11,0.3) 0%, rgba(180,100,0,0.2) 100%)"
            onClick={() => setActiveView('today')}
            active={activeView === 'today'}
          />
          <SmartTile
            icon={Clock}
            label="Scheduled"
            count={counts.scheduled}
            gradient="linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(30,60,120,0.2) 100%)"
            onClick={() => setActiveView('scheduled')}
            active={activeView === 'scheduled'}
          />
          <SmartTile
            icon={CheckCircle}
            label="All"
            count={counts.all}
            gradient="linear-gradient(135deg, rgba(16,185,129,0.3) 0%, rgba(10,80,60,0.2) 100%)"
            onClick={() => setActiveView('all')}
            active={activeView === 'all'}
          />
          <SmartTile
            icon={CheckCircle}
            label="Completed"
            count={counts.completed}
            gradient="linear-gradient(135deg, rgba(139,92,246,0.3) 0%, rgba(80,50,120,0.2) 100%)"
            onClick={() => setActiveView('completed')}
            active={activeView === 'completed'}
          />
          <SmartTile
            icon={User}
            label="Assigned"
            count={userGroups.reduce((s, u) => s + u.count, 0)}
            gradient="linear-gradient(135deg, rgba(236,72,153,0.3) 0%, rgba(140,40,80,0.2) 100%)"
            onClick={() => setShowUserLists(!showUserLists)}
            active={showUserLists}
          />
        </div>

        {/* My Lists Section */}
        {showUserLists && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl p-4"
          >
            <h2 className="text-lg font-semibold text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>My Lists</h2>
            <div className="space-y-1">
              {userGroups.map(user => (
                <ListRow
                  key={user.name}
                  name={user.name === 'Unassigned' ? 'Unassigned' : user.name.split('@')[0]}
                  count={user.count}
                  avatar={user.name !== 'Unassigned' ? user.name[0]?.toUpperCase() : '?'}
                  onClick={() => { setActiveView(user.name); setShowUserLists(false); }}
                />
              ))}
            </div>
          </motion.div>
        )}

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
              onComplete={(id) => {
                completeMutation.mutate(id);
                setSelectedReminder(null);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}