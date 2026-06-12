import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Send, Loader2, MessageSquare, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const fmt = (ts) => { try { return ts ? format(new Date(ts), 'd MMM, HH:mm') : ''; } catch { return ''; } };

export default function LandlordSMSPanel({ landlord }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const messagesEndRef = useRef(null);
  const phone = landlord?.phone;

  // Fetch SMS history stored as CallLog records with landlord_id
  const { data: smsList = [], isLoading, refetch } = useQuery({
    queryKey: ['landlord-sms', landlord?.id],
    queryFn: () => base44.entities.CallLog.filter({ landlord_id: landlord.id }, '-started_at', 100),
    enabled: !!landlord?.id,
    refetchInterval: 15000,
    select: (data) => data.filter(r => r.notes || r.transcript), // only ones with SMS body
  });

  const sendMutation = useMutation({
    mutationFn: async (msg) => {
      // 1. Send via Twilio
      const res = await base44.functions.invoke('twilioSendSMS', { to_phone: phone, body: msg });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);

      // 2. Record in CallLog for history
      await base44.entities.CallLog.create({
        landlord_id: landlord.id,
        direction: 'outbound',
        to_number: phone,
        status: 'completed',
        started_at: new Date().toISOString(),
        notes: msg,
      });

      return data;
    },
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['landlord-sms', landlord?.id] });
      toast.success('SMS sent');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
    },
    onError: (e) => toast.error('SMS failed: ' + (e?.message || 'Unknown error')),
  });

  const handleSend = (e) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    if (!phone) { toast.error('No phone number on record'); return; }
    sendMutation.mutate(t);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex flex-col h-[500px]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">SMS via Twilio</p>
            {phone && (
              <p className="text-[10px] flex items-center gap-1" style={{ color: 'hsl(38 92% 55%)' }}>
                <Phone className="w-2.5 h-2.5" /> {phone}
              </p>
            )}
          </div>
        </div>
        <p className="ml-auto text-[10px] text-muted-foreground">Inbound SMS appear when Twilio webhook is configured</p>
      </div>

      {/* SMS thread */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {isLoading ? (
          <div className="text-xs text-muted-foreground text-center py-8 flex items-center justify-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading…
          </div>
        ) : !phone ? (
          <div className="text-xs text-muted-foreground text-center py-10">No phone number on record for this landlord.</div>
        ) : smsList.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-10">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-2">
              <MessageSquare className="w-5 h-5 opacity-40" />
            </div>
            No SMS history yet.<br />
            <span className="opacity-60">Send your first message below.</span>
          </div>
        ) : (
          smsList.map((sms) => {
            const out = sms.direction === 'outbound';
            const body = sms.notes || sms.transcript || '';
            return (
              <div key={sms.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${out ? 'bg-blue-600/80 text-white rounded-br-sm' : 'bg-white/10 rounded-bl-sm'}`}>
                  <div className="whitespace-pre-wrap break-words">{body}</div>
                  <div className={`mt-1 text-[10px] ${out ? 'text-white/60 text-right' : 'text-muted-foreground'}`}>
                    {fmt(sms.started_at || sms.created_date)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <form onSubmit={handleSend} className="pt-2 border-t border-white/10">
        <div className="flex gap-2 items-end">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={phone ? 'Type SMS message… (Enter to send)' : 'No phone number on file'}
            disabled={!phone || sendMutation.isPending}
            rows={2}
            className="flex-1 text-sm resize-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!text.trim() || !phone || sendMutation.isPending}
            className="h-[60px] w-10 shrink-0"
          >
            {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Sent via your Twilio SMS number</p>
      </form>
    </div>
  );
}