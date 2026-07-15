import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { input, goldBtn, GOLD, GOLD_LITE, label } from '@/lib/academyStyles';
import { parseVideoUrl } from './videoEmbed';

export default function AddTrainingVideoDialog({ open, onClose, video = null }) {
  const qc = useQueryClient();
  const editing = !!video;

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [sortOrder, setSortOrder] = useState(0);

  useEffect(() => {
    if (open) {
      setTitle(video?.title || '');
      setUrl(video?.url || '');
      setDescription(video?.description || '');
      setCategory(video?.category || '');
      setSortOrder(video?.sort_order ?? 0);
    }
  }, [open, video]);

  const parsed = parseVideoUrl(url);
  const previewThumb = parsed.thumb;

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim(),
        url: url.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        sort_order: Number(sortOrder) || 0,
        is_active: true,
      };
      if (editing) {
        await base44.entities.TrainingVideo.update(video.id, payload);
      } else {
        await base44.entities.TrainingVideo.create(payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training-videos'] });
      toast.success(editing ? 'Training video updated' : 'Training video added');
      onClose();
    },
    onError: (e) => toast.error('Could not save: ' + e.message),
  });

  const canSave = title.trim() && url.trim() && parsed.type !== 'unknown';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" style={{ background: 'hsl(222 47% 8%)', border: '1px solid rgba(212,175,55,0.2)' }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Playfair Display', serif", color: GOLD_LITE }}>
            {editing ? 'Edit Training Video' : 'Add Training Video'}
          </DialogTitle>
          <DialogDescription style={{ color: 'rgba(255,255,255,0.5)' }}>
            Paste a YouTube or Google Drive share link. It is embedded automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label style={{ ...label, color: GOLD, display: 'block', marginBottom: 4 }}>Title *</label>
            <input style={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Week 1 — Burning Desire" />
          </div>
          <div>
            <label style={{ ...label, color: GOLD, display: 'block', marginBottom: 4 }}>Video Link *</label>
            <input style={input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtu.be/… or https://drive.google.com/file/d/…/view" />
            {url && parsed.type === 'unknown' && (
              <p style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>Couldn't recognise this as a YouTube or Google Drive link.</p>
            )}
            {url && parsed.type !== 'unknown' && (
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                Detected: {parsed.type === 'youtube' ? 'YouTube' : 'Google Drive'}
              </p>
            )}
          </div>
          {previewThumb && (
            <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              <img src={previewThumb} alt="preview" style={{ width: '100%', display: 'block', maxHeight: 160, objectFit: 'cover' }} />
            </div>
          )}
          <div>
            <label style={{ ...label, color: GOLD, display: 'block', marginBottom: 4 }}>Category</label>
            <input style={input} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Week 1, Mindset, Closing…" />
          </div>
          <div>
            <label style={{ ...label, color: GOLD, display: 'block', marginBottom: 4 }}>Description</label>
            <textarea style={{ ...input, minHeight: 70, resize: 'vertical' }} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label style={{ ...label, color: GOLD, display: 'block', marginBottom: 4 }}>Sort Order</label>
            <input style={{ ...input, maxWidth: 120 }} type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!canSave || saveMut.isPending} onClick={() => saveMut.mutate()}
            style={{ background: 'linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%))', color: '#1a1205', border: '1px solid rgba(212,175,55,0.5)' }}>
            {saveMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {editing ? 'Save Changes' : 'Add Video'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}