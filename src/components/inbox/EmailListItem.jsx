import React from 'react';
import { Badge } from '@/components/ui/badge';
import { format, isToday, isYesterday } from 'date-fns';
import { User } from 'lucide-react';

const TAG_COLORS = {
  sales: 'bg-emerald-500/10 text-emerald-600',
  support: 'bg-blue-500/10 text-blue-600',
  inquiry: 'bg-amber-500/10 text-amber-600',
  spam: 'bg-red-500/10 text-red-600',
  follow_up: 'bg-purple-500/10 text-purple-600',
  viewing_request: 'bg-sky-500/10 text-sky-600',
  offer: 'bg-orange-500/10 text-orange-600',
  document: 'bg-cyan-500/10 text-cyan-600',
};

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}

export default function EmailListItem({ email, isSelected, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`flex gap-3 px-4 py-3 cursor-pointer border-b border-border/50 transition-colors ${
        isSelected ? 'bg-accent/10 border-l-2 border-l-accent' : 'hover:bg-muted/50'
      } ${!email.is_read ? 'bg-card' : 'bg-transparent'}`}
    >
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
        email.lead_id ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground'
      }`}>
        {email.from_name?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={`text-sm truncate ${!email.is_read ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>
            {email.from_name || email.from_email}
          </span>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
            {formatTime(email.received_at)}
          </span>
        </div>
        <p className={`text-xs truncate mb-1 ${!email.is_read ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
          {email.subject}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">{email.snippet}</p>
        {email.auto_tags?.length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {email.auto_tags.slice(0, 2).map(tag => (
              <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded-full ${TAG_COLORS[tag] || 'bg-muted text-muted-foreground'}`}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Unread dot */}
      {!email.is_read && (
        <div className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" />
      )}
    </div>
  );
}