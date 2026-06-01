import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Star } from 'lucide-react';
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

export default function ConversationItem({ conv, lead, landlord, selected, onClick }) {
  const displayPhone = conv.wa_phone_e164 || conv.phone_number || '';
  // Priority: landlord name > lead name > wa_display_name > phone
  const name = landlord?.full_name_en || lead?.full_name || conv.wa_display_name || displayPhone;
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
        'w-full text-left px-3.5 py-3 transition-all duration-200',
        selected ? 'ring-1 ring-accent/40' : 'hover:shadow-md',
      )}
      style={{
        background: selected ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: selected ? '1px solid rgba(245,159,10,0.4)' : '1px solid rgba(255,255,255,0.08)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        borderLeft: selected ? '3px solid rgba(245,159,10,0.6)' : '3px solid transparent',
      }}
    >
      <div className="flex items-center gap-3">
        <div className={cn('w-11 h-11 rounded-full flex items-center justify-center text-white text-base font-bold shrink-0 relative border-2', avatarColor(name))} style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
          {conv.wa_profile_pic_url
            ? <img src={conv.wa_profile_pic_url} alt={name} className="w-full h-full rounded-full object-cover" />
            : (conv.unread_count > 0 ? String(conv.unread_count > 9 ? '9+' : conv.unread_count) : initials)
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-sm font-bold truncate leading-snug" style={{ color: 'rgba(255,255,255,0.95)' }}>
                {name}
                {conv.is_starred && <Star className="inline w-3.5 h-3.5 fill-amber-400 text-amber-400 ml-0.5" />}
              </span>
              {priority && (
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border',
                  priority === 'urgent' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                  priority === 'high' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                  priority === 'medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                  'bg-slate-500/20 text-slate-400 border-slate-500/30'
                )}>
                  {priority.toUpperCase()}
                </span>
              )}
              {displayPhone && <WhatsAppPhone phone={displayPhone} name={name} leadId={lead?.id} size="xs" showNumber={false} />}
            </div>
            <span className="text-[10px] font-medium shrink-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{timeAgo}</span>
          </div>
          <p className="text-xs truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>{conv.last_message || '—'}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border',
              sentiment === 'positive' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
              sentiment === 'negative' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
              'bg-slate-500/20 text-slate-400 border-slate-500/30'
            )}>
              {sentiment === 'positive' ? '✓ Positive' : sentiment === 'negative' ? '⚠ Negative' : 'Neutral'}
            </span>
            {landlord && (
              <span className="text-[9px] px-1.5 py-0.5 rounded border font-medium" style={{ background: 'hsl(38 92% 50% / 0.15)', borderColor: 'hsl(38 92% 50% / 0.3)', color: 'hsl(38 92% 55%)' }}>
                Landlord
              </span>
            )}
            {allTags.length > 0 && (
              <div className="flex gap-1">
                {allTags.map(t => (
                  <span key={t} className="text-[9px] px-1.5 py-0.5 rounded border font-medium" style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}>{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}