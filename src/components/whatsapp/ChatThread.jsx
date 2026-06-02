import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import VoiceMessageBubble from './VoiceMessageBubble';

export default function ChatThread({ conversationId, allConversationIds }) {
  const bottomRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // All IDs to load — use ref so loadMessages always sees current value
  const idsRef = useRef([]);
  idsRef.current = allConversationIds?.length ? allConversationIds : (conversationId ? [conversationId] : []);

  const loadMessages = async () => {
    const ids = idsRef.current;
    if (!ids.length) return;
    try {
      // Query messages directly by conversation_id — avoids the 500-message global limit issue
      const results = await Promise.all(
        ids.map(id => base44.entities.WhatsAppMessage.filter({ conversation_id: id }, '-timestamp', 200))
      );
      const all = results.flat();
      const seen = new Set();
      const deduped = all.filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      deduped.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setMessages(deduped);
      setLastRefresh(new Date());
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

  // Real-time subscription — reload immediately on any new message for this conversation
  useEffect(() => {
    if (!conversationId) return;
    const unsub = base44.entities.WhatsAppMessage.subscribe(async (event) => {
      const ids = idsRef.current;
      const msgConvId = event.data?.conversation_id;
      if (msgConvId && ids.includes(msgConvId)) {
        // Small delay to ensure webhook has finished saving
        setTimeout(() => loadMessages(), 300);
      }
    });
    return () => unsub();
  }, [conversationId]);

  // Poll every 2s as fallback to catch inbound replies quickly
  useEffect(() => {
    if (!conversationId) return;
    const interval = setInterval(loadMessages, 2000);
    return () => clearInterval(interval);
  }, [conversationId]);

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

  const handleManualRefresh = () => {
    setIsLoading(true);
    loadMessages();
  };

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
    <div className="flex-1 flex flex-col min-h-0">
      {/* Refresh bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Updated {format(lastRefresh, 'HH:mm:ss')}
            </span>
          )}
        </div>
        <button
          onClick={handleManualRefresh}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Messages */}
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