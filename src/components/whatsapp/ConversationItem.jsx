import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const sentimentDot = { 
  positive: 'bg-green-500', 
  neutral: 'bg-yellow-400', 
  negative: 'bg-red-500', 
  unknown: 'bg-gray-300' 
};

const urgencyBorder = { 
  low: '', 
  medium: 'border-l-yellow-400', 
  high: 'border-l-orange-500', 
  urgent: 'border-l-red-500' 
};

export default function ConversationItem({ conv, lead, selected, onClick }) {
  const name = lead?.name || conv.phone_number;
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const timeAgo = conv.last_message_at
    ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })
    : '';

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 border-b border-l-4 transition-all duration-150',
        selected 
          ? 'bg-green-50 dark:bg-green-950/20 border-l-green-500 shadow-sm' 
          : cn('hover:bg-muted/60', urgencyBorder[conv.ai_urgency] || 'border-l-transparent'),
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
            selected 
              ? 'bg-green-500 text-white' 
              : 'bg-primary/10 text-primary'
          )}>
            {initials}
          </div>
          {conv.ai_sentiment && (
            <span className={cn(
              'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background', 
              sentimentDot[conv.ai_sentiment]
            )} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={cn(
              'text-sm font-medium truncate',
              selected ? 'text-foreground' : 'text-foreground'
            )}>
              {name}
            </span>
            {conv.unread_count > 0 && (
              <span className="bg-green-500 text-white text-[9px] rounded-full w-5 h-5 flex items-center justify-center font-bold shrink-0">
                {conv.unread_count > 9 ? '9+' : conv.unread_count}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mb-2">
            {conv.last_message || '—'}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {conv.ai_urgency === 'urgent' && (
              <Badge className="text-[9px] h-5 bg-red-500 text-white border-0 px-2 shrink-0">
                Urgent
              </Badge>
            )}
            {(conv.ai_tags || []).slice(0, 2).map(t => (
              <Badge key={t} variant="secondary" className="text-[9px] h-5 px-2 shrink-0 truncate">
                {t}
              </Badge>
            ))}
            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
              {timeAgo}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}