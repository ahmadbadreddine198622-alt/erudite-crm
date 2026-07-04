import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Send, Loader2, MessageSquare, Phone, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const fmt = (ts) => { try { return ts ? format(new Date(ts), 'd MMM, HH:mm') : ''; } catch { return ''; } };

export default function LandlordSMSPanel({ landlord }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [fromNumber, setFromNumber] = useState('');
  const messagesEndRef = useRef(null);
  const phone = landlord?.phone;

  // Fetch available Twilio numbers
  const { data: twilioData } = useQuery({
    queryKey: ['twilio-numbers'],
    queryFn: () => base44.functions.invoke('getTwilioNumbers', {}),
    select: (res) => res?.data,
    staleTime: 5 * 60 * 1000,
  });

  const twilioNumbers = twilioData?.numbers || [];
  const credential = twilioData?.credential;

  // Auto-select first SMS-capable number
  useEffect(() => {
    if (twilioNumbers.length > 0 && !fromNumber) {
      // Prefer the saved sms_number from credential, else first SMS-capable number
      const savedSmsNum = credential?.sms_number;
      if (savedSmsNum) {
        setFromNumber(savedSmsNum);
      } else {
        const smsCapable = twilioNumbers.find(n => n.capabilities?.sms) || twilioNumbers[0];
        if (smsCapable) setFromNumber(smsCapable.phone_number);
      }
    }
  }, [twilioNumbers, credential]);

  // Fetch SMS history stored as Activity records
  const { data: smsList = [], isLoading, refetch } = useQuery({
    queryKey: ['landlord-sms', landlord?.id],
    queryFn: async () => {
      // Try Activity table first (newer approach), fall back to CallLog
      const [activities, callLogs] = await Promise.all([
        base44.entities.Activity.filter({ lead_id: landlord.id, type: 'sms' }, '-scheduled_at', 100).catch(() => []),
        base44.entities.CallLog.filter({ landlord_id: landlord.id }, '-started_at', 100).catch(() => []),
      ]);
      const smsCallLogs = callLogs.filter(r => r.notes || r.transcript);
      // Merge: activity records + calllog records
      const merged = [
        ...activities.map(a => ({
          id: a.id,
          direction: a.direction,
          body: a.description || a.title || '',
          started_at: a.scheduled_at || a.created_date,
          from_number: a.metadata?.from_number || '',
          to_number: landlord.phone,
        })),
        ...smsCallLogs.map(c => ({
          id: c.id,
          direction: c.direction || 'outbound',
          body: c.notes || c.transcript || '',
          started_at: c.started_at || c.created_date,
          from_number: c.from_number || '',
          to_number: c.to_number || landlord.phone,
        })),
      ];
      // Sort by date desc
      return merged.sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
    },
    enabled: !!landlord?.id,
    refetchInterval: 20000,
  });

  const sendMutation = useMutation({
    mutationFn: async (msg) => {
      const res = await base44.functions.invoke('twilioSendSMS', {
        to_phone: phone,
        body: msg,
        from_phone: fromNumber || undefined,
        landlord_id: landlord.id,
      });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['landlord-sms', landlord?.id] });
      refetch();
      toast.success('SMS sent');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 300);
    },
    onError: (e) => toast.error('SMS failed: ' + (e?.message || 'Unknown error')),
  });

  const handleSend = (e) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    if (!phone) { toast.error('No phone number on record'); return; }
    if (!fromNumber) { toast.error('Please select a number to send from'); return; }
    sendMutation.mutate(t);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex flex-col h-[560px]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">SMS via Twilio</p>
          {phone && (
            <p className="text-[10px] flex items-center gap-1" style={{ color: 'hsl(38 92% 55%)' }}>
              <Phone className="w-2.5 h-2.5" /> To: {phone}
            </p>
          )}
        </div>
        <p className="ml-auto text-[10px] text-muted-foreground">Inbound SMS appear when Twilio webhook is configured</p>
      </div>

      {/* From number selector — compact inline */}
      {twilioNumbers.length > 0 && (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.38)' }}>From</span>
          <div className="relative flex-1">
            <select
              value={fromNumber}
              onChange={e => setFromNumber(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg appearance-none pr-7"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}
            >
              {twilioNumbers.map(n => (
                <option key={n.phone_number} value={n.phone_number} style={{ background: '#0d1b2a' }}>
                  {n.friendly_name || n.phone_number}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: 'rgba(255,255,255,0.4)' }} />
          </div>
        </div>
      )}
      {twilioNumbers.length === 0 && (
        <p className="text-[10px] text-muted-foreground mb-2">No Twilio numbers configured — set up in Twilio Hub</p>
      )}

      {/* SMS thread */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-2">
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
            const out = sms.direction !== 'inbound';
            return (
              <div key={sms.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${out ? 'bg-blue-600/80 text-white rounded-br-sm' : 'bg-white/10 rounded-bl-sm'}`}>
                  <div className="whitespace-pre-wrap break-words">{sms.body}</div>
                  <div className={`mt-1 text-[10px] flex items-center gap-1.5 ${out ? 'text-white/60 justify-end' : 'text-muted-foreground'}`}>
                    {sms.from_number && out && <span className="truncate max-w-[120px]">from {sms.from_number}</span>}
                    <span>{fmt(sms.started_at)}</span>
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
            placeholder={phone ? 'Type SMS… (Enter to send)' : 'No phone number on file'}
            disabled={!phone || sendMutation.isPending || twilioNumbers.length === 0}
            rows={1}
            className="flex-1 text-sm resize-none min-h-[36px]"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
          />
          <button
            type="submit"
            disabled={!text.trim() || !phone || !fromNumber || sendMutation.isPending}
            title="Send SMS"
            className="flex items-center justify-center w-9 h-9 shrink-0 rounded-lg transition-all border"
            style={{
              background: !text.trim() || sendMutation.isPending ? 'rgba(255,255,255,0.08)' : 'linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%))',
              color: !text.trim() || sendMutation.isPending ? 'rgba(255,255,255,0.4)' : '#1a1205',
              border: `1px solid ${!text.trim() || sendMutation.isPending ? 'rgba(255,255,255,0.1)' : 'hsl(38 92% 50% / 0.5)'}`,
              cursor: !text.trim() || sendMutation.isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {sendMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </form>
    </div>
  );
}