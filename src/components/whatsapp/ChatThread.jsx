import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';

export default function ChatThread({ conversationId, allConversationIds }) {
  const bottomRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  // CRITICAL: Normalize all inputs to arrays at the component boundary
  // This prevents "number is not iterable" errors
  const normalizedAllIds = Array.isArray(allConversationIds) ? allConversationIds : [];
  const validConversationId = (typeof conversationId === 'string' && conversationId) ? conversationId : null;
  const idsToUse = normalizedAllIds.length > 0 ? normalizedAllIds : (validConversationId ? [validConversationId] : []);
  const finalIds = Array.isArray(idsToUse) ? idsToUse : [];
  
  // Store in ref for subscription access
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
          const res = await base44.entities.WhatsAppMessage.filter({ conversation_id: id }, '-timestamp', 200);
          return Array.isArray(res) ? res : [];
        })
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
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!validConversationId && finalIds.length === 0) {
      setMessages([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setMessages([]);
    loadMessages();
  }, [validConversationId, finalIds.length]);

  // Real-time subscription — reload immediately on any new message for this conversation
  useEffect(() => {
    const unsub = base44.entities.WhatsAppMessage.subscribe(async (event) => {
      const ids = idsRef.current;
      const msgConvId = event.data?.conversation_id;
      if (Array.isArray(ids) && msgConvId && ids.includes(msgConvId)) {
        setTimeout(() => loadMessages(), 300);
      }
    });
    return () => unsub();
  }, []);

  // Poll every 2s as fallback to catch inbound replies quickly
  useEffect(() => {
    const interval = setInterval(loadMessages, 2000);
    return () => clearInterval(interval);
  }, []);

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

  // Minimal message view - just show count and status
  const unreadCount = messages.filter(m => m.status !== 'read').length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Compact message info bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
        <div className="flex items-center gap-3 text-xs">
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{messages.length} messages</span>
          {unreadCount > 0 && (
            <span style={{ color: 'hsl(38 92% 50%)' }} className="font-semibold">{unreadCount} unread</span>
          )}
        </div>
      </div>

      {/* Minimal message area - just empty space */}
      <div className="flex-1" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(30,41,59,0.8) 0%, rgba(8,11,18,0.95) 100%)' }}>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}