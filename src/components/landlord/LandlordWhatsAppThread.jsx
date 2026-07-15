import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Send, Loader2, MessageSquare, Clock, Check, CheckCheck, Building2, User, RefreshCw, Bot, FileText, Zap, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import TemplatesModal from '@/components/whatsapp/TemplatesModal';
import { useCurrentUser } from '@/lib/useCurrentUser';
import ModernComposerField from '@/components/landlord/ModernComposerField';

function toDigits(raw) { return String(raw || '').replace(/\D/g, ''); }
const fmt = (ts) => { try { return ts ? format(new Date(ts), 'd MMM, HH:mm') : ''; } catch { return ''; } };

const SHARED_EMAILS = ['ahmad@erudite-estate.com', 'ahmad.badreddine198622@gmail.com'];

const CHANNELS = [
  { id: 'business', label: 'Business', phone: '+971 58 280 6000', color: 'emerald', icon: Building2 },
  { id: 'personal', label: 'Ahmad',    phone: '+971 58 180 6000', color: 'blue',    icon: User },
  { id: 'malik',   label: 'Malik',     phone: '+971 52 987 1277', color: 'purple',  icon: User },
  { id: 'agent',   label: 'My Line',   phone: '',                   color: 'amber',   icon: Smartphone },
];

const CHANNEL_COLORS = {
  emerald: { active: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400', text: 'text-emerald-400' },
  blue:    { active: 'bg-blue-500/15 border-blue-500/40 text-blue-400',          text: 'text-blue-400' },
  purple:  { active: 'bg-purple-500/15 border-purple-500/40 text-purple-400',    text: 'text-purple-400' },
  amber:   { active: 'bg-amber-500/15 border-amber-500/40 text-amber-400',      text: 'text-amber-400' },
};

export default function LandlordWhatsAppThread({ landlord }) {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const isAuthorizedShared = SHARED_EMAILS.includes((user?.email || '').toLowerCase());
  const hasOwnLine = !!(user?.whatsapp_instance);
  // Agents with their own WhatsApp line default to their own "My Line" tab —
  // the backend records their messages on the 'agent' channel, not 'personal'.
  // Without this, their sends succeed but are invisible (wrong channel tab).
  const defaultChannel = (!isAuthorizedShared && hasOwnLine) ? 'agent' : 'personal';
  const [text, setText] = useState('');
  const [selectedChannel, setSelectedChannel] = useState(defaultChannel);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isSendingTemplate, setIsSendingTemplate] = useState(false);
  const [smartReplies, setSmartReplies] = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [optimisticMsgs, setOptimisticMsgs] = useState([]);
  const messagesEndRef = useRef(null);

  const phone = toDigits(landlord?.phone);
  const phoneE164 = phone ? '+' + phone : null;

  // Fetch WhatsApp templates for business channel
  const { data: metaData } = useQuery({
    queryKey: ['meta_templates_live'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getMetaTemplates', {});
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: selectedChannel === 'business',
  });
  const displayTemplates = metaData?.templates || [];

  // Find conversations for selected channel
  const { data: conversations = [] } = useQuery({
    queryKey: ['wa-thread-conv', landlord?.id, selectedChannel],
    queryFn: async () => {
      if (!phoneE164) return [];
      let r = await base44.entities.WhatsAppConversation.filter({ wa_phone_e164: phoneE164, channel: selectedChannel });
      if (!r.length) r = await base44.entities.WhatsAppConversation.filter({ phone_number: phoneE164, channel: selectedChannel });
      return [...r].sort((a, b) =>
        new Date(b.last_message_at || b.updated_date || 0) - new Date(a.last_message_at || a.updated_date || 0)
      );
    },
    enabled: !!phoneE164,
  });
  const conversation = conversations[0] || null;
  const conversationIds = conversations.map(c => c.id).filter(Boolean);

  // Fetch messages from WhatsAppMessage entity (same as LandlordWhatsAppPanel)
  const { data: messages = [], isLoading, refetch } = useQuery({
    queryKey: ['wa-thread-msgs', conversationIds.join(',')],
    queryFn: async () => {
      const batches = await Promise.all(
        conversationIds.map(cid =>
          base44.entities.WhatsAppMessage.filter({ conversation_id: cid }, 'timestamp', 200)
        )
      );
      const seen = new Set();
      return batches
        .flat()
        .filter(m => m.id && !seen.has(m.id) ? (seen.add(m.id), true) : false)
        .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
    },
    enabled: conversationIds.length > 0,
    refetchInterval: 4000,
  });

  // Merge optimistic outbound messages so the user sees their send instantly
  const allMessages = useMemo(() => {
    if (!optimisticMsgs.length) return messages;
    const realIds = new Set(messages.map(m => m.id));
    const realKeys = new Set(messages.map(m => `${m.body}|${m.timestamp}`));
    const pending = optimisticMsgs.filter(o => !realIds.has(o.id) && !realKeys.has(`${o.body}|${o.timestamp}`));
    return [...messages, ...pending].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
  }, [messages, optimisticMsgs]);

  // Realtime: subscribe to WhatsAppMessage events so inbound/outbound show instantly (no delay)
  useEffect(() => {
    if (!conversationIds.length) return;
    const unsubscribe = base44.entities.WhatsAppMessage.subscribe((event) => {
      if (event?.data && conversationIds.includes(event.data.conversation_id)) {
        qc.invalidateQueries({ queryKey: ['wa-thread-msgs'] });
      }
    });
    return () => { try { unsubscribe(); } catch {} };
  }, [conversationIds.join(',')]);

  // Auto-scroll to bottom whenever messages change (new inbound or outbound) — like real WhatsApp
  const lastMsgKey = allMessages.length ? (allMessages[allMessages.length - 1]?.id || allMessages[allMessages.length - 1]?.timestamp) : '';
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lastMsgKey, allMessages.length]);

  // Clear optimistic messages once they appear in the real data
  useEffect(() => {
    if (!optimisticMsgs.length) return;
    const realKeys = new Set(messages.map(m => `${m.body}|${m.timestamp}`));
    setOptimisticMsgs(prev => prev.filter(o => !realKeys.has(`${o.body}|${o.timestamp}`)));
  }, [messages]);

  // Auto-detect channel from last incoming message
  useEffect(() => {
    if (messages.length > 0) {
      const lastIncoming = [...messages].reverse().find(m => m.direction === 'inbound');
      if (lastIncoming?.channel && lastIncoming.channel !== selectedChannel) {
        setSelectedChannel(lastIncoming.channel);
      }
    }
  }, []); // only on mount

  const sendMutation = useMutation({
    mutationFn: (msg) => base44.functions.invoke('sendMultiChannelWhatsApp', {
      landlord_id: landlord.id,
      text: msg,
      channel: selectedChannel,
    }),
    onMutate: (msg) => {
      // Optimistic: show the outgoing message instantly, no waiting for refetch
      const optimistic = {
        id: `optimistic-${Date.now()}`,
        direction: 'outbound',
        body: msg,
        timestamp: new Date().toISOString(),
        status: 'pending',
        conversation_id: conversation?.id || null,
      };
      setOptimisticMsgs(prev => [...prev, optimistic]);
    },
    onSuccess: (res) => {
      const data = res?.data ?? res;
      if (data?.error) { toast.error(`Send failed: ${data.error}`); setOptimisticMsgs([]); return; }
      setText('');
      setSmartReplies([]);
      qc.invalidateQueries({ queryKey: ['wa-thread-msgs'] });
      qc.invalidateQueries({ queryKey: ['wa-thread-conv', landlord?.id, selectedChannel] });
      toast.success('Message sent');
      // Clear optimistic after the refetch picks up the real message
      setTimeout(() => setOptimisticMsgs([]), 2000);
    },
    onError: (e) => { setOptimisticMsgs([]); toast.error('Send failed: ' + (e?.response?.data?.error || e?.message)); },
  });

  const handleSendTemplate = async (template, template_components, resolvedBody) => {
    if (!phoneE164) return;
    setIsSendingTemplate(true);
    try {
      // Always send via to_phone — backend always routes through Meta Business API
      const res = await base44.functions.invoke('sendWhatsAppMessage', {
        to_phone: phoneE164,
        landlord_id: landlord.id,
        template_name: template.name,
        template_language: template.language || 'en',
        template_components: template_components || [],
        template_body: resolvedBody || template.body || '',
      });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success(`Template "${template.name}" sent via Business WhatsApp!`);
      // Switch to business tab so user sees the sent message
      setSelectedChannel('business');
      // Force refetch of business conversations and messages
      await qc.invalidateQueries({ queryKey: ['wa-thread-conv'] });
      await qc.invalidateQueries({ queryKey: ['wa-thread-msgs'] });
    } catch (e) {
      toast.error(e.message || 'Failed to send template');
    } finally {
      setIsSendingTemplate(false);
      setShowTemplates(false);
    }
  };

  const fetchSmartReplies = async () => {
    if (!conversation?.id) { toast.error('No active conversation'); return; }
    setLoadingReplies(true);
    try {
      const res = await base44.functions.invoke('getSmartReplies', { conversation_id: conversation.id });
      const replies = res?.data?.replies || res?.data?.suggestions || [];
      setSmartReplies(Array.isArray(replies) ? replies.slice(0, 4) : []);
      if (!replies.length) toast.info('No suggestions available');
    } catch { toast.error('Could not load AI suggestions'); }
    finally { setLoadingReplies(false); }
  };

  const submit = (e) => {
    e?.preventDefault?.();
    const t = text.trim();
    if (!t) return;
    if (!landlord?.phone) { toast.error('This landlord has no phone number.'); return; }
    sendMutation.mutate(t);
  };

  const stats = messages.length > 0 ? { total: messages.length } : null;

  return (
    <div className="flex flex-col" style={{ height: 500 }}>
      {/* Channel tabs + actions */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {CHANNELS.filter(c => {
          // "My Line" (agent) tab — only for non-Ahmad users who configured their own line
          if (c.id === 'agent') return !isAuthorizedShared && hasOwnLine;
          // Shared company lines — only for Ahmad (authorized shared emails)
          if (c.id === 'business' || c.id === 'personal' || c.id === 'malik') return isAuthorizedShared;
          return true;
        }).map(({ id, label, phone, color, icon: Icon }) => {
          const colors = CHANNEL_COLORS[color];
          const displayPhone = id === 'agent' ? (user?.whatsapp_number || '') : phone;
          return (
            <button
              key={id}
              onClick={() => { setSelectedChannel(id); setSmartReplies([]); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${selectedChannel === id ? colors.active : 'border-white/15 text-muted-foreground hover:bg-white/8'}`}
              title={displayPhone || label}
            >
              <Icon className="w-3 h-3" /> {label}
              {displayPhone && <span className="text-[9px] opacity-60">{displayPhone}</span>}
            </button>
          );
        })}
        <div className="ml-auto flex gap-1.5">
          {isAuthorizedShared && (
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
            title="Send a Business WhatsApp template (always via Meta Business API)"
          >
            <FileText className="w-3 h-3" />
            Templates{displayTemplates.length > 0 ? ` (${displayTemplates.length})` : ''}
          </button>
          )}
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs border border-white/15 text-muted-foreground hover:bg-white/8 transition-colors"
            title="Refresh messages"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          <button
            onClick={fetchSmartReplies}
            disabled={loadingReplies || !conversation?.id}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-40"
          >
            {loadingReplies ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
            AI
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="flex items-center gap-4 px-1 pb-2 border-b border-white/10 mb-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="font-semibold text-foreground">{stats.total}</span> messages
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 p-1">
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-8 flex items-center justify-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        ) : !conversation && allMessages.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-10">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-2">
              {selectedChannel === 'business' ? <Building2 className="w-5 h-5 opacity-40" /> : selectedChannel === 'agent' ? <Smartphone className="w-5 h-5 opacity-40" /> : <User className="w-5 h-5 opacity-40" />}
            </div>
            No {selectedChannel === 'agent' ? 'My Line' : selectedChannel} conversation yet.<br />
            <span className="opacity-60">Send a message to start one.</span>
          </div>
        ) : allMessages.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-10">No messages in this channel yet.</div>
        ) : (
          allMessages.map((m) => {
            const out = m.direction === 'outbound';
            const isPending = m.status === 'pending';
            const StatusIcon = isPending ? Clock : ['read', 'delivered'].includes(m.status) ? CheckCheck : Check;
            const statusColor = isPending ? 'text-amber-300' : m.status === 'read' ? 'text-blue-300' : m.status === 'delivered' ? 'text-emerald-300' : 'text-white/50';
            return (
              <div key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${out ? 'bg-emerald-600/90 text-white rounded-br-sm' : 'bg-white/10 rounded-bl-sm'}`}>
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                  <div className={`mt-1 text-[10px] flex items-center gap-1 ${out ? 'text-white/70 justify-end' : 'text-muted-foreground'}`}>
                    {fmt(m.timestamp)}
                    {out && <StatusIcon className={`w-3 h-3 ${statusColor}`} />}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Smart reply chips */}
      {smartReplies.length > 0 && (
        <div className="py-2 flex flex-wrap gap-1.5 border-t border-white/10">
          {smartReplies.map((r, i) => (
            <button
              key={i}
              onClick={() => { setText(typeof r === 'string' ? r : r.text || ''); setSmartReplies([]); }}
              className="text-[11px] px-2.5 py-1 rounded-full border border-violet-500/30 text-violet-300 hover:bg-violet-500/10 transition-colors truncate max-w-[90%] text-left"
            >
              <Zap className="w-2.5 h-2.5 inline mr-1" />
              {typeof r === 'string' ? r : r.text || ''}
            </button>
          ))}
          <button onClick={() => setSmartReplies([])} className="text-[10px] text-muted-foreground hover:text-foreground">✕</button>
        </div>
      )}

      {/* Composer */}
      <div className="pt-2 border-t border-white/10">
        <ModernComposerField
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e); } }}
          onSend={submit}
          sending={sendMutation.isPending}
          sendDisabled={!landlord?.phone}
          placeholder={landlord?.phone ? `Message via ${selectedChannel === 'agent' ? 'My Line' : (CHANNELS.find(c => c.id === selectedChannel)?.label || selectedChannel)}… (Enter to send)` : 'No phone number on file'}
          channel="whatsapp"
          accent="#10b981"
          voiceEnabled={true}
          landlordId={landlord?.id}
          landlordContext={{ name: landlord?.full_name_en || landlord?.full_name || '', unit: landlord?.unit_reference || '', project: landlord?.project_name || '', asking: landlord?.asking_price_aed || '', agentName: landlord?.assigned_agent_email || '' }}
          targetLanguage={landlord?.preferred_language}
          minHeight={44}
        />
        {selectedChannel === 'business' && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Business channel · use <span className="text-amber-400">Templates</span> to re-open 24h window
          </p>
        )}
      </div>

      <TemplatesModal
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        templates={displayTemplates}
        onSelect={async (t, comps, resolvedBody) => { await handleSendTemplate(t, comps, resolvedBody); }}
        isSending={isSendingTemplate}
        channel="business"
      />
    </div>
  );
}