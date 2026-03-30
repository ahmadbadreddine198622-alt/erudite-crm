import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tag, X, Plus } from 'lucide-react';

const QUICK_TAGS = ['Hot Lead', 'Follow Up', 'Interested', 'Negotiating', 'Ready to Buy', 'Price Sensitive', 'Cold Lead', 'Investor'];

export default function TagsEditor({ conv }) {
  const [adding, setAdding] = useState(false);
  const [newTag, setNewTag] = useState('');
  const queryClient = useQueryClient();

  const updateTags = useMutation({
    mutationFn: (tags) => base44.entities.WhatsAppConversation.update(conv.id, { manual_tags: tags }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wa_conversations'] }),
  });

  const tags = conv.manual_tags || [];

  const addTag = (tag) => {
    if (!tag.trim() || tags.includes(tag)) return;
    updateTags.mutate([...tags, tag.trim()]);
    setNewTag('');
    setAdding(false);
  };

  const removeTag = (tag) => {
    updateTags.mutate(tags.filter(t => t !== tag));
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap min-h-[24px]">
      <Tag className="w-3 h-3 text-muted-foreground shrink-0" />
      {tags.map(t => (
        <Badge key={t} variant="secondary" className="text-[10px] h-5 gap-1 pl-2 pr-1">
          {t}
          <button onClick={() => removeTag(t)} className="hover:text-destructive">
            <X className="w-2.5 h-2.5" />
          </button>
        </Badge>
      ))}
      {adding ? (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') addTag(newTag);
              if (e.key === 'Escape') setAdding(false);
            }}
            placeholder="Tag name..."
            className="h-5 text-[11px] w-28 px-2"
          />
          {/* Quick pick */}
          <div className="flex gap-1 flex-wrap">
            {QUICK_TAGS.filter(q => !tags.includes(q)).slice(0, 4).map(q => (
              <button
                key={q}
                onClick={() => addTag(q)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-accent/20 text-muted-foreground hover:text-foreground transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-[10px] flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="w-3 h-3" /> Add tag
        </button>
      )}
    </div>
  );
}