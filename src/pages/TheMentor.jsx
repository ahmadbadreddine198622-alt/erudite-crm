import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Loader2, Send, Sparkles } from 'lucide-react';
import AcademyNav from '@/components/academy/AcademyNav';
import { GOLD, GOLD_LITE, pageWrap, card, serif, label, goldBtn, input } from '@/lib/academyStyles';
import { toast } from 'sonner';

const KIND_BADGES = {
  proactive_directive: { label: 'Directive', bg: 'rgba(212,175,55,0.15)', border: 'rgba(212,175,55,0.3)', color: GOLD_LITE },
  weekly_review: { label: 'Weekly Review', bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.3)', color: '#c4b5fd' },
};

function MessageBubble({ msg }) {
  const isMentor = msg.role === 'mentor';
  const badge = msg.message_kind && KIND_BADGES[msg.message_kind];
  return (
    <div style={{ display: 'flex', justifyContent: isMentor ? 'flex-start' : 'flex-end' }}>
      <div style={{
        maxWidth: '78%',
        padding: '12px 16px',
        borderRadius: isMentor ? '14px 14px 14px 4px' : '14px 14px 4px 14px',
        background: isMentor ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.06)',
        border: isMentor ? '1px solid rgba(212,175,55,0.22)' : '1px solid rgba(255,255,255,0.1)',
        ...(isMentor ? { boxShadow: '0 0 24px rgba(212,175,55,0.06)' } : {}),
      }}>
        {isMentor && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Sparkles size={11} style={{ color: GOLD }} />
            <span style={{ ...label, color: GOLD, fontSize: 9 }}>THE MENTOR</span>
            {badge && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
                background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color,
              }}>{badge.label}</span>
            )}
          </div>
        )}
        {!isMentor && badge && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
              background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color,
            }}>{badge.label}</span>
          </div>
        )}
        <p style={{
          margin: 0, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
          color: isMentor ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.78)',
        }}>{msg.message}</p>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{
        padding: '12px 18px', borderRadius: '14px 14px 14px 4px',
        background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.22)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Sparkles size={13} style={{ color: GOLD }} />
        <span style={{ fontSize: 12, color: GOLD_LITE, fontStyle: 'italic' }}>The Mentor is thinking…</span>
        <Loader2 size={13} className="animate-spin" style={{ color: GOLD, marginLeft: 2 }} />
      </div>
    </div>
  );
}

export default function TheMentor() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['academy-mentor-messages', user?.email],
    queryFn: () => base44.entities.MentorMessage.filter({ user_email: user?.email }, 'created_date', 200),
    enabled: !!user?.email,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, sending]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !user?.email || sending) return;
    const today = new Date().toISOString().split('T')[0];
    const sessionId = `${user.email}-${today}`;

    setText('');
    setSending(true);

    try {
      await base44.functions.invoke('mentorOrchestrator', {
        user_email: user.email,
        message: trimmed,
        session_id: sessionId,
      });
      // Refresh the feed — mentorOrchestrator persists both messages
      await qc.invalidateQueries({ queryKey: ['academy-mentor-messages', user.email] });
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to reach the mentor');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={pageWrap}>
      <AcademyNav />
      <p style={{ ...label, color: GOLD }}>where we are guided</p>
      <h1 style={{ ...serif, fontSize: 26, color: GOLD_LITE, margin: '2px 0 6px' }}>THE MENTOR</h1>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 18, fontStyle: 'italic' }}>
        The living voice of the 17 principles — grounded in your doctrine, your pipeline, and your training week.
      </p>

      {/* Message feed */}
      <div ref={scrollRef} style={{
        ...card, padding: 16, maxHeight: '52vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
            <Loader2 className="animate-spin" style={{ color: GOLD }} size={24} />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 28 }}>
            <Sparkles size={26} style={{ color: GOLD, opacity: 0.5 }} />
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 10 }}>Your conversation with the mentor begins here.</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Ask about a principle, a stuck deal, or a fear you're sitting on.</p>
          </div>
        ) : (
          messages.map((m, i) => <MessageBubble key={m.id || i} msg={m} />)
        )}
        {sending && <TypingIndicator />}
      </div>

      {/* Chat input */}
      <div style={{ ...card, marginTop: 14, padding: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            disabled={sending}
            placeholder="Speak to your mentor…"
            style={{ ...input, resize: 'none', lineHeight: 1.5, flex: 1 }}
          />
          <button onClick={handleSend} disabled={sending || !text.trim()} style={goldBtn}>
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send
          </button>
        </div>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 8, textAlign: 'right' }}>
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}