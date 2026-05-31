import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Search, RefreshCw, Mail, MessageCircle, Phone, Star, StarOff,
  ChevronLeft, Send, Paperclip, MoreVertical, UserPlus, Tag,
  CheckCheck, Circle, Filter, Inbox, ArrowLeft, User, Clock,
  AtSign, Archive, Trash2, Reply, X
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import GmailConnectionBanner from '@/components/inbox/GmailConnectionBanner';

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const CHANNEL_TABS = [
  { id: 'all',       label: 'All',       icon: Inbox },
  { id: 'email',     label: 'Email',     icon: Mail },
  { id: 'whatsapp',  label: 'WhatsApp',  icon: MessageCircle },
];

const STATUS_FILTERS = [
  { id: 'all',    label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'starred',label: 'Starred' },
  { id: 'open',   label: 'Open' },
];

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 40, color }) {
  const colors = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EC4899','#06B6D4','#EF4444'];
  const bg = color || colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className="flex items-center justify-center rounded-full font-semibold text-white shrink-0"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.38 }}>
      {getInitials(name)}
    </div>
  );
}

// ── Conversation Row ──────────────────────────────────────────────────────────
function ConversationRow({ item, selected, onClick }) {
  const isEmail = item._type === 'email';
  const name = isEmail ? (item.from_name || item.from_email) : (item.wa_display_name || item.wa_phone_e164);
  const preview = isEmail ? item.snippet : item.last_message;
  const time = isEmail ? item.received_at : item.last_message_at;
  const unread = isEmail ? !item.is_read : (item.unread_count || 0) > 0;
  const unreadCount = isEmail ? (unread ? 1 : 0) : (item.unread_count || 0);
  const starred = item.is_starred;

  return (
    <button onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors border-b',
        selected
          ? 'bg-accent/10 border-accent/20 border-l-2 border-l-accent'
          : 'hover:bg-white/4 border-white/5',
        unread && !selected && 'bg-white/3'
      )}>
      <div className="relative shrink-0 mt-0.5">
        <Avatar name={name} size={42} />
        <span className={cn(
          'absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center',
          isEmail ? 'bg-blue-500' : 'bg-green-500'
        )}>
          {isEmail ? <Mail className="w-2.5 h-2.5 text-white" /> : <MessageCircle className="w-2.5 h-2.5 text-white" />}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={cn('text-sm truncate', unread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80')}>
            {name}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {starred && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
            <span className="text-[11px] text-muted-foreground">{formatTime(time)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className={cn('text-xs truncate', unread ? 'text-foreground/75' : 'text-muted-foreground')}>
            {isEmail ? item.subject || '(no subject)' : preview || ''}
          </p>
          {unreadCount > 0 && (
            <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[10px] font-bold text-accent-foreground flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        {!isEmail && preview && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{preview}</p>
        )}
      </div>
    </button>
  );
}

// ── Email Thread View ─────────────────────────────────────────────────────────
function EmailThread({ email, onClose }) {
  const [replyText, setReplyText] = useState('');
  const [showReply, setShowReply] = useState(false);

  const { data: thread = [] } = useQuery({
    queryKey: ['email-thread', email.thread_id || email.id],
    queryFn: () => base44.entities.Email.filter({ thread_id: email.thread_id || email.id }, 'received_at', 50),
    enabled: !!email.id,
  });

  const messages = thread.length > 0 ? thread : [email];

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8">
        <button onClick={onClose} className="md:hidden p-1.5 rounded-lg hover:bg-white/8">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm truncate">{email.subject || '(no subject)'}</h2>
          <p className="text-xs text-muted-foreground">{messages.length} message{messages.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowReply(v => !v)}>
            <Reply className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"><Archive className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {messages.map((msg, i) => (
          <div key={msg.id || i} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar name={msg.from_name || msg.from_email} size={32} />
                <div>
                  <p className="text-sm font-medium">{msg.from_name || msg.from_email}</p>
                  <p className="text-xs text-muted-foreground">to {msg.to_email || 'me'}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{msg.received_at ? format(new Date(msg.received_at), 'MMM d, h:mm a') : ''}</p>
            </div>
            <div className="ml-10 p-4 rounded-xl text-sm leading-relaxed"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {msg.body_html ? (
                <div dangerouslySetInnerHTML={{ __html: msg.body_html }}
                  className="prose prose-invert prose-sm max-w-none" />
              ) : (
                <p className="whitespace-pre-wrap">{msg.body_text || msg.snippet || '(empty)'}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Reply composer */}
      {showReply && (
        <div className="border-t border-white/8 p-4 space-y-2">
          <div className="text-xs text-muted-foreground mb-1">Reply to {email.from_email}</div>
          <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
            placeholder="Write your reply..."
            rows={4}
            className="w-full resize-none rounded-xl px-3 py-2.5 text-sm glass-input"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }} />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8"><Paperclip className="w-4 h-4" /></Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowReply(false)}>Cancel</Button>
              <Button size="sm" className="bg-accent text-accent-foreground gap-1.5" disabled={!replyText.trim()}>
                <Send className="w-3.5 h-3.5" /> Send
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── WhatsApp Thread View ──────────────────────────────────────────────────────
function WhatsAppThread({ conversation, onClose }) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const { data: messages = [] } = useQuery({
    queryKey: ['wa-messages', conversation.id],
    queryFn: () => base44.entities.WhatsAppMessage.filter({ conversation_id: conversation.id }, 'timestamp', 200),
    refetchInterval: 8000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    if (!msg.trim()) return;
    setSending(true);
    try {
      await base44.functions.invoke('sendWhatsAppMessageFromCRM', {
        phone: conversation.wa_phone_e164,
        message: msg.trim(),
        conversation_id: conversation.id,
      });
      setMsg('');
      qc.invalidateQueries({ queryKey: ['wa-messages', conversation.id] });
      qc.invalidateQueries({ queryKey: ['all-conversations'] });
      toast.success('Message sent');
    } catch (e) {
      toast.error('Failed to send');
    } finally {
      setSending(false);
    }
  };

  const name = conversation.wa_display_name || conversation.wa_phone_e164;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8">
        <button onClick={onClose} className="md:hidden p-1.5 rounded-lg hover:bg-white/8">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Avatar name={name} size={38} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{name}</p>
          <p className="text-xs text-muted-foreground">{conversation.wa_phone_e164}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8"><UserPlus className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"><Tag className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 px-5 py-2 border-b border-white/5 text-xs text-muted-foreground">
        {conversation.status && (
          <span className={cn('px-2 py-0.5 rounded-full font-medium',
            conversation.status === 'open' ? 'bg-green-500/15 text-green-400' :
            conversation.status === 'resolved' ? 'bg-slate-500/20 text-slate-400' :
            'bg-amber-500/15 text-amber-400'
          )}>
            {conversation.status}
          </span>
        )}
        {conversation.assigned_agent_email && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" /> {conversation.assigned_agent_email}
          </span>
        )}
        {conversation.ai_sentiment && (
          <span className="flex items-center gap-1 capitalize">{conversation.ai_sentiment}</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-10">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No messages yet
          </div>
        )}
        {messages.map(m => {
          const isOut = m.direction === 'outbound';
          return (
            <div key={m.id} className={cn('flex', isOut ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[72%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed',
                isOut
                  ? 'bg-accent text-accent-foreground rounded-br-sm'
                  : 'rounded-bl-sm'
              )} style={!isOut ? { background: 'rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.9)' } : {}}>
                <p className="whitespace-pre-wrap">{m.body || m.text || ''}</p>
                <p className={cn('text-[10px] mt-1 text-right', isOut ? 'text-amber-100/60' : 'text-white/35')}>
                  {m.timestamp ? format(new Date(m.timestamp), 'h:mm a') : ''}
                  {isOut && <CheckCheck className="inline w-3 h-3 ml-1" />}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-white/8 p-3">
        <div className="flex items-end gap-2 rounded-2xl px-3 py-2"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <textarea value={msg} onChange={e => setMsg(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
            placeholder="Type a message... (Enter to send)"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-white/30 leading-relaxed max-h-32"
            style={{ color: 'rgba(255,255,255,0.9)' }} />
          <div className="flex items-center gap-1 pb-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <Paperclip className="w-4 h-4" />
            </Button>
            <Button size="icon" className="h-8 w-8 shrink-0 bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={handleSend} disabled={!msg.trim() || sending}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 p-8">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <Inbox className="w-10 h-10 opacity-30" />
      </div>
      <p className="font-medium text-foreground/60">Select a conversation</p>
      <p className="text-sm text-center max-w-56">Choose a conversation from the list to read and reply</p>
    </div>
  );
}

// ── Main Inbox ────────────────────────────────────────────────────────────────
export default function InboxPage() {
  const [channel, setChannel] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showList, setShowList] = useState(true);
  const qc = useQueryClient();

  const { data: emails = [], refetch: refetchEmails } = useQuery({
    queryKey: ['emails'],
    queryFn: () => base44.entities.Email.list('-received_at', 100),
    enabled: channel === 'all' || channel === 'email',
  });

  const { data: waConvos = [], refetch: refetchWA } = useQuery({
    queryKey: ['all-conversations'],
    queryFn: () => base44.entities.WhatsAppConversation.list('-last_message_at', 200),
    enabled: channel === 'all' || channel === 'whatsapp',
    refetchInterval: 15000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Email.update(id, { is_read: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emails'] }),
  });

  // Merge and normalize conversations
  const allItems = useMemo(() => {
    let items = [];
    if (channel === 'all' || channel === 'email') {
      items = [...items, ...emails.map(e => ({ ...e, _type: 'email', _time: e.received_at }))];
    }
    if (channel === 'all' || channel === 'whatsapp') {
      items = [...items, ...waConvos.map(w => ({ ...w, _type: 'whatsapp', _time: w.last_message_at }))];
    }
    return items.sort((a, b) => new Date(b._time || 0) - new Date(a._time || 0));
  }, [emails, waConvos, channel]);

  const filtered = useMemo(() => {
    return allItems.filter(item => {
      const name = item._type === 'email' ? (item.from_name || item.from_email || '') : (item.wa_display_name || item.wa_phone_e164 || '');
      const preview = item._type === 'email' ? (item.subject || item.snippet || '') : (item.last_message || '');
      const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase()) || preview.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;

      if (statusFilter === 'unread') {
        return item._type === 'email' ? !item.is_read : (item.unread_count || 0) > 0;
      }
      if (statusFilter === 'starred') return item.is_starred;
      if (statusFilter === 'open') {
        return item._type === 'whatsapp' ? item.status === 'open' : true;
      }
      return true;
    });
  }, [allItems, search, statusFilter]);

  const unreadTotal = useMemo(() => {
    const emailUnread = emails.filter(e => !e.is_read).length;
    const waUnread = waConvos.reduce((s, c) => s + (c.unread_count || 0), 0);
    return emailUnread + waUnread;
  }, [emails, waConvos]);

  const handleSelect = (item) => {
    setSelected(item);
    setShowList(false);
    if (item._type === 'email' && !item.is_read) markReadMutation.mutate(item.id);
  };

  const handleRefresh = () => { refetchEmails(); refetchWA(); };
  const handleBack = () => { setShowList(true); setSelected(null); };

  return (
    <div className="flex h-[calc(100vh-2rem)] overflow-hidden" style={{ background: 'hsl(222 47% 7%)' }}>

      {/* ── Left: Conversation List ──────────────────────────────────── */}
      <div className={cn(
        'flex flex-col border-r border-white/8 shrink-0',
        'w-full md:w-[340px] lg:w-[380px]',
        !showList && 'hidden md:flex'
      )}>
        {/* Gmail connection banner */}
        <GmailConnectionBanner emailCount={emails.length} onSynced={refetchEmails} />

        {/* Header */}
        <div className="px-4 pt-4 pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">Conversations</h1>
              {unreadTotal > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-accent text-accent-foreground min-w-[20px] text-center">
                  {unreadTotal}
                </span>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="pl-8 h-8 text-sm glass-input" />
          </div>

          {/* Channel tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
            {CHANNEL_TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setChannel(tab.id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                    channel === tab.id
                      ? 'bg-accent text-accent-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}>
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Status filters */}
          <div className="flex gap-1 overflow-x-auto">
            {STATUS_FILTERS.map(f => (
              <button key={f.id} onClick={() => setStatusFilter(f.id)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                  statusFilter === f.id
                    ? 'bg-white/15 text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/8'
                )}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
              <Inbox className="w-8 h-8 opacity-25" />
              <p>No conversations found</p>
            </div>
          ) : (
            filtered.map(item => (
              <ConversationRow
                key={`${item._type}-${item.id}`}
                item={item}
                selected={selected?.id === item.id && selected?._type === item._type}
                onClick={() => handleSelect(item)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right: Conversation Detail ───────────────────────────────── */}
      <div className={cn(
        'flex-1 flex flex-col min-w-0',
        showList && 'hidden md:flex'
      )}>
        {!selected ? (
          <EmptyState />
        ) : selected._type === 'email' ? (
          <EmailThread email={selected} onClose={handleBack} />
        ) : (
          <WhatsAppThread conversation={selected} onClose={handleBack} />
        )}
      </div>
    </div>
  );
}