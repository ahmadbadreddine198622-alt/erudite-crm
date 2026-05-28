import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Download, Search, Sparkles } from 'lucide-react';
import { isToday, isPast, isAfter, startOfDay, endOfDay } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';

import ReminderSidebar from '@/components/reminders/ReminderSidebar';
import ReminderItem from '@/components/reminders/ReminderItem';
import ReminderDetailPanel from '@/components/reminders/ReminderDetailPanel';
import ImportTasksPanel from '@/components/reminders/ImportTasksPanel';
import AddReminderInline from '@/components/reminders/AddReminderInline';

const LIST_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#06b6d4'];

export default function Reminders() {
  const qc = useQueryClient();
  const [activeList, setActiveList] = useState('today');
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddListDialog, setShowAddListDialog] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListColor, setNewListColor] = useState('#3b82f6');

  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => base44.entities.Reminder.list('-created_date', 500),
  });

  const completeMutation = useMutation({
    mutationFn: (id) => base44.entities.Reminder.update(id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] }),
  });

  // Build dynamic lists from list_name field
  const customLists = useMemo(() => {
    const map = {};
    reminders.forEach(r => {
      if (r.list_name) {
        if (!map[r.list_name]) map[r.list_name] = { name: r.list_name, color: r.list_color || '#3b82f6', count: 0 };
        if (r.status === 'pending') map[r.list_name].count++;
      }
    });
    return Object.values(map);
  }, [reminders]);

  // Filter reminders for each smart list
  const pending = reminders.filter(r => r.status === 'pending');
  const todayItems = pending.filter(r => r.due_date && isToday(new Date(r.due_date)));
  const scheduledItems = pending.filter(r => r.due_date && !isToday(new Date(r.due_date)));
  const completedItems = reminders.filter(r => r.status === 'completed');

  const counts = {
    today: todayItems.length,
    scheduled: scheduledItems.length,
    all: pending.length,
    completed: completedItems.length,
  };

  // Get items for active list
  const activeItems = useMemo(() => {
    let items;
    if (activeList === 'today') items = todayItems;
    else if (activeList === 'scheduled') items = scheduledItems;
    else if (activeList === 'completed') items = completedItems;
    else if (activeList === 'all') items = pending;
    else if (activeList.startsWith('list:')) {
      const listName = activeList.replace('list:', '');
      items = reminders.filter(r => r.list_name === listName && r.status === 'pending');
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
    return items;
  }, [activeList, reminders, search]);

  // Group by overdue/today/upcoming for "all" and "scheduled"
  const grouped = useMemo(() => {
    if (activeList === 'completed' || activeList.startsWith('list:')) {
      return [{ label: null, items: activeItems }];
    }
    const overdue = activeItems.filter(r => r.due_date && isPast(new Date(r.due_date)) && !isToday(new Date(r.due_date)));
    const today = activeItems.filter(r => r.due_date && isToday(new Date(r.due_date)));
    const upcoming = activeItems.filter(r => r.due_date && isAfter(new Date(r.due_date), endOfDay(new Date())));
    const noDate = activeItems.filter(r => !r.due_date);
    const groups = [];
    if (overdue.length) groups.push({ label: 'Overdue', items: overdue, labelColor: 'text-red-500' });
    if (today.length) groups.push({ label: 'Today', items: today, labelColor: 'text-yellow-600' });
    if (upcoming.length) groups.push({ label: 'Upcoming', items: upcoming, labelColor: 'text-blue-500' });
    if (noDate.length) groups.push({ label: 'No Date', items: noDate, labelColor: 'text-[#8E8E93]' });
    if (groups.length === 0) groups.push({ label: null, items: [] });
    return groups;
  }, [activeItems, activeList]);

  const listTitle = activeList.startsWith('list:')
    ? activeList.replace('list:', '')
    : { today: 'Today', scheduled: 'Scheduled', all: 'All', completed: 'Completed' }[activeList];

  const handleAddList = () => {
    if (!newListName.trim()) return;
    // Lists are created implicitly via reminder.list_name
    // Just close dialog and switch to new list
    setActiveList(`list:${newListName.trim()}`);
    setShowAddListDialog(false);
    setNewListName('');
    setShowAdd(true);
  };

  return (
    <div className="flex h-screen -m-6 overflow-hidden bg-background">
      {/* Sidebar */}
      <ReminderSidebar
        activeList={activeList}
        onSelectList={(list) => { setActiveList(list); setSelectedReminder(null); }}
        lists={customLists}
        counts={counts}
        onAddList={() => setShowAddListDialog(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-card">
        {/* Top bar */}
        <div className="flex-shrink-0 px-6 pt-6 pb-3">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-foreground">{listTitle}</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 px-3 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 font-medium transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Import
              </button>
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 text-xs text-accent-foreground px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 font-medium transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> New Reminder
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search reminders..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-secondary rounded-xl border border-border outline-none placeholder:text-muted-foreground text-foreground focus:border-accent/50 transition-colors"
              />
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto">
          {/* Inline Add */}
          <AnimatePresence>
            {showAdd && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-b border-border"
              >
                <AddReminderInline
                  defaultListName={activeList.startsWith('list:') ? activeList.replace('list:', '') : ''}
                  onClose={() => setShowAdd(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {grouped.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <div className="px-6 py-2 bg-secondary/50">
                  <p className={`text-xs font-semibold uppercase tracking-wider ${group.labelColor}`}>
                    {group.label}
                  </p>
                </div>
              )}
              {group.items.length === 0 && gi === 0 && (
                <div className="text-center py-16 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
                    <Sparkles className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground">No reminders</p>
                  <button
                    onClick={() => setShowAdd(true)}
                    className="text-sm text-accent hover:text-accent/80 font-medium"
                  >
                    + Add a reminder
                  </button>
                </div>
              )}
              {group.items.map(r => (
                <ReminderItem
                  key={r.id}
                  reminder={r}
                  onComplete={(id) => completeMutation.mutate(id)}
                  onEdit={(rem) => setSelectedReminder(rem)}
                />
              ))}
            </div>
          ))}
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
          >
            <ReminderDetailPanel
              reminder={selectedReminder}
              onClose={() => setSelectedReminder(null)}
              onDelete={() => setSelectedReminder(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import Panel */}
      {showImport && (
        <ImportTasksPanel
          onClose={() => setShowImport(false)}
          existingTasks={reminders}
        />
      )}

      {/* Add List Dialog */}
      {showAddListDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowAddListDialog(false)}>
          <div className="bg-card border border-border rounded-2xl shadow-xl p-5 w-72 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-foreground text-sm">New List</h3>
            <div className="flex gap-2 flex-wrap">
              {LIST_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewListColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${newListColor === c ? 'scale-125 ring-2 ring-offset-1 ring-accent/50' : ''}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <input
              autoFocus
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddList()}
              placeholder="List name"
              className="w-full border border-border bg-secondary text-foreground placeholder:text-muted-foreground rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent/50"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowAddListDialog(false)} className="flex-1 py-2 text-sm text-muted-foreground border border-border rounded-xl hover:bg-secondary">Cancel</button>
              <button onClick={handleAddList} className="flex-1 py-2 text-sm text-accent-foreground bg-accent rounded-xl hover:bg-accent/90">OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}