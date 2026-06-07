import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Pin, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentUser } from '@/lib/useCurrentUser';

const pinStyle = { color: 'hsl(38 92% 55%)' };

function NoteCard({ note, onPin, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);
  const qc = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.LandlordNote.update(note.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['landlord-notes', note.landlord_id] }); },
  });

  const saveEdit = () => {
    if (!body.trim()) return;
    updateMutation.mutate({ body: body.trim() });
    setEditing(false);
  };

  return (
    <div
      className="rounded-xl p-3 space-y-1.5"
      style={{
        background: note.pinned ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.04)',
        border: note.pinned ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {note.pinned && <Pin className="w-3 h-3 shrink-0" style={pinStyle} />}
          <span className="text-[10px] text-muted-foreground">
            {note.author_name || note.author_email?.split('@')[0] || 'Agent'} · {note.created_date ? format(new Date(note.created_date), 'd MMM HH:mm') : ''}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onPin(note)} title={note.pinned ? 'Unpin' : 'Pin'} className="p-1 rounded hover:bg-white/10 transition-colors">
            <Pin className="w-3 h-3" style={note.pinned ? pinStyle : { color: 'rgba(255,255,255,0.3)' }} />
          </button>
          <button onClick={() => { setEditing(true); setBody(note.body); }} className="p-1 rounded hover:bg-white/10 transition-colors">
            <Pencil className="w-3 h-3 text-muted-foreground hover:text-white" />
          </button>
          <button onClick={() => onDelete(note.id)} className="p-1 rounded hover:bg-red-500/20 transition-colors">
            <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-400" />
          </button>
        </div>
      </div>

      {/* Body */}
      {editing ? (
        <div className="space-y-1.5">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            autoFocus
            rows={3}
            className="w-full px-2 py-1.5 text-xs rounded-md resize-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
          />
          <div className="flex gap-1.5">
            <button onClick={saveEdit} disabled={updateMutation.isPending} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition-colors" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
              <Check className="w-3 h-3" /> Save
            </button>
            <button onClick={() => setEditing(false)} className="text-[11px] px-2 py-1 rounded-md text-muted-foreground hover:text-white border border-white/10 hover:bg-white/08 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.8)' }}>{note.body}</p>
      )}
    </div>
  );
}

export default function LandlordNotesPanel({ landlord }) {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [newNote, setNewNote] = useState('');

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['landlord-notes', landlord?.id],
    queryFn: async () => {
      const all = await base44.entities.LandlordNote.filter({ landlord_id: landlord.id }, '-created_date', 200);
      // pinned first, then by date
      return [...(all.filter(n => n.pinned)), ...(all.filter(n => !n.pinned))];
    },
    enabled: !!landlord?.id,
  });

  const createMutation = useMutation({
    mutationFn: (body) => base44.entities.LandlordNote.create({
      landlord_id: landlord.id,
      body,
      author_email: user?.email,
      author_name: user?.full_name || user?.email?.split('@')[0],
      pinned: false,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landlord-notes', landlord.id] });
      setNewNote('');
    },
    onError: (e) => toast.error('Failed to save note: ' + e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.LandlordNote.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['landlord-notes', landlord.id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.LandlordNote.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['landlord-notes', landlord.id] }); toast.success('Note deleted'); },
  });

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const t = newNote.trim();
      if (t) createMutation.mutate(t);
    }
  };

  const handlePin = (note) => updateMutation.mutate({ id: note.id, data: { pinned: !note.pinned } });

  return (
    <div className="flex flex-col gap-3">
      {isLoading ? (
        <div className="text-xs text-muted-foreground text-center py-4">Loading notes…</div>
      ) : notes.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-4">No notes yet. Type below and press Enter.</div>
      ) : (
        <div className="space-y-2">
          {notes.map(n => (
            <NoteCard
              key={n.id}
              note={n}
              onPin={handlePin}
              onEdit={() => {}}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Quick note input */}
      <div className="flex items-center gap-2 pt-1">
        <textarea
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Quick note… (Enter to save, Shift+Enter for newline)"
          rows={2}
          className="flex-1 px-3 py-2 text-xs rounded-lg resize-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }}
        />
        {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>
    </div>
  );
}

// Exported separately: the pinned note strip shown above the chat
export function PinnedNoteStrip({ landlord }) {
  const [collapsed, setCollapsed] = useState(false);

  const { data: pinnedNote } = useQuery({
    queryKey: ['landlord-pinned-note', landlord?.id],
    queryFn: async () => {
      const all = await base44.entities.LandlordNote.filter({ landlord_id: landlord.id, pinned: true }, '-created_date', 1);
      return all?.[0] || null;
    },
    enabled: !!landlord?.id,
  });

  if (!pinnedNote) return null;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 cursor-pointer"
      style={{ background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)' }}
      onClick={() => setCollapsed(c => !c)}
    >
      <Pin className="w-3 h-3 shrink-0" style={{ color: 'hsl(38 92% 55%)' }} />
      <p className={`flex-1 text-[11px] ${collapsed ? 'truncate' : 'whitespace-pre-wrap break-words'}`} style={{ color: 'hsl(38 92% 65%)' }}>
        {pinnedNote.body}
      </p>
      <span className="text-[10px] text-muted-foreground shrink-0">{collapsed ? '▼' : '▲'}</span>
    </div>
  );
}