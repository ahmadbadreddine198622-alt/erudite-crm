import React, { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Building2, User, Play, Pause, FileText, MapPin, Download, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import VoiceMessageBubble from './VoiceMessageBubble';

export default function ChatThread({ conversationId, allConversationIds, contactName, optimisticMessage, conversationChannel }) {
  const bottomRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [showNewPill, setShowNewPill] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState(null);
  const prevMessageCountRef = useRef(0);

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
      const results = await Promise.all(
        ids.map(async id => {
          try {
            const res = await base44.entities.WhatsAppMessage.filter({ conversation_id: id }, '-timestamp', 500);
            return Array.isArray(res) ? res : [];
          } catch (err) {
            return [];
          }
        })
      );
      const all = results.flat();
      
      const seen = new Set();
      const deduped = all.filter(m => {
        if (!m || !m.id) return false;
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      
      deduped.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      setMessages(deduped);
      setLastRefresh(new Date());
    } catch (err) {
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

  // NOTE: Realtime subscriptions are not functional on this Base44 plan.
  // This code is retained as a placeholder and can be re-enabled if the plan gains support.
  // Currently, all message updates arrive via polling only (see interval below).
  // const unsub = base44.entities.WhatsAppMessage.subscribe((event) => {
  //   const ids = idsRef.current;
  //   const msgConvId = event.data?.conversation_id;
  //   if (Array.isArray(ids) && msgConvId && ids.includes(msgConvId)) {
  //     setTimeout(() => loadMessages(), 500);
  //   }
  // });
  // return () => unsub();

  // NOTE: Base44 realtime is unavailable on this plan (no live socket), so the
  // WhatsAppMessage.subscribe() that used to be here never fired — removed it.
  // Realtime can be re-added here if the plan gains support. Open-thread freshness
  // comes from this 2s poll, paused when the tab is hidden (no background load).
  useEffect(() => {
    if (!validConversationId) return;
    const interval = setInterval(() => {
      if (!document.hidden) loadMessages();
    }, 2000);
    return () => clearInterval(interval);
  }, [idsKey]);

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
        <Loader2 className="w-5 h-5 animate-spin text-white/40" />
      </div>
    );
  }

  if (!messages.length && !optimisticMessage) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-white/40">
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
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#C9A24B] animate-pulse" />
          <span className="text-[9px] font-semibold uppercase tracking-wider text-white/50">Live</span>
          {lastRefresh && (
            <span className="text-[9px] text-white/40">
              · Synced {format(lastRefresh, 'HH:mm')}
            </span>
          )}
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-2 relative" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(30,41,59,0.8) 0%, rgba(8,11,18,0.95) 100%)' }}>
        {Object.entries(grouped).map(([day, msgs]) => (
          <div key={day}>
            <div className="flex justify-center my-3">
              <span className="text-[10px] font-medium px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white/70">{day}</span>
            </div>
            {msgs.map(msg => (
              <MessageBubble 
                key={msg.id} 
                msg={msg} 
                contactName={contactName}
                onImageClick={setEnlargedImage}
                conversationChannel={conversationChannel}
              />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {showNewPill && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg z-10 transition-all bg-[#C9A24B] text-[#0F1419]"
        >
          <ChevronDown className="w-3.5 h-3.5" /> New message
        </button>
      )}

      {enlargedImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setEnlargedImage(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white">
            <X className="w-6 h-6" />
          </button>
          <img src={enlargedImage} alt="Enlarged" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg, contactName, onImageClick, conversationChannel }) {
  const isOutbound = msg.direction === 'outbound';
  const isInbound = msg.direction === 'inbound';
  // For outbound messages, use the conversation's channel (more reliable than per-message field)
  const channel = isOutbound ? (conversationChannel || msg.channel || 'personal') : (msg.channel || 'personal');
  const ChannelIcon = channel === 'business' ? Building2 : User;

  // Deleted message
  if (msg.is_deleted) {
    return (
      <div className={cn('flex mb-2', isOutbound ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[65%]">
          <div
            className="rounded-xl px-4 py-3 italic"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="text-sm text-white/40">This message was deleted</p>
          </div>
        </div>
      </div>
    );
  }

  // Voice note
  if (msg.media_type === 'audio' || msg.is_voice_note) {
    return (
      <div className={cn('flex mb-2', isOutbound ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[72%]">
          {!isOutbound && contactName && (
            <p className="text-[10px] font-semibold mb-0.5 px-1 text-white/70">{contactName}</p>
          )}
          <VoiceMessageBubble message={msg} isOutbound={isOutbound} />
          <MessageFooter msg={msg} isOutbound={isOutbound} ChannelIcon={ChannelIcon} channel={channel} />
        </div>
      </div>
    );
  }

  // Image
  if (msg.media_type === 'image' && msg.media_url) {
    return (
      <div className={cn('flex mb-2', isOutbound ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[72%]">
          <div
            className={cn('rounded-xl overflow-hidden', isOutbound ? 'bg-[#243044]' : 'bg-[#1A2230]')}
            style={{ border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {msg.caption && <p className="px-3 pt-2.5 pb-2 text-sm text-white/90">{msg.caption}</p>}
            <img
              src={msg.media_url}
              alt={msg.caption || 'Image'}
              className="w-full max-w-sm cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => onImageClick?.(msg.media_url)}
            />
          </div>
          <MessageFooter msg={msg} isOutbound={isOutbound} ChannelIcon={ChannelIcon} channel={channel} />
        </div>
      </div>
    );
  }

  // Video
  if (msg.media_type === 'video' && msg.media_url) {
    return (
      <div className={cn('flex mb-2', isOutbound ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[72%]">
          <div
            className={cn('rounded-xl overflow-hidden relative', isOutbound ? 'bg-[#243044]' : 'bg-[#1A2230]')}
            style={{ border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {msg.caption && <p className="px-3 pt-2.5 pb-2 text-sm text-white/90">{msg.caption}</p>}
            <div className="relative">
              <video src={msg.media_url} className="w-full max-w-sm" controls />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-[#C9A24B]/80 flex items-center justify-center">
                  <Play className="w-6 h-6 text-[#0F1419] ml-0.5" />
                </div>
              </div>
            </div>
          </div>
          <MessageFooter msg={msg} isOutbound={isOutbound} ChannelIcon={ChannelIcon} channel={channel} />
        </div>
      </div>
    );
  }

  // Document
  if (msg.media_type === 'document' && msg.media_url) {
    return (
      <div className={cn('flex mb-2', isOutbound ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[72%]">
          <div
            className={cn('rounded-xl p-3', isOutbound ? 'bg-[#243044]' : 'bg-[#1A2230]')}
            style={{ border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#C9A24B]/20 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-[#C9A24B]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/90 truncate">{msg.media_filename || 'Document'}</p>
                <p className="text-xs text-white/50">{msg.media_mime || 'Unknown'}</p>
              </div>
              <a
                href={msg.media_url}
                download={msg.media_filename}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <Download className="w-4 h-4 text-white/70" />
              </a>
            </div>
          </div>
          <MessageFooter msg={msg} isOutbound={isOutbound} ChannelIcon={ChannelIcon} channel={channel} />
        </div>
      </div>
    );
  }

  // Location
  if (msg.location_json) {
    const location = typeof msg.location_json === 'string' ? JSON.parse(msg.location_json) : msg.location_json;
    return (
      <div className={cn('flex mb-2', isOutbound ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[72%]">
          <div
            className={cn('rounded-xl p-3', isOutbound ? 'bg-[#243044]' : 'bg-[#1A2230]')}
            style={{ border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#C9A24B]/20 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-[#C9A24B]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white/90">{location.name || 'Location'}</p>
                <p className="text-xs text-white/50 mt-0.5">
                  {location.lat?.toFixed(4)}, {location.lng?.toFixed(4)}
                </p>
              </div>
            </div>
          </div>
          <MessageFooter msg={msg} isOutbound={isOutbound} ChannelIcon={ChannelIcon} channel={channel} />
        </div>
      </div>
    );
  }

  // Regular text message
  return (
    <div className={cn('flex mb-2', isOutbound ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[65%]', 'break-words')}>
        {!isOutbound && contactName && (
          <p className="text-[10px] font-semibold mb-0.5 px-1 text-white/70">{contactName}</p>
        )}
        <div
          className={cn('rounded-2xl px-4 py-2.5 text-sm shadow-md', isOutbound ? 'rounded-br-none bg-[#243044]' : 'rounded-bl-none bg-[#1A2230]')}
          style={{
            border: isOutbound ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.12)',
            borderLeft: !isOutbound ? `3px solid ${channel === 'business' ? 'hsl(152 69% 40%)' : 'hsl(217 91% 60%)'}` : 'none',
          }}
        >
          <p className="leading-relaxed text-white/95" style={{ fontSize: '15px', lineHeight: '1.5' }}>
            {msg.body}
          </p>
          <MessageFooter msg={msg} isOutbound={isOutbound} ChannelIcon={ChannelIcon} channel={channel} />
        </div>
      </div>
    </div>
  );
}

function MessageFooter({ msg, isOutbound, ChannelIcon, channel }) {
  const getStatusIcon = () => {
    if (msg.status === 'failed') return { icon: '⚠️', color: 'rgb(244,63,94)', title: 'Failed' };
    if (msg.status === 'read') return { icon: '✓✓', color: 'hsl(152 69% 40%)', title: 'Read' };
    if (msg.status === 'delivered') return { icon: '✓✓', color: 'rgba(255,255,255,0.5)', title: 'Delivered' };
    return { icon: '✓', color: 'rgba(255,255,255,0.5)', title: 'Sent' };
  };

  const statusIcon = getStatusIcon();

  return (
    <div className={cn('text-[9px] mt-1.5 font-medium flex items-center gap-1.5', isOutbound ? 'justify-end' : 'justify-start')} style={{ color: 'rgba(255,255,255,0.45)' }}>
      {msg.timestamp ? format(new Date(msg.timestamp), 'HH:mm') : ''}
      {isOutbound && (
        <>
          <span style={{ color: statusIcon.color }} title={statusIcon.title}>{statusIcon.icon}</span>
          {msg.status === 'failed' && (
            <button className="text-[9px] underline hover:text-red-400" title="Retry sending">Retry</button>
          )}
          <span className="flex items-center gap-0.5 opacity-70">
            <ChannelIcon className="w-2.5 h-2.5" />
            {msg.channel === 'business' ? 'Business' : 'Personal'}
          </span>
        </>
      )}
    </div>
  );
}