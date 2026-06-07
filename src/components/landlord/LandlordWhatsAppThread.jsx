import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Send, Loader2, MessageSquare, Clock, Check, CheckCheck, Building2, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ChannelSwitcher from '@/components/whatsapp/ChannelSwitcher';

// Two-way WhatsApp thread for a landlord. Reads Message records (Evolution/Message
// entity) and sends replies via the sendMultiChannelWhatsApp backend function.
export default function LandlordWhatsAppThread({ landlord }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('business');

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['landlord-messages', landlord?.id],
    // filter(filterObj, sort, limit) — 'timestamp' ascending = oldest -> newest (chat style)
    queryFn: () => base44.entities.Message.filter({ landlord_id: landlord.id }, 'timestamp', 500),
    enabled: !!landlord?.id,
  });

  // Auto-detect channel from last incoming message
  useEffect(() => {
    if (messages.length > 0) {
      const lastIncoming = messages.filter(m => m.direction === 'incoming').pop();
      if (lastIncoming?.channel) {
        setSelectedChannel(lastIncoming.channel);
      }
    }
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: (msg) => base44.functions.invoke('sendMultiChannelWhatsApp', { landlord_id: landlord.id, text: msg, channel: selectedChannel }),
    onSuccess: (res) => {
      // invoke may wrap the payload in { data }; the function surfaces errors in-body too
      const data = res?.data ?? res;
      if (data?.error) {
        toast.error(`Send failed: ${data.error}${data.detail ? ' — ' + data.detail : ''}`);
        return;
      }
      setText('');
      qc.invalidateQueries({ queryKey: ['landlord-messages', landlord.id] });
      toast.success('Message sent');
    },
    onError: (e) => {
      const msg = e?.response?.data?.error || e?.response?.data?.detail || e?.message || 'Unknown error';
      toast.error(`Send failed: ${msg}`);
    },
  });

  const stats = useMemo(() => {
    if (!messages.length) return null;
    const total = messages.length;
    // avg response time: time between consecutive messages that switch direction
    const gaps = [];
    for (let i = 1; i < messages.length; i++) {
      const prev = messages[i - 1];
      const curr = messages[i];
      if (prev.direction !== curr.direction && prev.timestamp && curr.timestamp) {
        const diff = new Date(curr.timestamp) - new Date(prev.timestamp);
        if (diff > 0 && diff < 86400000 * 3) gaps.push(diff); // ignore > 3 days
      }
    }
    const avgMs = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
    let avgLabel = null;
    if (avgMs !== null) {
      const mins = Math.round(avgMs / 60000);
      avgLabel = mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`;
    }
    return { total, avgLabel };
  }, [messages]);

  const fmt = (ts) => {
    try { return ts ? format(new Date(ts), 'd MMM, HH:mm') : ''; } catch { return ts || ''; }
  };

  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    if (!landlord?.phone) { toast.error('This landlord has no phone number to message.'); return; }
    sendMutation.mutate(t);
  };

  const CHANNEL_STYLE = {
    business: { border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: Building2 },
    personal: { border: 'border-blue-500/40', bg: 'bg-blue-500/10', text: 'text-blue-400', icon: User },
  };

  return (
    <div className="flex flex-col h-[420px]">
      {stats && (
        <div className="flex items-center justify-between gap-4 px-1 pb-2 border-b border-white/10 mb-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="font-semibold text-foreground">{stats.total}</span> messages
            </span>
            {stats.avgLabel && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                avg response <span className="font-semibold text-foreground">{stats.avgLabel}</span>
              </span>
            )}
          </div>
          <ChannelSwitcher
            selectedChannel={selectedChannel}
            onChannelChange={setSelectedChannel}
          />
        </div>
      )}
      <div className="flex-1 overflow-y-auto space-y-2 p-1">
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-8">Loading conversation…</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">No messages yet.</div>
        ) : (
          messages.map((m) => {
            const out = m.direction === 'outgoing';
            const StatusIcon = m.status === 'read' || m.status === 'delivered' ? CheckCheck : Check;
            const statusColor = m.status === 'read' ? 'text-blue-300' : m.status === 'delivered' ? 'text-emerald-300' : 'text-white/50';
            const channelStyle = CHANNEL_STYLE[m.channel || 'personal'];
            const ChannelIcon = channelStyle?.icon || User;
            return (
              <div key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm relative ${out ? 'bg-emerald-600/90 text-white rounded-br-sm' : 'bg-white/10 rounded-bl-sm'}`} style={{ borderLeft: out ? 'none' : `3px solid ${m.channel === 'business' ? 'hsl(152 69% 40%)' : 'hsl(217 91% 60%)'}` }}>
                  <div className="whitespace-pre-wrap break-words">{m.text}</div>
                  <div className={`mt-1 text-[10px] flex items-center gap-1.5 ${out ? 'text-white/70' : 'text-muted-foreground'} ${out ? 'justify-end' : ''}`}>
                    {fmt(m.timestamp)}
                    {out && (
                      <>
                        <StatusIcon className={`w-3 h-3 ${statusColor}`} />
                        <span className="flex items-center gap-0.5">
                          <ChannelIcon className="w-2.5 h-2.5" />
                          {m.channel === 'business' ? 'Business' : 'Personal'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={submit} className="space-y-2 pt-2 border-t border-white/10">
        <div className="flex items-center gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={landlord?.phone ? 'Type a WhatsApp reply…' : 'No phone number on file'}
            disabled={!landlord?.phone || sendMutation.isPending}
            className="flex-1"
          />
          <Button type="submit" disabled={!text.trim() || sendMutation.isPending}>
            {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}