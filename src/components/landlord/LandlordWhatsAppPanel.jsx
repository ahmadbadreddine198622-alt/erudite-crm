import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Send, Loader2, Building2, User, Bot, Zap, Check, CheckCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

function toDigits(raw) { return String(raw || '').replace(/\D/g, ''); }
const fmt = (ts) => { try { return ts ? format(new Date(ts), 'd MMM, HH:mm') : ''; } catch { return ''; } };

export default function LandlordWhatsAppPanel({ landlord }) {
  const qc = useQueryClient();
  const [channel, setChannel] = useState('business');
  const [text, setText] = useState('');
  const [smartReplies, setSmartReplies] = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const messagesEndRef = useRef(null);

  const phone = toDigits(landlord?.phone);
  const phoneE164 = phone ? '+' + phone : null;

  // Find conversation for current channel
  const { data: conversations = [] } = useQuery({
    queryKey: ['landlord-wa-conv', landlord?.id, channel],
    queryFn: async () => {
      if (!phoneE164) return [];
      const r = await base44.entities.WhatsAppConversation.filter({ wa_phone_e164: phoneE164, channel });
      if (r.length) return r;
      return base44.entities.WhatsAppConversation.filter({ phone_number: phoneE164, channel });
    },
    enabled: !!phoneE164,
  });
  const conversation = conversations[0] || null;

  // Fetch messages
  const { data: messages = [], isLoading, refetch } = useQuery({
    queryKey: ['landlord-wa-msgs', conversation?.id],
    queryFn: () => base44.entities.WhatsAppMessage.filter({ conversation_id: conversation.id }, 'timestamp', 200),
    enabled: !!conversation?.id,
    refetchInterval: 8000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: (msg) =>
      base44.functions.invoke('sendMultiChannelWhatsApp', { landlord_id: landlord.id, text: msg, channel }),
    onSuccess: (res) => {
      const data = res?.data ?? res;
      if (data?.error) { toast.error('Send failed: ' + data.error); return; }
      setText('');
      setSmartReplies([]);
      qc.invalidateQueries({ queryKey: ['landlord-wa-msgs', conversation?.id] });
      qc.invalidateQueries({ queryKey: ['landlord-wa-conv', landlord?.id, channel] });
    },
    onError: (e) => toast.error('Send failed: ' + (e?.response?.data?.error || e?.message)),
  });

  const fetchSmartReplies = async () => {
    if (!conversation?.id) { toast.error('Start a conversation first'); return; }
    setLoadingReplies(true);
    try {
      const res = await base44.functions.invoke('getSmartReplies', { conversation_id: conversation.id });
      const replies = res?.data?.replies || res?.data?.suggestions || [];
      setSmartReplies(Array.isArray(replies) ? replies.slice(0, 4) : []);
      if (!replies.length) toast.info('No suggestions available');
    } catch { toast.error('Could not load AI suggestions'); }
    finally { setLoadingReplies(false); }
  };

  const handleSend = (e) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    if (!phoneE164) { toast.error('No phone number on record'); return; }
    sendMutation.mutate(t);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex flex-col h-[500px]">
      {/* Channel tabs */}
      <div className="flex items-center gap-2 mb-3">
        {[
          { id: 'business', label: 'Business', icon: Building2, active: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400', inactive: 'border-white/15 text-muted-foreground hover:bg-white/8' },
          { id: 'personal', label: 'Personal', icon: User, active: 'bg-blue-500/15 border-blue-500/40 text-blue-400', inactive: 'border-white/15 text-muted-foreground hover:bg-white/8' },
          { id: 'malik', label: 'Malik', icon: User, active: 'bg-purple-500/15 border-purple-500/40 text-purple-400', inactive: 'border-white/15 text-muted-foreground hover:bg-white/8' },
        ].map(({ id, label, icon: Icon, active, inactive }) => (
          <button
            key={id}
            onClick={() => { setChannel(id); setSmartReplies([]); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${channel === id ? active : inactive}`}
          >
            <Icon className="w-3 h-3" /> {label}
          </button>
        ))}
        <div className="ml-auto flex gap-1.5">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs border border-white/15 text-muted-foreground hover:bg-white/8 transition-colors"
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

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {isLoading ? (
          <div className="text-xs text-muted-foreground text-center py-8 flex items-center justify-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading…
          </div>
        ) : !conversation ? (
          <div className="text-xs text-muted-foreground text-center py-10">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-2">
              {channel === 'business' ? <Building2 className="w-5 h-5 opacity-40" /> : <User className="w-5 h-5 opacity-40" />}
            </div>
            No {channel} conversation yet.<br/>
            <span className="opacity-60">Send a message to start one.</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-10">No messages in this channel yet.</div>
        ) : (
          messages.map((m) => {
            const out = m.direction === 'outbound';
            const StatusIcon = ['read', 'delivered'].includes(m.status) ? CheckCheck : Check;
            const statusColor = m.status === 'read' ? 'text-blue-300' : m.status === 'delivered' ? 'text-emerald-300' : 'text-white/50';
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

      {/* AI smart reply chips */}
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
      <form onSubmit={handleSend} className="pt-2 border-t border-white/10">
        <div className="flex gap-2 items-end">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={phoneE164
              ? `Message via ${channel === 'business' ? '🏢 Business' : channel === 'malik' ? '👤 Malik' : '👤 Personal'}… (Enter to send)`
              : 'No phone number on file'}
            disabled={!phoneE164 || sendMutation.isPending}
            rows={2}
            className="flex-1 text-sm resize-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!text.trim() || !phoneE164 || sendMutation.isPending}
            className="h-[60px] w-10 shrink-0"
          >
            {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Sending via <span className={channel === 'business' ? 'text-emerald-400' : channel === 'malik' ? 'text-purple-400' : 'text-blue-400'}>
            {channel === 'business' ? '🏢 Business (+971 58 280 6000)' : channel === 'malik' ? '👤 Malik (+971 52 987 1277)' : '👤 Personal (+971 58 180 6000)'}
          </span>
        </p>
      </form>
    </div>
  );
}