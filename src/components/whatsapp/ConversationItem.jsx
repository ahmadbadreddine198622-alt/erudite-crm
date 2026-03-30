import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const sentimentDot = { positive: 'bg-green-500', neutral: 'bg-yellow-400', negative: 'bg-red-500', unknown: 'bg-gray-300' };
const urgencyColor = { low: '', medium: 'border-l-yellow-400', high: 'border-l-orange-500', urgent: 'border-l-red-500' };

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
        'w-full text-left px-4 py-3 border-b transition-colors border-l-4',
        selected ? 'bg-accent/10 border-l-accent' : cn('hover:bg-muted/50', urgencyColor[conv.ai_urgency] || 'border-l-transparent'),
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
            {initials}
          </div>
          {conv.ai_sentiment && (
            <span className={cn('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background', sentimentDot[conv.ai_sentiment])} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium truncate">{name}</span>
            <span className="text-[10px] text-muted-foreground shrink-0 ml-1">{timeAgo}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.last_message || '—'}</p>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {conv.ai_urgency === 'urgent' && <Badge className="text-[9px] h-4 bg-red-500 text-white border-0 px-1">Urgent</Badge>}
            {(conv.ai_tags || []).slice(0, 2).map(t => (
              <Badge key={t} variant="secondary" className="text-[9px] h-4 px-1">{t}</Badge>
            ))}
            {conv.unread_count > 0 && (
              <span className="ml-auto bg-green-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {conv.unread_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}