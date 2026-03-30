import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';

export default function SmartReplies({ conversationId, onSelect }) {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchReplies = async () => {
    setLoading(true);
    setReplies([]);
    const res = await base44.functions.invoke('getSmartReplies', { conversation_id: conversationId });
    setReplies(res.data?.replies || []);
    setLoading(false);
  };

  return (
    <div className="px-4 pb-2">
      {replies.length === 0 ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchReplies}
          disabled={loading}
          className="h-7 text-xs gap-1.5 text-accent hover:text-accent"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {loading ? 'Generating replies...' : 'Smart Reply Suggestions'}
        </Button>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Sparkles className="w-3 h-3 text-accent" />
            <span className="text-[11px] text-muted-foreground font-medium">AI Suggestions — click to use</span>
            <button onClick={() => setReplies([])} className="ml-auto text-[10px] text-muted-foreground hover:text-foreground">✕</button>
          </div>
          {replies.map((r, i) => (
            <button
              key={i}
              onClick={() => { onSelect(r); setReplies([]); }}
              className="text-left text-xs bg-accent/10 hover:bg-accent/20 text-foreground border border-accent/20 rounded-lg px-3 py-2 transition-colors"
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}