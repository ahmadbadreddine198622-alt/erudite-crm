import React from 'react';
import { MessageCircle } from 'lucide-react';

function formatDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({ msg }) {
  const isIncoming = msg.direction === 'incoming';
  return (
    <div className={`flex ${isIncoming ? 'justify-start' : 'justify-end'} mb-3`}>
      <div
        className="max-w-[75%] rounded-2xl px-3 py-2"
        style={{
          background: isIncoming ? 'rgba(255,255,255,0.06)' : 'rgba(139,92,246,0.2)',
          border: isIncoming ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(139,92,246,0.3)',
        }}
      >
        {msg.text && <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>{msg.text}</p>}
        {msg.media_url && msg.media_type !== 'none' && (
          <div className="mt-2 rounded-lg overflow-hidden">
            {msg.media_type === 'image' && <img src={msg.media_url} alt="attachment" className="max-w-full h-auto" />}
            {msg.media_type === 'video' && <video src={msg.media_url} controls className="max-w-full" />}
            {msg.media_type === 'audio' && <audio src={msg.media_url} controls className="w-full" />}
          </div>
        )}
        <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{formatDateTime(msg.timestamp)}</p>
      </div>
    </div>
  );
}

export function MessagesTab({ messages }) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-10">
        <MessageCircle className="w-8 h-8 mx-auto mb-3 opacity-30" />
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No messages yet</p>
      </div>
    );
  }
  return <div>{messages.map((m, i) => <MessageBubble key={i} msg={m} />)}</div>;
}