import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Plus, Trash2, Flag, Calendar, User, Tag, FileText, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
const nanoid = (n = 8) => Math.random().toString(36).slice(2, 2 + n);

const PRIORITIES = [
  { value: 'none', label: 'None', color: 'text-gray-300' },
  { value: 'low', label: 'Low', color: 'text-gray-400' },
  { value: 'medium', label: 'Medium', color: 'text-blue-500' },
  { value: 'high', label: 'High', color: 'text-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-500' },
];

export default function ReminderDetailPanel({ reminder, onClose, onDelete }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(reminder);
  const [newSubtask, setNewSubtask] = useState('');
  const [newTag, setNewTag] = useState('');

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-mini'],
    queryFn: () => base44.entities.Lead.list('-created_date', 100),
  });

  // Fetch child reminders (subtasks) for iOS-synced reminders
  const { data: childReminders = [] } = useQuery({
    queryKey: ['reminder-children', reminder?.id],
    queryFn: () => base44.entities.Reminder.filter({ parent_reminder_id: reminder?.id }, 'created_date', 100),
    enabled: !!reminder?.id,
    staleTime: 30000,
  });

  useEffect(() => { setDraft(reminder); }, [reminder?.id]);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Reminder.update(draft.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminders'] });
      toast.success('Saved');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Reminder.delete(draft.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminders'] });
      onDelete();
    },
  });

  const save = (fields) => {
    const updated = { ...draft, ...fields };
    setDraft(updated);
    updateMutation.mutate(updated);
  };

  const addSubtask = async () => {
    if (!newSubtask.trim()) return;
    try {
      await base44.entities.Reminder.create({
        title: newSubtask.trim(),
        notes: `Subtask of: ${draft.title}`,
        priority: draft.priority,
        status: 'pending',
        parent_reminder_id: draft.id,
      });
      setNewSubtask('');
      qc.invalidateQueries({ queryKey: ['reminder-children', draft.id] });
      toast.success('Subtask added');
    } catch (error) {
      toast.error('Failed to add subtask');
    }
  };

  const toggleSubtask = async (childReminder) => {
    try {
      await base44.entities.Reminder.update(childReminder.id, {
        status: childReminder.status === 'completed' ? 'pending' : 'completed',
      });
      qc.invalidateQueries({ queryKey: ['reminder-children', draft.id] });
    } catch (error) {
      toast.error('Failed to update subtask');
    }
  };

  const removeSubtask = async (childReminder) => {
    try {
      await base44.entities.Reminder.delete(childReminder.id);
      qc.invalidateQueries({ queryKey: ['reminder-children', draft.id] });
      toast.success('Subtask removed');
    } catch (error) {
      toast.error('Failed to remove subtask');
    }
  };

  const addTag = () => {
    if (!newTag.trim()) return;
    save({ tags: [...(draft.tags || []), newTag.trim()] });
    setNewTag('');
  };

  const removeTag = (tag) => save({ tags: (draft.tags || []).filter(t => t !== tag) });

  if (!draft) return null;

  return (
    <div className="w-80 flex-shrink-0 bg-white border-l border-[#E5E7EB] flex flex-col h-full shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F2F7]">
        <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">Details</span>
        <div className="flex gap-1">
          <button onClick={() => deleteMutation.mutate()} className="p-1.5 rounded-lg hover:bg-red-50 text-[#8E8E93] hover:text-red-500 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F2F2F7] text-[#8E8E93] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title */}
        <div>
          <label className="text-[10px] text-[#8E8E93] font-semibold uppercase tracking-wider">Title</label>
          <Input
            value={draft.title || ''}
            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            onBlur={() => updateMutation.mutate(draft)}
            className="mt-1 text-sm font-medium border-0 border-b rounded-none px-0 focus-visible:ring-0 border-[#E5E7EB]"
            placeholder="Task title"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-[10px] text-[#8E8E93] font-semibold uppercase tracking-wider flex items-center gap-1">
            <FileText className="w-3 h-3" /> Notes
          </label>
          <Textarea
            value={draft.notes || ''}
            onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
            onBlur={() => updateMutation.mutate(draft)}
            placeholder="Add notes..."
            className="mt-1 text-xs min-h-[60px] resize-none border-[#E5E7EB]"
          />
        </div>

        {/* Due Date */}
        <div>
          <label className="text-[10px] text-[#8E8E93] font-semibold uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Due Date
          </label>
          <input
            type="datetime-local"
            value={draft.due_date ? draft.due_date.slice(0, 16) : ''}
            onChange={e => save({ due_date: e.target.value })}
            className="mt-1 w-full text-xs border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
          />
        </div>

        {/* Priority */}
        <div>
          <label className="text-[10px] text-[#8E8E93] font-semibold uppercase tracking-wider flex items-center gap-1">
            <Flag className="w-3 h-3" /> Priority
          </label>
          <div className="flex gap-1.5 mt-1.5">
            {PRIORITIES.map(p => (
              <button
                key={p.value}
                onClick={() => save({ priority: p.value })}
                className={`flex-1 py-1.5 text-[10px] font-semibold rounded-lg border transition-all ${
                  draft.priority === p.value
                    ? 'border-blue-400 bg-blue-50 text-blue-600'
                    : 'border-[#E5E7EB] text-[#8E8E93] hover:border-blue-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Linked Contact */}
        <div>
          <label className="text-[10px] text-[#8E8E93] font-semibold uppercase tracking-wider flex items-center gap-1">
            <User className="w-3 h-3" /> Linked Contact
          </label>
          <select
            value={draft.lead_id || ''}
            onChange={e => {
              const lead = leads.find(l => l.id === e.target.value);
              save({ lead_id: e.target.value, lead_name: lead?.name || '' });
            }}
            className="mt-1 w-full text-xs border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 bg-white"
          >
            <option value="">No contact linked</option>
            {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        {/* Tags */}
        <div>
          <label className="text-[10px] text-[#8E8E93] font-semibold uppercase tracking-wider flex items-center gap-1">
            <Tag className="w-3 h-3" /> Tags
          </label>
          <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
            {(draft.tags || []).map(tag => (
              <span key={tag} className="flex items-center gap-1 text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                {tag}
                <button onClick={() => removeTag(tag)}><X className="w-2.5 h-2.5" /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Input
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="Add tag..."
              className="h-7 text-xs flex-1"
            />
            <Button size="sm" variant="outline" onClick={addTag} className="h-7 px-2">
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Subtasks */}
        <div>
          <label className="text-[10px] text-[#8E8E93] font-semibold uppercase tracking-wider">
            Subtasks {childReminders.length > 0 && `(${childReminders.length})`}
          </label>
          <div className="mt-1.5 space-y-1">
            {childReminders.length === 0 ? (
              <p className="text-xs text-[#8E8E93] italic">No subtasks</p>
            ) : (
              childReminders.map((child) => (
                <div key={child.id} className="flex items-center gap-2 group/sub">
                  <button onClick={() => toggleSubtask(child)}>
                    {child.status === 'completed'
                      ? <CheckCircle2 className="w-4 h-4 text-blue-500" />
                      : <Circle className="w-4 h-4 text-[#C7C7CC]" />
                    }
                  </button>
                  <span className={`text-xs flex-1 ${child.status === 'completed' ? 'line-through text-[#8E8E93]' : 'text-[#1C1C1E]'}`}>
                    {child.title}
                  </span>
                  <button
                    onClick={() => removeSubtask(child)}
                    className="opacity-0 group-hover/sub:opacity-100 text-[#C7C7CC] hover:text-red-400 transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-1.5 mt-2">
            <Input
              value={newSubtask}
              onChange={e => setNewSubtask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
              placeholder="Add subtask..."
              className="h-7 text-xs flex-1"
            />
            <Button size="sm" variant="outline" onClick={addSubtask} className="h-7 px-2">
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Source badge */}
        {draft.source && draft.source !== 'manual' && (
          <div className="pt-2 border-t border-[#F2F2F7]">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              draft.source === 'imported' ? 'bg-orange-50 text-orange-500' : 'bg-purple-50 text-purple-500'
            }`}>
              {draft.source === 'imported' ? '↓ Imported' : '✦ AI Suggested'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}