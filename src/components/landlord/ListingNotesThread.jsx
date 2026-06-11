import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageSquare, Send, Loader2, ChevronDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function ListingNotesThread({ landlordProperty, landlordPropertyId, onRefetch }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const bottomRef = useRef(null);

  const comments = landlordProperty?.listing_comments || [];

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, comments.length]);

  const handlePost = async () => {
    const text = body.trim();
    if (!text || !landlordPropertyId) return;
    setPosting(true);
    try {
      const user = await base44.auth.me();
      const newEntry = {
        author_email: user?.email || '',
        author_name: user?.full_name || user?.email || 'Unknown',
        body: text,
        created_at: new Date().toISOString(),
      };
      const updated = [...comments, newEntry];
      await base44.entities.LandlordProperty.update(landlordPropertyId, {
        listing_comments: updated,
      });
      setBody('');
      onRefetch?.();
    } catch (err) {
      toast.error('Failed to post: ' + err.message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="pt-2 border-t border-white/10">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-white/70 transition py-1"
      >
        <span className="flex items-center gap-1.5">
          <MessageSquare className="w-3 h-3" />
          Notes &amp; Messages
          {comments.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: 'rgba(245,158,11,0.18)', color: 'hsl(38 92% 60%)' }}>
              {comments.length}
            </span>
          )}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {/* No property linked */}
          {!landlordPropertyId ? (
            <div className="py-4 text-center rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <p className="text-[10px] text-muted-foreground italic">No unit linked yet — notes will be available once a property record is created.</p>
            </div>
          ) : (
            <>
              {/* Thread scroll area */}
              {comments.length === 0 ? (
                <div className="py-5 text-center rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
                  <MessageSquare className="w-4 h-4 text-muted-foreground mx-auto mb-1 opacity-40" />
                  <p className="text-[10px] text-muted-foreground italic">No messages yet. Start the thread below.</p>
                </div>
              ) : (
                <div className="overflow-y-auto space-y-2 pr-1" style={{ maxHeight: '220px' }}>
                  {comments.map((c, i) => (
                    <div key={i} className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span className="text-[10px] font-semibold leading-none truncate" style={{ color: 'hsl(38 92% 60%)' }}>
                          {c.author_name || c.author_email || 'Unknown'}
                        </span>
                        <span className="text-[9px] text-muted-foreground shrink-0 leading-none">
                          {c.created_at ? formatDistanceToNow(new Date(c.created_at), { addSuffix: true }) : ''}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/85 leading-relaxed break-words">{c.body}</p>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}

              {/* Composer */}
              <div className="space-y-1.5">
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && e.metaKey && handlePost()}
                  placeholder="Write a note… (⌘↵ to send)"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-[11px] outline-none resize-none leading-relaxed"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.9)',
                  }}
                />
                <button
                  onClick={handlePost}
                  disabled={posting || !body.trim()}
                  className="w-full h-8 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-medium transition disabled:opacity-30"
                  style={{ background: 'hsl(38 92% 50% / 0.18)', border: '1px solid hsl(38 92% 50% / 0.35)', color: 'hsl(38 92% 60%)' }}
                >
                  {posting
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Posting…</>
                    : <><Send className="w-3 h-3" /> Send</>
                  }
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}