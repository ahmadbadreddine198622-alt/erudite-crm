import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MessageCircle, Phone, Mail, Calendar, FileText, Mic, Play, Pause, Image as ImageIcon, Loader2, Edit3, CheckCircle2, Clock, User } from 'lucide-react';
import { format } from 'date-fns';

const fmt = (ts) => {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return format(d, 'd MMM, HH:mm');
  } catch { return ''; }
};

function MessageBubble({ msg, channel }) {
  const [playing, setPlaying] = useState(false);
  const out = msg.direction === 'outbound';
  
  const isVoice = msg.media_type === 'audio' || msg.transcription;
  
  return (
    <div className={`flex ${out ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${out ? 'bg-emerald-600/90 text-white rounded-br-sm' : 'bg-white/10 rounded-bl-sm'}`}>
        {/* Channel badge */}
        <div className="flex items-center gap-1 mb-1">
          {channel === 'business' && <span className="text-[9px] opacity-70">🏢 Business</span>}
          {channel === 'personal' && <span className="text-[9px] opacity-70">👤 Personal</span>}
          {channel === 'malik' && <span className="text-[9px] opacity-70">👤 Malik</span>}
          <span className="text-[9px] opacity-50">· {fmt(msg.timestamp)}</span>
        </div>
        
        {/* Voice note */}
        {isVoice ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Mic className="w-4 h-4" />
              </div>
              <span className="text-xs">Voice message</span>
            </div>
            {msg.transcription && (
              <div className="mt-2 px-2 py-1.5 rounded bg-black/20">
                <p className="text-xs italic">{msg.transcription}</p>
                {msg.translations?.en && msg.translations.en !== msg.transcription && (
                  <p className="text-[10px] mt-1 pt-1 border-t border-white/10" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    🇬🇧 {msg.translations.en}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Text message */
          <div className="whitespace-pre-wrap break-words text-sm">{msg.body}</div>
        )}
        
        {/* Status */}
        {out && (
          <div className="mt-1 text-[10px] flex items-center gap-1 opacity-70 justify-end">
            {msg.status === 'read' && <CheckCircle2 className="w-3 h-3" />}
            {msg.status === 'delivered' && <CheckCircle2 className="w-3 h-3" />}
            {msg.status === 'sent' && <Clock className="w-3 h-3" />}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityItem({ activity }) {
  const iconMap = {
    call: { icon: Phone, color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
    note: { icon: Edit3, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
    follow_up: { icon: Clock, color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
    appointment: { icon: Calendar, color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
    stage_change: { icon: CheckCircle2, color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    email: { icon: Mail, color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' },
  };
  
  const cfg = iconMap[activity.activity_type] || iconMap.note;
  const Icon = cfg.icon;
  
  return (
    <div className="flex gap-2 mb-3">
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: cfg.bg }}>
        <Icon className="w-4 h-4" style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {activity.activity_type.replace(/_/g, ' ')}
          </span>
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{fmt(activity.created_at)}</span>
        </div>
        {activity.description && (
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>{activity.description}</p>
        )}
        {activity.notes && (
          <p className="text-[11px] mt-1 px-2 py-1.5 rounded bg-white/5 italic" style={{ color: 'rgba(255,255,255,0.6)' }}>{activity.notes}</p>
        )}
      </div>
    </div>
  );
}

function TimelineItem({ item }) {
  if (item._type === 'whatsapp') {
    return <MessageBubble msg={item} channel={item.channel} />;
  }
  return <ActivityItem activity={item} />;
}

export default function ConversationTimeline({ landlord }) {
  const [activityType, setActivityType] = useState('note');
  const [activityText, setActivityText] = useState('');
  
  // Fetch WhatsApp conversations for this landlord
  const { data: conversations = [] } = useQuery({
    queryKey: ['landlord-wa-conv', landlord?.id],
    queryFn: async () => {
      const phone = landlord?.phone ? '+' + landlord.phone.replace(/\D/g, '') : null;
      if (!phone) return [];
      const r = await base44.entities.WhatsAppConversation.filter({ wa_phone_e164: phone });
      return r || [];
    },
    enabled: !!landlord?.phone,
  });
  
  // Fetch messages from all conversations
  const { data: allMessages = [] } = useQuery({
    queryKey: ['landlord-wa-msgs-timeline', conversations.map(c => c.id)],
    queryFn: async () => {
      if (!conversations.length) return [];
      const msgs = await Promise.all(
        conversations.map(c => base44.entities.WhatsAppMessage.filter({ conversation_id: c.id }, 'timestamp', 100))
      );
      return msgs.flat().map(m => ({ ...m, _type: 'whatsapp' }));
    },
    enabled: conversations.length > 0,
  });
  
  // Fetch Activity records
  const { data: activities = [] } = useQuery({
    queryKey: ['landlord-activity', landlord?.id],
    queryFn: () => base44.entities.Activity.filter({ landlord_id: landlord.id }, '-created_at', 200),
    enabled: !!landlord?.id,
  });
  
  // Merge and sort chronologically (newest at bottom for chat-like feel, or newest top for timeline)
  const allItems = React.useMemo(() => {
    const items = [...(allMessages || []), ...(activities || [])];
    // Sort by timestamp: oldest first (newest at bottom, like chat)
    return items.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : new Date(a.created_at).getTime();
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : new Date(b.created_at).getTime();
      return ta - tb;
    });
  }, [allMessages, activities]);
  
  if (!allItems.length) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
          <MessageCircle className="w-8 h-8 opacity-40" />
        </div>
        <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>No conversations yet</p>
        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Messages and activities will appear here</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-1">
      {allItems.map((item, idx) => (
        <TimelineItem key={item.id || idx} item={item} />
      ))}
    </div>
  );
}