import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Star, Building2, User, Briefcase, Home } from 'lucide-react';
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
          'w-full text-left px-3 py-2 transition-all duration-200 border-b',
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
        <div className="flex items-center gap-2.5">
          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 relative border-2', 'bg-gray-500')} style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1.5 mb-0.5">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-[13px] font-semibold truncate leading-tight" style={{ color: 'rgba(255,255,255,0.6)' }} title={name}>
                  {name}
                  <span className="text-[8px] font-normal ml-1 px-1 py-0.5 rounded bg-gray-500/20 text-gray-400 border border-gray-500/30">Test</span>
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[9px] font-medium shrink-0" style={{ color: 'rgba(255,255,255,0.5)' }}>{timeAgo}</span>
                {channel === 'business' ? (
                  <Building2 className="w-2.5 h-2.5 text-emerald-400" title="Business line" />
                ) : (
                  <User className="w-2.5 h-2.5 text-blue-400" title="Personal line" />
                )}
              </div>
            </div>
            <p className="text-[11px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{conv.last_message || '—'}</p>
          </div>
        </div>
      </button>
    );
  }
  
  // Priority: landlord name > lead name > wa_display_name (real WA profile name) > formatted phone
  const rawWaName = conv.wa_display_name || '';
  // Filter out auto-generated fallback names — only use if it looks like a real person name
  const isGenericName = !rawWaName
    || rawWaName.startsWith('WhatsApp lead')
    || rawWaName.startsWith('+')
    || /^\d+$/.test(rawWaName.trim());
  const waName = isGenericName ? '' : rawWaName;
  const name = landlord?.full_name_en || lead?.full_name || waName || displayPhone;
  const isWhatsAppProfile = waName && !landlord && !lead;
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';
  const timeAgo = conv.last_message_at
    ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })
    : '';
  const priority = conv.ai_priority || conv.ai_urgency;
  const sentiment = conv.ai_sentiment || 'unknown';
  // Prioritize lead's CRM tags first, then conversation tags
  const allTags = [...(lead?.tags || []), ...(conv.manual_tags || []), ...(conv.ai_tags || [])].slice(0, 3);
  const channel = conv.channel || 'business';
  const entityType = landlord ? 'landlord' : lead ? 'lead' : null;
  const stage = landlord?.stage || lead?.stage;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2 transition-all duration-200 border-b',
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
      <div className="flex items-center gap-2.5">
        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 relative border-2', avatarColor(name))} style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
          {conv.wa_profile_pic_url
            ? <img src={conv.wa_profile_pic_url} alt={name} className="w-full h-full rounded-full object-cover" />
            : (conv.unread_count > 0 ? String(conv.unread_count > 9 ? '9+' : conv.unread_count) : initials)
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1.5 mb-0.5">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-[13px] font-semibold truncate leading-tight" style={{ color: 'rgba(255,255,255,0.95)' }} title={name}>
                {name}
                {entityType && (
                  <span className={`text-[8px] font-normal ml-1 px-1 py-0.5 rounded border ${
                    entityType === 'landlord' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  }`}>
                    {entityType === 'landlord' ? <><Briefcase className="w-2 h-2 inline mr-0.5" /> Landlord</> : <><Home className="w-2 h-2 inline mr-0.5" /> Lead</>}
                  </span>
                )}
                {isWhatsAppProfile && <span className="text-[8px] font-normal ml-1 px-1 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">WA</span>}
                {conv.is_starred && <Star className="inline w-3 h-3 fill-amber-400 text-amber-400 ml-0.5" />}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {conv.unread_count > 0 && (
                <Badge className="text-[8px] px-1 py-0 min-w-[1.1rem] h-4.5" style={{ background: 'hsl(38 92% 50%)', color: 'hsl(222 47% 11)' }}>
                  {conv.unread_count > 9 ? '9+' : conv.unread_count}
                </Badge>
              )}
              <span className="text-[9px] font-medium shrink-0" style={{ color: 'rgba(255,255,255,0.5)' }}>{timeAgo}</span>
              {channel === 'business' ? (
                <Building2 className="w-2.5 h-2.5 text-emerald-400" title="Business line" />
              ) : (
                <User className="w-2.5 h-2.5 text-blue-400" title="Personal line" />
              )}
            </div>
          </div>
          <p className="text-[11px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {conv.last_message?.startsWith('🎤') ? conv.last_message : (conv.last_message || '—')}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {stage && (
              <span className="text-[8px] px-1.5 py-0.5 rounded border font-medium" style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}>
                {stage.replace(/_/g, ' ')}
              </span>
            )}
            {allTags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {allTags.map((t, idx) => (
                  <span 
                    key={`${t}-${idx}`} 
                    className="text-[8px] px-1.5 py-0.5 rounded-full font-medium border"
                    style={{ 
                      background: idx === 0 ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)',
                      borderColor: idx === 0 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.12)',
                      color: idx === 0 ? 'hsl(38 92% 60%)' : 'rgba(255,255,255,0.65)'
                    }}
                    title={t}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}