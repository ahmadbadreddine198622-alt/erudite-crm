import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Send, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';

// Email to friendly name mapping - extend as needed
const USER_NAMES = {
  "dari@erudite-estate.com": "Dari",
  "ahmad.badreddine198622@gmail.com": "Ahmad",
};

function getFriendlyName(email) {
  if (USER_NAMES[email]) return USER_NAMES[email];
  // Fallback: use part before @
  return email.split('@')[0];
}

function CommentBubble({ comment }) {
  const isPhotographer = comment.author_role === 'photographer';
  const time = new Date(comment.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const friendlyName = getFriendlyName(comment.author_email);
  const roleLabel = isPhotographer ? 'Photographer' : 'Agent';
  
  return (
    <div className={`flex gap-1.5 ${isPhotographer ? 'justify-start' : 'justify-end'}`}>
      {/* Avatar - Photographer on left, Agent on right */}
      {isPhotographer && (
        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-[9px] shrink-0 border border-amber-500/30">
          {friendlyName[0]?.toUpperCase()}
        </div>
      )}
      
      <div className={`max-w-[80%] ${isPhotographer ? 'items-start' : 'items-end'} flex flex-col gap-0.5`}>
        {/* Author label with friendly name */}
        <span className={`text-[7px] font-semibold ${isPhotographer ? 'text-left' : 'text-right'}`} style={{ color: isPhotographer ? 'hsl(38 92% 55%)' : 'rgba(255,255,255,0.5)' }}>
          {friendlyName} ({roleLabel})
        </span>
        
        {/* Message bubble */}
        <div
          className={`rounded-lg px-2.5 py-1.5 text-[9px] leading-relaxed ${
            isPhotographer
              ? 'bg-amber-500/20 border border-amber-500/30 text-white'
              : 'bg-white/15 border border-white/20 text-white'
          }`}
        >
          {comment.message}
        </div>
        
        {/* Timestamp */}
        <span className={`text-[7px] ${isPhotographer ? 'text-left' : 'text-right'}`} style={{ color: 'rgba(255,255,255,0.4)' }}>
          {time}
        </span>
      </div>
      
      {!isPhotographer && (
        <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-[9px] shrink-0 border border-emerald-500/30">
          {friendlyName[0]?.toUpperCase()}
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
    <div className="space-y-2" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Heading - always visible */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9px] font-semibold" style={{ color: 'hsl(38 92% 55%)' }}>
          Messages
        </p>
        <Badge variant="outline" className="text-[8px] px-1.5 py-0.5" style={{ background: 'hsl(38 92% 50% / 0.15)', border: '1px solid hsl(38 92% 50% / 0.3)', color: 'hsl(38 92% 55%)' }}>
          {comments.length}
        </Badge>
      </div>
      
      {/* Comments list - always has minimum height */}
      <div className="space-y-2 max-h-40 overflow-y-auto pr-1 min-h-[60px]" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }}>
        {displayedComments.length === 0 ? (
          <div className="flex items-center justify-center py-4" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <p className="text-[8px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
              No messages yet — be the first to comment
            </p>
          </div>
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
          className="text-[8px] hover:underline w-full text-center mt-1"
          style={{ color: 'hsl(38 92% 55%)' }}
        >
          {showAll ? 'Show less' : `Show ${comments.length - 3} more`}
        </button>
      )}

      {/* Input - always visible */}
      <div className="flex gap-2 mt-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <Input
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-[9px] flex-1"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.95)' }}
          disabled={postMutation.isPending}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleSend}
          disabled={postMutation.isPending || !message.trim()}
          className="h-8 px-3 text-[9px] gap-1"
          style={{ background: 'hsl(38 92% 50%)', border: '1px solid hsl(38 92% 50% / 0.5)', color: 'hsl(222 47% 11%)' }}
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