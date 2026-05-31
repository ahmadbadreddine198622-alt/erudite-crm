import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Sparkles, FileText, Trash2, ChevronRight, Loader2, Tag } from 'lucide-react';
import NoteFormDialog from '@/components/notes/NoteFormDialog';
import NoteDetailSheet from '@/components/notes/NoteDetailSheet';

const CATEGORY_STYLES = {
  deal:      { label: 'Deal',      cls: 'jewel-gold' },
  reference: { label: 'Reference', cls: 'jewel-blue' },
  personal:  { label: 'Personal',  cls: 'jewel-purple' },
  idea:      { label: 'Idea',      cls: 'jewel-emerald' },
  other:     { label: 'Other',     cls: 'jewel-slate' },
};

const ALL_CATS = ['all', 'deal', 'reference', 'personal', 'idea', 'other'];

export default function Notes() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editNote, setEditNote] = useState(null);
  const [activeNote, setActiveNote] = useState(null);
  const [analyzingId, setAnalyzingId] = useState(null);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: () => base44.entities.Note.list('-updated_date', 100),
  });

  const deleteNote = useMutation({
    mutationFn: (id) => base44.entities.Note.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      if (activeNote) setActiveNote(null);
    },
  });

  async function handleAnalyze(note, e) {
    e.stopPropagation();
    setAnalyzingId(note.id);
    try {
      await base44.functions.invoke('analyzeNote', { note_id: note.id });
      qc.invalidateQueries({ queryKey: ['notes'] });
      if (activeNote?.id === note.id) {
        const updated = await base44.entities.Note.get(note.id);
        setActiveNote(updated);
      }
    } finally {
      setAnalyzingId(null);
    }
  }

  const filtered = notes.filter(n => {
    const matchCat = filter === 'all' || n.category === filter;
    const matchSearch = !search || n.title?.toLowerCase().includes(search.toLowerCase()) || n.body?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="page-root">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title text-2xl flex items-center gap-2">
            <FileText className="w-6 h-6 gold-text" /> Smart Notes
          </h1>
          <p className="page-subtitle mt-0.5">Paste any note — Claude extracts insights, actions &amp; mentions.</p>
        </div>
        <Button onClick={() => { setEditNote(null); setShowForm(true); }} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> New Note
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Input
          placeholder="Search notes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="glass-input h-8 w-48 text-sm"
        />
        <div className="flex gap-1 flex-wrap">
          {ALL_CATS.map(c => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all border ${
                filter === c
                  ? 'bg-accent text-accent-foreground border-accent'
                  : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white/75'
              }`}
            >
              {c === 'all' ? 'All' : CATEGORY_STYLES[c]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/30 gap-3">
          <FileText className="w-10 h-10" />
          <p className="text-sm">No notes yet. Create one above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(note => {
            const cat = CATEGORY_STYLES[note.category] || CATEGORY_STYLES.other;
            const isAnalyzing = analyzingId === note.id;
            const hasAI = !!note.ai_summary;
            return (
              <div
                key={note.id}
                onClick={() => setActiveNote(note)}
                className="glass-card p-4 cursor-pointer hover:border-white/20 transition-all group relative flex flex-col gap-3"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm text-white/90 line-clamp-1 flex-1">{note.title || 'Untitled'}</p>
                  <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 shrink-0 mt-0.5" />
                </div>

                {/* Body preview */}
                <p className="text-xs text-white/50 line-clamp-3 leading-relaxed">{note.body || '—'}</p>

                {/* AI summary preview */}
                {hasAI && (
                  <div className="rounded-lg bg-accent/10 border border-accent/20 px-3 py-2">
                    <p className="text-xs text-accent/80 line-clamp-2">{note.ai_summary}</p>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-auto pt-1">
                  <span className={`jewel-pill ${cat.cls}`}>
                    <Tag className="w-2.5 h-2.5" /> {cat.label}
                  </span>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={e => handleAnalyze(note, e)}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 gold-text" />}
                      {isAnalyzing ? 'Analyzing…' : hasAI ? 'Re-analyze' : 'Analyze'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 hover:text-red-400"
                      onClick={e => { e.stopPropagation(); deleteNote.mutate(note.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      {showForm && (
        <NoteFormDialog
          note={editNote}
          onClose={() => { setShowForm(false); setEditNote(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['notes'] }); setShowForm(false); setEditNote(null); }}
        />
      )}

      {activeNote && (
        <NoteDetailSheet
          note={activeNote}
          onClose={() => setActiveNote(null)}
          onEdit={() => { setEditNote(activeNote); setShowForm(true); setActiveNote(null); }}
          onDelete={() => deleteNote.mutate(activeNote.id)}
          onAnalyze={(n) => handleAnalyze(n, { stopPropagation: () => {} })}
          analyzingId={analyzingId}
          onRefresh={async () => {
            const updated = await base44.entities.Note.get(activeNote.id);
            setActiveNote(updated);
            qc.invalidateQueries({ queryKey: ['notes'] });
          }}
        />
      )}
    </div>
  );
}