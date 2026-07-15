import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Camera, MessageSquare, ChevronDown, ChevronUp, ExternalLink, Box } from 'lucide-react';
import { toast } from 'sonner';
import ModernComposerField from '@/components/landlord/ModernComposerField';

/**
 * CommentsThread — the Agent ⇄ Photographer exchange on a PhotographyTask.
 *
 * Used on BOTH sides of the workflow:
 *   • Landlord record → Photos & Videos section (agent side)
 *   • Photography Worklist → PhotographerVCard (photographer side)
 *
 * URLs in messages are clickable; Matterport links render with a 3D Tour badge
 * so both sides can exchange the 3D tour link directly in the thread.
 * Composer is ModernComposerField (shared writing toolkit: dictation,
 * translate, tone rewrite, magic reshape).
 */

const GOLD = 'hsl(38 92% 55%)';

// Split a message into text + URL parts so links are clickable.
const URL_RE = /(https?:\/\/[^\s]+)/g;

function is3DLink(url) {
  return /matterport\.com|my\.matterport|3d|tour/i.test(url);
}

function MessageBody({ text }) {
  const parts = String(text || '').split(URL_RE);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (URL_RE.test(part)) {
          URL_RE.lastIndex = 0; // reset stateful regex
          const threeD = is3DLink(part);
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline break-all"
              style={{ color: GOLD }}
            >
              {threeD ? <Box className="w-3 h-3 shrink-0" /> : <ExternalLink className="w-3 h-3 shrink-0" />}
              {threeD ? '3D Tour' : part.length > 42 ? part.slice(0, 42) + '…' : part}
            </a>
          );
        }
        URL_RE.lastIndex = 0;
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

export default function CommentsThread({ photographyTaskId, landlordPropertyId, defaultOpen = true }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(defaultOpen);
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['photography-comments', photographyTaskId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getPhotographyComments', {
        photography_task_id: photographyTaskId,
      });
      return res.data?.comments || [];
    },
    enabled: !!photographyTaskId,
    refetchInterval: 15000,
  });

  const sendMutation = useMutation({
    mutationFn: (message) =>
      base44.functions.invoke('postPhotographyComment', {
        photography_task_id: photographyTaskId,
        landlord_property_id: landlordPropertyId,
        message,
      }),
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries({ queryKey: ['photography-comments', photographyTaskId] });
    },
    onError: (e) => toast.error('Failed to send: ' + e.message),
  });

  // Keep the thread scrolled to the latest message while open.
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [comments.length, open]);

  const handleSend = () => {
    const message = text.trim();
    if (!message || sendMutation.isPending) return;
    sendMutation.mutate(message);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const fmtTime = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    } catch (_) {
      return '';
    }
  };

  if (!photographyTaskId) return null;

  return (
    <div className="space-y-2">
      {/* Header / toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5" style={{ color: GOLD }} />
          <p className="text-xs font-semibold" style={{ color: GOLD }}>Photographer Chat</p>
          {comments.length > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
              style={{ background: 'hsl(38 92% 50% / 0.15)', color: GOLD, border: '1px solid hsl(38 92% 50% / 0.3)' }}
            >
              {comments.length}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="space-y-2 animate-in fade-in duration-200">
          {/* Thread */}
          <div
            className="max-h-64 overflow-y-auto rounded-xl p-2.5 space-y-2"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            {isLoading ? (
              <p className="text-[11px] text-muted-foreground text-center py-3">Loading chat…</p>
            ) : comments.length === 0 ? (
              <p className="text-[11px] text-muted-foreground text-center py-3">
                No messages yet — coordinate the shoot and drop the 3D tour / media links here.
              </p>
            ) : (
              comments.map((c) => {
                const isPhotographer = c.author_role === 'photographer';
                return (
                  <div key={c.id} className={`flex ${isPhotographer ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className="max-w-[85%] rounded-xl px-3 py-2"
                      style={
                        isPhotographer
                          ? { background: 'hsl(38 92% 50% / 0.12)', border: '1px solid hsl(38 92% 50% / 0.25)' }
                          : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }
                      }
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {isPhotographer && <Camera className="w-3 h-3" style={{ color: GOLD }} />}
                        <span className="text-[10px] font-semibold" style={{ color: isPhotographer ? GOLD : 'rgba(255,255,255,0.7)' }}>
                          {(c.author_email || '').split('@')[0]}
                        </span>
                        <span className="text-[9px] text-muted-foreground">{fmtTime(c.created_at || c.created_date)}</span>
                      </div>
                      <div className="text-xs" style={{ color: 'rgba(255,255,255,0.9)' }}>
                        <MessageBody text={c.message} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Composer — shared writing toolkit */}
          <ModernComposerField
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onSend={handleSend}
            sending={sendMutation.isPending}
            placeholder="Message the other side… paste 3D tour / media links here"
            channel="notes"
            accent={GOLD}
            minHeight={36}
          />
        </div>
      )}
    </div>
  );
}
