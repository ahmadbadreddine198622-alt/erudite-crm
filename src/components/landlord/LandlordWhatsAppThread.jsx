import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Send, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Two-way WhatsApp thread for a landlord. Reads Message records (Evolution/Message
// entity) and sends replies via the sendEvolutionMessage backend function.
export default function LandlordWhatsAppThread({ landlord }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['landlord-messages', landlord?.id],
    // filter(filterObj, sort, limit) — 'timestamp' ascending = oldest -> newest (chat style)
    queryFn: () => base44.entities.Message.filter({ landlord_id: landlord.id }, 'timestamp', 500),
    enabled: !!landlord?.id,
  });

  const sendMutation = useMutation({
    mutationFn: (msg) => base44.functions.invoke('sendEvolutionMessage', { landlord_id: landlord.id, text: msg }),
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

  return (
    <div className="flex flex-col h-[420px]">
      <div className="flex-1 overflow-y-auto space-y-2 p-1">
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-8">Loading conversation…</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">No messages yet.</div>
        ) : (
          messages.map((m) => {
            const out = m.direction === 'outgoing';
            return (
              <div key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${out ? 'bg-emerald-600/90 text-white rounded-br-sm' : 'bg-white/10 rounded-bl-sm'}`}>
                  <div className="whitespace-pre-wrap break-words">{m.text}</div>
                  <div className={`mt-1 text-[10px] ${out ? 'text-white/70' : 'text-muted-foreground'}`}>
                    {fmt(m.timestamp)}{m.status ? ` · ${m.status}` : ''}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 pt-2 border-t border-white/10">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={landlord?.phone ? 'Type a WhatsApp reply…' : 'No phone number on file'}
          disabled={!landlord?.phone || sendMutation.isPending}
        />
        <Button type="submit" disabled={!text.trim() || sendMutation.isPending}>
          {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  );
}
