import React, { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, RefreshCw, ChevronDown, Building2, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import VoiceMessageBubble from './VoiceMessageBubble';

export default function ChatThread({ conversationId, allConversationIds, contactName, optimisticMessage }) {
  const bottomRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [showNewPill, setShowNewPill] = useState(false);
  const prevMessageCountRef = useRef(0);

  // CRITICAL: Normalize all inputs to arrays at the component boundary
  const normalizedAllIds = Array.isArray(allConversationIds) ? allConversationIds : [];
  const validConversationId = (typeof conversationId === 'string' && conversationId) ? conversationId : null;
  const idsToUse = normalizedAllIds.length > 0 ? normalizedAllIds : (validConversationId ? [validConversationId] : []);
  const finalIds = Array.isArray(idsToUse) ? idsToUse : [];
  
  const idsRef = useRef(finalIds);
  idsRef.current = finalIds;

  const loadMessages = async () => {
    const ids = idsRef.current;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      setMessages([]);
      setIsLoading(false);
      return;
    }
    try {
      // Load messages for all conversation IDs (including merged ones)
      const results = await Promise.all(
        ids.map(async id => {
          try {
            const res = await base44.entities.WhatsAppMessage.filter({ conversation_id: id }, '-timestamp', 500);
            return Array.isArray(res) ? res : [];
          } catch (err) {
            // Silent fail for rate limits
            if (err?.response?.status === 429) {
              console.log('Rate limited, skipping...');
            } else {
              console.warn('Failed to load messages for conversation', id, err);
            }
            return [];
          }
        })
      );
      const all = results.flat();
      if (all.length > 0) {
        console.log(`Loaded ${all.length} total messages for ${ids.length} conversation(s)`);
      }
      
      // Deduplicate by message ID
      const seen = new Set();
      const deduped = all.filter(m => {
        if (!m || !m.id) return false;
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      
      // Sort by timestamp (oldest first)
      deduped.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      console.log(`After dedup: ${deduped.length} messages, inbound: ${deduped.filter(m => m.direction === 'inbound').length}, outbound: ${deduped.filter(m => m.direction === 'outbound').length}`);
      
      setMessages(deduped);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to load messages:', err);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const idsKey = finalIds.slice().sort().join(',');

  useEffect(() => {
    if (!validConversationId && finalIds.length === 0) {
      setMessages([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setMessages([]);
    loadMessages();
  }, [idsKey]);

  // Real-time subscription to new messages
  useEffect(() => {
    const unsub = base44.entities.WhatsAppMessage.subscribe((event) => {
      // Only reload if this message belongs to the current conversation(s)
      const ids = idsRef.current;
      const msgConvId = event.data?.conversation_id;
      
      if (Array.isArray(ids) && msgConvId && ids.includes(msgConvId)) {
        // Debounce rapid updates
        setTimeout(() => {
          console.log('New message detected, reloading thread...');
          loadMessages();
        }, 500);
      }
    });
    
    return () => unsub();
  }, []);

  // Polling — 5s, foreground only
  useEffect(() => {
    if (!validConversationId) return;
    const interval = setInterval(() => {
      if (!document.hidden) loadMessages();
    }, 5000);
    return () => clearInterval(interval);
  }, [idsKey]);

  // Smart scroll: only auto-scroll if near bottom; otherwise show pill
  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
    setShowNewPill(false);
  }, []);

  useEffect(() => {
    if (messages.length === 0 && !optimisticMessage) return;
    const newMessages = messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;
    if (!newMessages && !optimisticMessage) return;
    if (isNearBottom()) {
      scrollToBottom('auto');
    } else {
      setShowNewPill(true);
    }
  }, [messages.length, optimisticMessage]);

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

  if (!messages.length && !optimisticMessage) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
        No messages yet
      </div>
    );
  }

  const allMessages = optimisticMessage ? [...messages, optimisticMessage] : messages;
  const grouped = allMessages.reduce((acc, msg) => {
    if (!msg.timestamp) return acc;
    const day = format(new Date(msg.timestamp), 'dd MMM yyyy');
    if (!acc[day]) acc[day] = [];
    acc[day].push(msg);
    return acc;
  }, {});

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
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

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-2 relative" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(30,41,59,0.8) 0%, rgba(8,11,18,0.95) 100%)' }}>
        {Object.entries(grouped).map(([day, msgs]) => (
          <div key={day}>
            <div className="flex justify-center my-3">
              <span className="text-[10px] font-medium px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}>{day}</span>
            </div>
            {msgs.map(msg => (
              <MessageBubble key={msg.id} msg={msg} contactName={contactName} />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {showNewPill && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg z-10 transition-all"
          style={{ background: 'hsl(38 92% 50%)', color: 'hsl(222 47% 11%)' }}
        >
          <ChevronDown className="w-3.5 h-3.5" /> New message
        </button>
      )}
    </div>
  );
}

function MessageBubble({ msg, contactName }) {
  const isOutbound = msg.direction === 'outbound' || msg.direction === 'outgoing';
  const isPending = msg.status === 'pending';
  const channel = msg.channel || 'personal';
  const channelColor = channel === 'business' ? 'hsl(152 69% 40%)' : 'hsl(217 91% 60%)';
  const ChannelIcon = channel === 'business' ? Building2 : User;

  if (msg.media_type === 'audio' && msg.transcription) {
    return (
      <div className={cn('flex mb-3', isOutbound ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[72%]">
          {!isOutbound && contactName && (
            <p className="text-[10px] font-semibold mb-0.5 px-1" style={{ color: 'rgba(245,159,10,0.85)' }}>{contactName}</p>
          )}
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
      <div className="max-w-[72%]">
        {!isOutbound && contactName && (
          <p className="text-[10px] font-semibold mb-0.5 px-1" style={{ color: 'rgba(245,159,10,0.85)' }}>{contactName}</p>
        )}
        <div
          className={cn('rounded-2xl px-3.5 py-2.5 text-sm shadow-md backdrop-blur-xl', isOutbound ? 'rounded-br-none' : 'rounded-bl-none')}
          style={{
            background: isOutbound ? 'rgba(245,159,10,0.15)' : 'rgba(255,255,255,0.08)',
            border: isOutbound ? '1px solid rgba(245,159,10,0.3)' : '1px solid rgba(255,255,255,0.12)',
            borderLeft: !isOutbound ? `3px solid ${channelColor}` : 'none',
          }}
        >
          <p className="leading-relaxed whitespace-pre-wrap" style={{ color: isOutbound ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.9)' }}>
            {displayBody}
          </p>
          <div className={cn('text-[9px] mt-1 font-medium flex items-center gap-1', isOutbound ? 'justify-end' : 'justify-start')} style={{ color: isPending ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.45)' }}>
            {msg.timestamp ? format(new Date(msg.timestamp), 'HH:mm') : ''}
            {isOutbound && (
              <>
                <span>{isPending ? '⏱' : msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}</span>
                <span className="flex items-center gap-0.5 opacity-70">
                  <ChannelIcon className="w-2.5 h-2.5" />
                  {channel === 'business' ? 'B' : 'P'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}