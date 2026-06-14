import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Star, Building2, User, Briefcase, Home, Pin } from 'lucide-react';
import WhatsAppPhone from '@/components/WhatsAppPhone';

const AVATAR_COLORS = ['bg-purple-500','bg-emerald-500','bg-orange-400','bg-red-500','bg-blue-500','bg-pink-500','bg-teal-500'];
const avatarColor = (str) => AVATAR_COLORS[(str || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

const sentimentDot = { 
  positive: 'bg-green-500', 
  neutral: 'bg-yellow-400', 
  negative: 'bg-red-500', 
  unknown: 'bg-gray-300' 
};

const priorityBorder = { 
  low: 'border-l-transparent', 
  medium: 'border-l-yellow-400', 
  high: 'border-l-orange-500', 
  urgent: 'border-l-red-500' 
};

const statusDot = {
  new: 'bg-blue-400',
  open: 'bg-green-500',
  pending_customer: 'bg-amber-400',
  pending_agent: 'bg-purple-500',
  snoozed: 'bg-gray-400',
  resolved: 'bg-gray-300',
  spam: 'bg-red-400',
  blocked: 'bg-red-600',
};

export default function ConversationItem({ conv, lead, landlord, selected, onClick, isInternal = false }) {
  const displayPhone = conv.wa_phone_e164 || conv.phone_number || '';
  
  // Internal test conversations - our own numbers
  if (isInternal) {
    const name = 'Internal Test';
    const initials = 'IT';
    const timeAgo = conv.last_message_at
      ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })
      : '';
    const channel = conv.channel || 'business';
    
    return (
      <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-2 py-1.5 transition-all duration-200 border-b',
        selected ? 'ring-1 ring-accent/40' : 'hover:shadow-md',
      )}
        style={{
          background: selected ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderColor: 'rgba(255,255,255,0.04)',
          borderLeft: selected ? '3px solid rgba(245,159,10,0.6)' : '3px solid transparent',
          opacity: 0.6
        }}
      >
        <div className="flex items-center gap-2">
          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 relative border-2', 'bg-gray-500')} style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1.5 mb-0.5">
              <span className="text-[12px] font-semibold truncate leading-tight" style={{ color: 'rgba(255,255,255,0.6)' }} title={name}>{name}</span>
              <span className="text-[9px] font-medium shrink-0" style={{ color: 'rgba(255,255,255,0.45)' }}>{timeAgo}</span>
            </div>
            <p className="text-[10px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{conv.last_message || '—'}</p>
          </div>
        </div>
      </button>
    );
  }
  
  // Priority: landlord/lead name > wa_saved_name (imported from phone) > wa_display_name (pushName) > phone
  const displayName = conv.wa_saved_name?.trim() || conv.wa_display_name?.trim() || displayPhone;
  const name = landlord?.full_name_en || lead?.full_name || displayName;
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';
  const timeAgo = conv.last_message_at
    ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })
    : '';
  const priority = conv.ai_priority || conv.ai_urgency;
  const sentiment = conv.ai_sentiment || 'unknown';
  // Prioritize lead's CRM tags first, then conversation tags — show ALL tags (wrap if needed)
  const allTags = [...(lead?.tags || []), ...(conv.manual_tags || []), ...(conv.ai_tags || [])];
  const channel = conv.channel || 'business';
  const entityType = landlord ? 'landlord' : lead ? 'lead' : null;
  const stage = landlord?.stage || lead?.stage;

  return (
    <button
    onClick={onClick}
    className={cn(
      'w-full text-left px-2 py-1.5 transition-all duration-200 border-b',
      selected ? 'ring-1 ring-accent/40' : 'hover:shadow-md',
    )}
    style={{
      background: selected ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderColor: 'rgba(255,255,255,0.04)',
      borderLeft: selected
        ? `3px solid ${channel === 'business' ? 'hsl(152 69% 40%)' : 'hsl(217 91% 60%)'}`
        : `3px solid ${channel === 'business' ? 'rgba(52,211,153,0.2)' : 'rgba(96,165,250,0.2)'}`,
    }}
    >
    <div className="flex items-center gap-2">
        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 relative border-2 overflow-hidden', avatarColor(name))} style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
          {conv.wa_profile_pic_url ? (
            <img src={conv.wa_profile_pic_url} alt={name} className="w-full h-full rounded-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
          ) : null}
          <div className={cn('w-full h-full rounded-full flex items-center justify-center', avatarColor(name))} style={{ display: conv.wa_profile_pic_url ? 'none' : 'flex' }}>
            {initials}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          {/* Line 1: Name (left) + Time (right) */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-[12px] font-semibold truncate leading-tight" style={{ color: 'rgba(255,255,255,0.92)' }} title={name}>
              {name}
            </span>
            <span className="text-[9px] font-medium shrink-0" style={{ color: 'rgba(255,255,255,0.42)' }}>{timeAgo}</span>
          </div>
          {/* Line 2: Last message preview */}
          <p className="text-[10px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.52)' }}>
            {conv.last_message?.startsWith('🎤') ? conv.last_message : (conv.last_message || '—')}
          </p>
          {/* Line 3: Entity badge + full CRM tags (wrap if needed) */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {/* Entity type badge */}
            {entityType && (
              <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${
                entityType === 'landlord' ? 'bg-amber-500/15 text-amber-400 border-amber-500/25' : 'bg-blue-500/15 text-blue-400 border-blue-500/25'
              }`}>
                {entityType === 'landlord' ? 'Landlord' : 'Lead'}
              </span>
            )}
            {/* Stage badge */}
            {stage && (
              <span className="text-[8px] px-1.5 py-0.5 rounded border font-medium shrink-0" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)' }}>
                {stage.replace(/_/g, ' ')}
              </span>
            )}
            {/* CRM tags - full, not truncated */}
            {allTags.length > 0 && (
              <div className="flex gap-0.5 flex-wrap flex-1">
                {allTags.slice(0, 8).map((t, idx) => (
                  <span 
                    key={`${t}-${idx}`} 
                    className="text-[8px] px-1.5 py-0.5 rounded-full font-medium border shrink-0"
                    style={{ 
                      background: idx === 0 ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.05)',
                      borderColor: idx === 0 ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.1)',
                      color: idx === 0 ? 'hsl(38 92% 55%)' : 'rgba(255,255,255,0.6)'
                    }}
                    title={t}
                  >
                    {t}
                  </span>
                ))}
                {allTags.length > 8 && (
                  <span className="text-[8px] px-1 py-0.5 rounded-full" style={{ color: 'rgba(255,255,255,0.4)' }}>+{allTags.length - 8}</span>
                )}
              </div>
            )}
            {/* Pin icon (if starred/pinned) */}
            {conv.is_starred && (
              <Pin className="w-3 h-3 ml-auto mr-1" style={{ color: 'hsl(38 92% 50%)' }} />
            )}
            {/* Unread badge - aligned right, green WhatsApp style */}
            {conv.unread_count > 0 && (
              <Badge className="text-[8px] px-1.5 py-0 min-w-[1.2rem] h-5 rounded-full font-semibold" style={{ background: 'hsl(152 69% 40%)', color: 'white' }}>
                {conv.unread_count > 9 ? '9+' : conv.unread_count}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}