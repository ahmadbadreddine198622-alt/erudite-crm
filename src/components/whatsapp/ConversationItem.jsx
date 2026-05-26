import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Star } from 'lucide-react';

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
        'w-full text-left px-3 py-2.5 border-b border-gray-100 transition-colors',
        selected
          ? 'bg-green-50 border-l-[3px] border-l-[#00A884]'
          : 'hover:bg-gray-50 border-l-[3px] border-l-transparent',
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 relative', avatarColor(name))}>
          {conv.wa_profile_pic_url
            ? <img src={conv.wa_profile_pic_url} alt={name} className="w-full h-full rounded-full object-cover" />
            : (conv.unread_count > 0 ? String(conv.unread_count > 9 ? '9+' : conv.unread_count) : initials)
          }
          <span className={cn('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white', sentimentDot[sentiment])} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <span className="text-sm font-semibold truncate text-gray-900 leading-snug">
              {name}
              {conv.is_starred && <Star className="inline w-3 h-3 text-amber-400 fill-amber-400 ml-0.5" />}
            </span>
            <span className="text-[11px] text-gray-400 shrink-0 mt-0.5">{timeAgo}</span>
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">{conv.last_message || '—'}</p>
          {allTags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {allTags.map(t => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-sm font-medium">{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}