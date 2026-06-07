import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Send, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const TEMP_COLOR = { hot: '#ef4444', warm: '#f59e0b', cold: '#60a5fa' };

function Section({ title, children }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{title}</div>
      <p className="leading-relaxed whitespace-pre-wrap">{children}</p>
    </div>
  );
}

export default function LandlordConversationPanel({ landlord }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['landlord-messages', landlord?.id],
    queryFn: () => base44.entities.Message.filter({ landlord_id: landlord.id }, 'timestamp', 500),
    enabled: !!landlord?.id,
  });

  const { data: insight, isLoading: insightLoading } = useQuery({
    queryKey: ['landlord-insight', landlord?.id],
    queryFn: async () => {
      const rows = await base44.entities.ConversationInsight.filter({ landlord_id: landlord.id }, '-last_analyzed_at', 1);
      return rows?.[0] || null;
    },
    enabled: !!landlord?.id,
  });

  const sendMutation = useMutation({
    mutationFn: (msg) => base44.functions.invoke('sendEvolutionMessage', { landlord_id: landlord.id, text: msg }),
    onSuccess: (res) => {
      const data = res?.data ?? res;
      if (data?.error) { toast.error(`Send failed: ${data.error}${data.detail ? ' — ' + data.detail : ''}`); return; }
      setText('');
      qc.invalidateQueries({ queryKey: ['landlord-messages', landlord.id] });
      toast.success('Message sent');
    },
    onError: (e) => {
      const msg = e?.response?.data?.error || e?.response?.data?.detail || e?.message || 'Unknown error';
      toast.error(`Send failed: ${msg}`);
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: () => base44.functions.invoke('analyzeLandlordConversation', { landlord_id: landlord.id }),
    onSuccess: (res) => {
      const data = res?.data ?? res;
      if (data?.error) { toast.error(`Analysis failed: ${data.error}`); return; }
      toast.success('Analyzing conversation…');
      setTimeout(() => qc.invalidateQueries({ queryKey: ['landlord-insight', landlord.id] }), 12000);
    },
    onError: (e) => toast.error(`Analysis failed: ${e?.message || 'error'}`),
  });

  const fmt = (ts) => { try { return ts ? format(new Date(ts), 'd MMM, HH:mm') : ''; } catch { return ts || ''; } };

  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    if (!landlord?.phone) { toast.error('This landlord has no phone number to message.'); return; }
    sendMutation.mutate(t);
  };

  const temp = insight?.temperature;
  const suggestions = Array.isArray(insight?.suggestions) ? insight.suggestions : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {/* LEFT: WhatsApp thread */}
      <div className="flex flex-col h-[460px] rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2 mb-2 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
          <Send className="w-4 h-4" /> WhatsApp
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 p-1">
          {isLoading ? (
            <div className="text-sm text-muted-foreground text-center py-8">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">No messages yet.</div>
          ) : (
            messages.map((m) => {
              const out = m.direction === 'outgoing';
              return (
                <div key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${out ? 'bg-emerald-600/90 text-white rounded-br-sm' : 'bg-white/10 rounded-bl-sm'}`}>
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

      {/* RIGHT: AI insights */}
      <div className="flex flex-col h-[460px] rounded-xl p-3 overflow-y-auto" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'rgb(167,139,250)' }}>
            <Sparkles className="w-4 h-4" /> AI Insights
          </div>
          <div className="flex items-center gap-2">
            {temp && (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full" style={{ color: TEMP_COLOR[temp] || '#aaa', border: `1px solid ${TEMP_COLOR[temp] || '#aaa'}` }}>{temp}</span>
            )}
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending || messages.length === 0} title="Re-analyze conversation">
              {analyzeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        {insightLoading ? (
          <div className="text-sm text-muted-foreground text-center py-8">Loading…</div>
        ) : !insight ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No AI analysis yet.{messages.length > 0 ? ' Tap the refresh icon to analyze this conversation.' : ' Analysis runs automatically when messages arrive.'}
          </div>
        ) : (
          <div className="space-y-3 text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {insight.summary && <Section title="Summary">{insight.summary}</Section>}
            {insight.conversation_stage && <Section title="Stage">{insight.conversation_stage}</Section>}
            {insight.key_facts && <Section title="Key facts">{insight.key_facts}</Section>}
            {insight.outstanding_items && <Section title="Outstanding">{insight.outstanding_items}</Section>}

            {suggestions.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'rgb(167,139,250)' }}>Suggested replies</div>
                <div className="space-y-2">
                  {suggestions.map((s, i) => (
                    <div key={i} className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{s.title || s.type}</span>
                        {s.type && <span className="text-[9px] uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(167,139,250,0.15)', color: 'rgb(167,139,250)' }}>{s.type}</span>}
                      </div>
                      {s.reason && <p className="mt-1 text-muted-foreground">{s.reason}</p>}
                      {s.suggested_message && (
                        <>
                          <p className="mt-1 italic" style={{ color: 'rgba(255,255,255,0.85)' }}>"{s.suggested_message}"</p>
                          <Button size="sm" variant="ghost" className="h-6 px-2 mt-1 text-[11px]" onClick={() => setText(s.suggested_message)}>Use this reply</Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {insight.last_analyzed_at && (
              <div className="text-[10px] text-muted-foreground pt-1">
                Analyzed {fmt(insight.last_analyzed_at)}{insight.language ? ` · ${insight.language}` : ''}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}