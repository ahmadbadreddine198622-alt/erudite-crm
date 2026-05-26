import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import VoiceMessageBubble from './VoiceMessageBubble';

export default function ChatThread({ conversationId }) {
  const bottomRef = useRef(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['wa_messages', conversationId],
    queryFn: () => base44.entities.WhatsAppMessage.filter({ conversation_id: conversationId }, 'timestamp', 100),
    enabled: !!conversationId,
    refetchInterval: 8000,
  });

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

  // Group messages by date
  const grouped = messages.reduce((acc, msg) => {
    const day = format(new Date(msg.timestamp), 'dd MMM yyyy');
    if (!acc[day]) acc[day] = [];
    acc[day].push(msg);
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-[#ECE5DD]">
      {Object.entries(grouped).map(([day, msgs]) => (
        <div key={day}>
          <div className="flex justify-center my-3">
            <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{day}</span>
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
  
  // Handle voice messages
  if (msg.media_type === 'audio' && msg.transcription) {
    return (
      <div className={cn('flex mb-3', isOutbound ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[72%]">
          <VoiceMessageBubble message={msg} />
          <div className={cn('text-[10px] mt-1 text-gray-400', isOutbound ? 'text-right' : 'text-left')}>
            {format(new Date(msg.timestamp), 'HH:mm')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex mb-1', isOutbound ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[72%] rounded-xl px-3 py-2 text-sm shadow-sm',
        isOutbound
          ? 'bg-[#00A884] text-white rounded-br-none'
          : 'bg-white text-gray-800 rounded-bl-none border border-gray-100',
      )}>
        <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
        <div className={cn('text-[10px] mt-0.5', isOutbound ? 'text-right text-white/70' : 'text-left text-gray-400')}>
          {format(new Date(msg.timestamp), 'HH:mm')}
          {isOutbound && (
            <span className="ml-1">{msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}</span>
          )}
        </div>
      </div>
    </div>
  );
}