import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bell, Plus, CheckCircle2, Circle, Calendar } from 'lucide-react';
import { format, isToday, isPast } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function ContactRemindersSection({ contactId, contactName }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');

  const { data: reminders = [] } = useQuery({
    queryKey: ['contact-reminders', contactId],
    queryFn: () => base44.entities.Reminder.filter({ lead_id: contactId }, '-due_date', 10),
    enabled: !!contactId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Reminder.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-reminders', contactId] });
      qc.invalidateQueries({ queryKey: ['reminders'] });
      setNewTitle('');
      setNewDate('');
      setShowAdd(false);
      toast.success('Reminder added');
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id) => base44.entities.Reminder.update(id, { status: 'completed', completed_at: new Date().toISOString() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-reminders', contactId] });
      qc.invalidateQueries({ queryKey: ['reminders'] });
    },
  });

  const pending = reminders.filter(r => r.status === 'pending');
  const completed = reminders.filter(r => r.status === 'completed');

  return (
    <div className="border-b border-[#F3F4F6] last:border-0">
      <button
        onClick={() => setShowAdd(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-[#FAFAFA] transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-[#374151] uppercase tracking-wider">
          <Bell className="w-3.5 h-3.5 text-[#9CA3AF]" />
          Reminders
          {pending.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
              {pending.length}
            </span>
          )}
        </span>
        <Plus className="w-3.5 h-3.5 text-[#9CA3AF]" />
      </button>

      <div className="px-5 pb-3 space-y-1.5">
        {/* Pending */}
        {pending.map(r => {
          const isOverdue = r.due_date && isPast(new Date(r.due_date)) && !isToday(new Date(r.due_date));
          return (
            <div key={r.id} className="flex items-start gap-2 py-1">
              <button onClick={() => completeMutation.mutate(r.id)} className="mt-0.5 flex-shrink-0">
                <Circle className="w-4 h-4 text-[#C7C7CC] hover:text-blue-400 transition-colors" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#1C1C1E]">{r.title}</p>
                {r.due_date && (
                  <p className={`text-[10px] mt-0.5 ${isOverdue ? 'text-red-500 font-semibold' : 'text-[#9CA3AF]'}`}>
                    <Calendar className="w-2.5 h-2.5 inline mr-1" />
                    {format(new Date(r.due_date), 'MMM d, h:mm a')}
                    {isOverdue && ' · Overdue'}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {completed.length > 0 && (
          <div className="space-y-1">
            {completed.slice(0, 2).map(r => (
              <div key={r.id} className="flex items-center gap-2 py-0.5 opacity-40">
                <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <p className="text-xs text-[#1C1C1E] line-through">{r.title}</p>
              </div>
            ))}
          </div>
        )}

        {pending.length === 0 && completed.length === 0 && (
          <p className="text-xs text-[#9CA3AF] italic">No reminders</p>
        )}

        {/* Inline Add Form */}
        <AnimatePresence>
          {showAdd && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-2 space-y-2 border-t border-[#F3F4F6]">
                <input
                  autoFocus
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Reminder title…"
                  className="w-full text-xs border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400"
                />
                <input
                  type="datetime-local"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="w-full text-xs border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAdd(false)}
                    className="flex-1 py-1.5 text-xs text-[#6B7280] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!newTitle.trim()) return;
                      createMutation.mutate({
                        title: newTitle.trim(),
                        due_date: newDate || undefined,
                        lead_id: contactId,
                        lead_name: contactName,
                        status: 'pending',
                        type: 'follow_up',
                        source: 'manual',
                        is_editable: true,
                      });
                    }}
                    disabled={!newTitle.trim() || createMutation.isPending}
                    className="flex-1 py-1.5 text-xs text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}