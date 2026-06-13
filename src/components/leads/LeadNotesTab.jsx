import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Send, Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentUser } from '@/lib/useCurrentUser';

export default function LeadNotesTab({ lead }) {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState('');

  // Fetch only note-type LeadActivity records for this lead
  const { data: allActivities = [], isLoading } = useQuery({
    queryKey: ['lead-activities', lead.id],
    queryFn: () => base44.entities.LeadActivity.filter({ lead_id: lead.id }, '-created_date', 200),
    enabled: !!lead.id,
  });

  // SAFETY: only ever show/edit/delete activity_type === 'note'
  const notes = allActivities.filter(a => a.activity_type === 'note');

  const addMutation = useMutation({
    mutationFn: (body) => base44.entities.LeadActivity.create({
      lead_id: lead.id,
      activity_type: 'note',
      title: 'Note',
      body,
      created_by: user?.full_name || user?.email || 'Agent',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-activities', lead.id] });
      setDraft('');
      toast.success('Note added');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => base44.entities.LeadActivity.update(id, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-activities', lead.id] });
      setEditingId(null);
      toast.success('Note updated');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.LeadActivity.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-activities', lead.id] });
      toast.success('Note deleted');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });

  const handleAdd = () => {
    if (!draft.trim()) return;
    addMutation.mutate(draft.trim());
  };

  const startEdit = (note) => {
    setEditingId(note.id);
    setEditBody(note.body || '');
  };

  const handleUpdate = () => {
    if (!editBody.trim()) return;
    updateMutation.mutate({ id: editingId, body: editBody.trim() });
  };

  const handleDelete = (id) => {
    if (!confirm('Delete this note?')) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="p-5 space-y-4">
      {/* Add note */}
      <div className="flex gap-2 items-end">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleAdd(); }}
          placeholder="Add a contact note… (⌘+Enter to save)"
          rows={2}
          className="flex-1 text-sm resize-none rounded-lg px-3 py-2 outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
        />
        <button
          onClick={handleAdd}
          disabled={!draft.trim() || addMutation.isPending}
          className="flex items-center justify-center w-9 h-9 rounded-lg transition-all active:scale-95 disabled:opacity-40"
          style={{ background: 'hsl(38 92% 50%)', color: '#1a1a2e' }}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Notes list */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No contact notes yet — add one above.</p>
      ) : (
        <div className="space-y-2">
          {notes.map(note => (
            <div key={note.id} className="rounded-xl px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
              {editingId === note.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    rows={3}
                    autoFocus
                    className="w-full text-sm resize-none rounded-lg px-3 py-2 outline-none"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(245,159,10,0.4)', color: 'rgba(255,255,255,0.9)' }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdate}
                      disabled={!editBody.trim() || updateMutation.isPending}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-40 transition-all active:scale-95"
                      style={{ background: 'hsl(38 92% 50%)', color: '#1a1a2e' }}
                    >
                      <Check className="w-3 h-3" /> Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}
                    >
                      <X className="w-3 h-3" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.88)' }}>{note.body}</p>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.38)' }}>
                      {note.created_by && <span className="font-semibold mr-1" style={{ color: 'hsl(38 92% 50%)' }}>{note.created_by}</span>}
                      {note.created_date && format(new Date(note.created_date), 'MMM d, h:mm a')}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => startEdit(note)}
                        className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-white transition"
                        title="Edit note"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1 rounded-md hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition"
                        title="Delete note"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}