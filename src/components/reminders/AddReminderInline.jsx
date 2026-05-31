import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X } from 'lucide-react';
import { toast } from 'sonner';

export default function AddReminderInline({ defaultListName, onClose }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Reminder.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminders'] });
      setTitle('');
      toast.success('Reminder added');
      onClose();
    },
    onError: () => toast.error('Failed to create reminder'),
  });

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!title.trim()) { onClose(); return; }
    createMutation.mutate({
      title: title.trim(),
      status: 'pending',
      source: 'manual',
      is_editable: true,
      list_name: defaultListName || undefined,
      list_color: '#3b82f6',
      due_at: new Date().toISOString(),
    });
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3 bg-blue-50/40">
      <div className="w-5 h-5 rounded-full border-2 border-blue-400 flex-shrink-0" />
      <form onSubmit={handleSubmit} className="flex-1">
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
          placeholder="New reminder…"
          className="w-full bg-transparent text-sm text-[#1C1C1E] placeholder:text-[#8E8E93] outline-none"
        />
      </form>
      <button onClick={onClose} className="text-[#C7C7CC] hover:text-[#8E8E93] transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}