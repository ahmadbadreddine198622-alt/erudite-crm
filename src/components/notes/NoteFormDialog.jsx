import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const CATEGORIES = ['deal', 'reference', 'personal', 'idea', 'other'];
const SOURCES = ['manual', 'imported_text', 'other'];

export default function NoteFormDialog({ note, onClose, onSaved }) {
  const isEdit = !!note;
  const [title, setTitle] = useState(note?.title || '');
  const [body, setBody] = useState(note?.body || '');
  const [category, setCategory] = useState(note?.category || 'other');
  const [source, setSource] = useState(note?.source || 'manual');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload = { title: title.trim(), body, category, source };
      if (isEdit) {
        await base44.entities.Note.update(note.id, payload);
      } else {
        await base44.entities.Note.create(payload);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-white/90">{isEdit ? 'Edit Note' : 'New Note'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs uppercase tracking-wide">Title *</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Give this note a title…"
              className="glass-input"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-white/60 text-xs uppercase tracking-wide">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="glass-input capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-white/60 text-xs uppercase tracking-wide">Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="glass-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs uppercase tracking-wide">Note Body</Label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Paste or type your note content here…"
              rows={10}
              className="glass-input w-full rounded-md px-3 py-2 text-sm resize-y min-h-[160px] leading-relaxed"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isEdit ? 'Save Changes' : 'Create Note'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}