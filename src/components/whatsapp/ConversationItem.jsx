import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Star } from 'lucide-react';

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

export default function ConversationItem({ conv, lead, selected, onClick }) {
  const displayPhone = conv.wa_phone_e164 || conv.phone_number || '';
  const name = lead?.full_name || conv.wa_display_name || displayPhone;
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';
  const timeAgo = conv.last_message_at
    ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })
    : '';
  const priority = conv.ai_priority || conv.ai_urgency;
  const sentiment = conv.ai_sentiment || 'unknown';
  const allTags = [...(conv.ai_tags || []), ...(conv.manual_tags || [])].slice(0, 2);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 border-b border-l-4 transition-all duration-150',
        selected 
          ? 'bg-green-50 dark:bg-green-950/20 border-l-green-500 shadow-sm' 
          : cn('hover:bg-muted/60', priorityBorder[priority] || 'border-l-transparent'),
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
            selected 
              ? 'bg-green-500 text-white' 
              : conv.is_vip ? 'bg-amber-500 text-white' : 'bg-primary/10 text-primary'
          )}>
            {conv.wa_profile_pic_url ? (
              <img src={conv.wa_profile_pic_url} alt={name} className="w-full h-full rounded-full object-cover" />
            ) : initials}
          </div>
          {/* Sentiment dot */}
          <span className={cn(
            'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background', 
            sentimentDot[sentiment]
          )} />
          {/* Status indicator */}
          {conv.status && (
            <span className={cn(
              'absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-background',
              statusDot[conv.status] || 'bg-gray-300'
            )} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-sm font-medium truncate flex items-center gap-1">
              {name}
              {conv.is_starred && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
              {conv.wa_verified && <span className="text-blue-500 text-[10px]">✓</span>}
            </span>
            {conv.unread_count > 0 && (
              <span className="bg-green-500 text-white text-[9px] rounded-full w-5 h-5 flex items-center justify-center font-bold shrink-0">
                {conv.unread_count > 9 ? '9+' : conv.unread_count}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mb-1.5">
            {conv.last_message || '—'}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {conv.is_vip && (
              <Badge className="text-[9px] h-4 bg-amber-500 text-white border-0 px-1.5 shrink-0">VIP</Badge>
            )}
            {(priority === 'urgent') && (
              <Badge className="text-[9px] h-4 bg-red-500 text-white border-0 px-1.5 shrink-0">Urgent</Badge>
            )}
            {conv.sla_breached && (
              <Badge className="text-[9px] h-4 bg-red-600 text-white border-0 px-1.5 shrink-0">SLA ⚠</Badge>
            )}
            {allTags.map(t => (
              <Badge key={t} variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0 truncate max-w-[80px]">
                {t}
              </Badge>
            ))}
            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{timeAgo}</span>
          </div>
        </div>
      </div>
    </button>
  );
}