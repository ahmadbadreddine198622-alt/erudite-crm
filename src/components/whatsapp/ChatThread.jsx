import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import VoiceMessageBubble from './VoiceMessageBubble';

export default function ChatThread({ conversationId, allConversationIds }) {
  const bottomRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // All IDs to load messages for (handles merged/duplicate conversations)
  const ids = allConversationIds?.length ? allConversationIds : (conversationId ? [conversationId] : []);

  // Load messages from all conversation IDs
  const loadMessages = async () => {
    if (!ids.length) return;
    try {
      const results = await Promise.all(
        ids.map(id => base44.entities.WhatsAppMessage.filter({ conversation_id: id }, 'timestamp', 200))
      );
      const all = results.flat();
      // Dedupe by id, sort by timestamp ascending
      const seen = new Set();
      const deduped = all.filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      deduped.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setMessages(deduped);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!conversationId) return;
    setIsLoading(true);
    setMessages([]);
    loadMessages();
  }, [conversationId, JSON.stringify(allConversationIds)]);

  // Real-time subscription
  useEffect(() => {
    if (!conversationId) return;
    const unsub = base44.entities.WhatsAppMessage.subscribe((event) => {
      if (event.data?.conversation_id === conversationId) {
        if (event.type === 'create') {
          setMessages(prev => {
            // Dedupe by id
            if (prev.some(m => m.id === event.data.id)) return prev;
            return [...prev, event.data].sort((a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          });
        } else if (event.type === 'update') {
          setMessages(prev => prev.map(m => m.id === event.data.id ? event.data : m));
        }
      }
    });
    return () => unsub();
  }, [conversationId]);

  // Also poll every 6s as fallback
  useEffect(() => {
    if (!conversationId) return;
    const interval = setInterval(loadMessages, 6000);
    return () => clearInterval(interval);
  }, [conversationId, JSON.stringify(allConversationIds)]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!messages.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
        No messages yet
      </div>
    );
  }

  // Group by date
  const grouped = messages.reduce((acc, msg) => {
    if (!msg.timestamp) return acc;
    const day = format(new Date(msg.timestamp), 'dd MMM yyyy');
    if (!acc[day]) acc[day] = [];
    acc[day].push(msg);
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(30,41,59,0.8) 0%, rgba(8,11,18,0.95) 100%)' }}>
      {Object.entries(grouped).map(([day, msgs]) => (
        <div key={day}>
          <div className="flex justify-center my-3">
            <span className="text-[10px] font-medium px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}>{day}</span>
          </div>
          {msgs.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function MessageBubble({ msg }) {
  const isOutbound = msg.direction === 'outbound';

  if (msg.media_type === 'audio' && msg.transcription) {
    return (
      <div className={cn('flex mb-3', isOutbound ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[72%]">
          <VoiceMessageBubble message={msg} />
          <div className={cn('text-[10px] mt-1 text-gray-400', isOutbound ? 'text-right' : 'text-left')}>
            {msg.timestamp ? format(new Date(msg.timestamp), 'HH:mm') : ''}
          </div>
        </div>
      </div>
    );
  }

  const displayBody = msg.body || (msg.media_type && msg.media_type !== 'none' ? `[${msg.media_type}]` : '');

  return (
    <div className={cn('flex mb-1', isOutbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn('max-w-[72%] rounded-2xl px-3.5 py-2.5 text-sm shadow-md backdrop-blur-xl', isOutbound ? 'rounded-br-none' : 'rounded-bl-none')}
        style={{
          background: isOutbound ? 'rgba(245,159,10,0.15)' : 'rgba(255,255,255,0.08)',
          border: isOutbound ? '1px solid rgba(245,159,10,0.3)' : '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <p className="leading-relaxed whitespace-pre-wrap" style={{ color: isOutbound ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.9)' }}>
          {displayBody}
        </p>
        <div className={cn('text-[9px] mt-1 font-medium flex items-center gap-1', isOutbound ? 'justify-end' : 'justify-start')} style={{ color: 'rgba(255,255,255,0.45)' }}>
          {msg.timestamp ? format(new Date(msg.timestamp), 'HH:mm') : ''}
          {isOutbound && (
            <span>{msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}</span>
          )}
        </div>
      </div>
    </div>
  );
}