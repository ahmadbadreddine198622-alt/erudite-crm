import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Send, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';

function CommentBubble({ comment }) {
  const isPhotographer = comment.author_role === 'photographer';
  
  return (
    <div className={`flex gap-1.5 ${isPhotographer ? 'justify-end' : 'justify-start'}`}>
      {!isPhotographer && (
        <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-[8px] shrink-0">
          {comment.author_email[0]?.toUpperCase()}
        </div>
      )}
      <div className={`max-w-[85%] ${isPhotographer ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`rounded-lg px-2 py-1.5 text-[9px] ${
            isPhotographer
              ? 'bg-accent/20 text-accent-foreground'
              : 'bg-white/10 text-foreground'
          }`}
        >
          {comment.message}
        </div>
        <span className="text-[8px] text-muted-foreground mt-0.5">
          {new Date(comment.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      {isPhotographer && (
        <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-[8px] shrink-0">
          {comment.author_email[0]?.toUpperCase()}
        </div>
      )}
    </div>
  );
}

export default function CommentsThread({ photographyTaskId, landlordPropertyId }) {
  const [message, setMessage] = useState('');
  const [showAll, setShowAll] = useState(false);
  const messagesEndRef = useRef(null);

  const { data: comments = [], refetch } = useQuery({
    queryKey: ['photography-comments', photographyTaskId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getPhotographyComments', { photography_task_id: photographyTaskId });
      return res.data?.comments || [];
    },
  });

  const postMutation = useMutation({
    mutationFn: async (msg) => {
      const res = await base44.functions.invoke('postPhotographyComment', {
        photography_task_id: photographyTaskId,
        landlord_property_id: landlordPropertyId,
        message: msg,
      });
      return res.data;
    },
    onSuccess: () => {
      refetch();
      setMessage('');
      toast.success('Comment posted');
    },
    onError: (err) => toast.error('Failed: ' + err.message),
  });

  const handleSend = () => {
    if (!message.trim()) return;
    postMutation.mutate(message.trim());
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const displayedComments = showAll ? comments : comments.slice(-3);

  return (
    <div className="space-y-2">
      {/* Heading - always visible */}
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-semibold" style={{ color: 'hsl(38 92% 55%)' }}>
          Messages
        </p>
        <Badge variant="outline" className="text-[8px] px-1.5 py-0.5" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}>
          {comments.length}
        </Badge>
      </div>
      
      {/* Comments list - always has minimum height */}
      <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 min-h-[48px]">
        {displayedComments.length === 0 ? (
          <p className="text-[8px] text-muted-foreground text-center py-3" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
            No messages yet — be the first to comment
          </p>
        ) : (
          displayedComments.map((comment, idx) => (
            <CommentBubble key={comment.id || idx} comment={comment} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Show more button */}
      {comments.length > 3 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-[8px] text-accent hover:underline w-full text-center"
          style={{ color: 'hsl(38 92% 55%)' }}
        >
          {showAll ? 'Show less' : `Show ${comments.length - 3} more`}
        </button>
      )}

      {/* Input - always visible */}
      <div className="flex gap-1.5">
        <Input
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 text-[9px] flex-1"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          disabled={postMutation.isPending}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleSend}
          disabled={postMutation.isPending || !message.trim()}
          className="h-7 px-3 text-[9px] gap-1"
          style={{ background: 'hsl(38 92% 50% / 0.15)', border: '1px solid hsl(38 92% 50% / 0.3)', color: 'hsl(38 92% 55%)' }}
        >
          {postMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <>
              <Send className="w-3 h-3" />
              Send
            </>
          )}
        </Button>
      </div>
    </div>
  );
}