import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Send, Loader2, Sparkles, RefreshCw, ChevronDown } from 'lucide-react';
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

// Channel preference persisted per landlord in localStorage
function getStoredChannel(landlordId) {
  try { return localStorage.getItem(`channel_${landlordId}`) || 'personal'; } catch { return 'personal'; }
}
function setStoredChannel(landlordId, ch) {
  try { localStorage.setItem(`channel_${landlordId}`, ch); } catch {}
}

export default function LandlordConversationPanel({ landlord }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const scrollContainerRef = useRef(null);
  const bottomRef = useRef(null);
  const [showNewPill, setShowNewPill] = useState(false);
  const prevCountRef = useRef(0);
  const [channel, setChannel] = useState(() => getStoredChannel(landlord?.id));
  const [blockedWindow, setBlockedWindow] = useState(false); // API 24h window blocked

  // Reset channel prefs when landlord changes
  useEffect(() => {
    setChannel(getStoredChannel(landlord?.id));
    setBlockedWindow(false);
  }, [landlord?.id]);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['landlord-messages', landlord?.id],
    queryFn: () => base44.entities.Message.filter({ landlord_id: landlord.id }, 'timestamp', 500),
    enabled: !!landlord?.id,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });

  const { data: insight, isLoading: insightLoading } = useQuery({
    queryKey: ['landlord-insight', landlord?.id],
    queryFn: async () => {
      const rows = await base44.entities.ConversationInsight.filter({ landlord_id: landlord.id }, '-last_analyzed_at', 1);
      return rows?.[0] || null;
    },
    enabled: !!landlord?.id,
  });

  // Smart scroll helpers
  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
    setShowNewPill(false);
  }, []);

  // On initial load, jump to bottom immediately (no animation)
  useEffect(() => {
    if (messages.length > 0 && prevCountRef.current === 0) {
      scrollToBottom('instant');
      prevCountRef.current = messages.length;
    }
  }, [messages.length]);

  // On subsequent new messages, smart scroll
  useEffect(() => {
    if (messages.length <= prevCountRef.current) return;
    const isNew = prevCountRef.current > 0; // skip the initial load case handled above
    prevCountRef.current = messages.length;
    if (!isNew) return;
    if (isNearBottom()) {
      scrollToBottom();
    } else {
      setShowNewPill(true);
    }
  }, [messages.length]);

  const switchToPersonal = () => {
    setChannel('personal');
    setStoredChannel(landlord?.id, 'personal');
    setBlockedWindow(false);
  };

  const sendMutation = useMutation({
    mutationFn: async (msg) => {
      if (channel === 'personal') {
        // Existing personal channel — sendEvolutionMessage, unchanged
        return base44.functions.invoke('sendEvolutionMessage', { landlord_id: landlord.id, text: msg });
      } else {
        // API channel — sendApiWhatsApp directly with the landlord's phone
        const phone = String(landlord.phone || landlord.whatsapp || '').replace(/\D/g, '');
        if (!phone) throw new Error('Landlord has no phone number');
        const res = await base44.functions.invoke('sendApiWhatsApp', {
          phone,
          message: msg,
          message_kind: 'freeform',
          skip_quiet_check: true, // human typing, not automation
        });
        const result = res?.data ?? res;
        if (result?.status === 'blocked_window') {
          // Surface the 24h window notice — do NOT throw, just return so onSuccess can handle it
          return { __blocked_window: true };
        }
        if (result?.status !== 'sent') {
          throw new Error(result?.error || 'API send failed');
        }
        // Save Message record so it appears in the landlord thread
        await base44.entities.Message.create({
          landlord_id: landlord.id,
          phone: String(landlord.phone || landlord.whatsapp || '').replace(/\D/g, ''),
          direction: 'outgoing',
          text: msg,
          timestamp: new Date().toISOString(),
          status: 'sent',
          channel: 'api',
        });
        return result;
      }
    },
    onSuccess: (res) => {
      const data = res?.data ?? res;
      // 24h window blocked — show inline notice, don't clear text
      if (data?.__blocked_window || res?.__blocked_window) {
        setBlockedWindow(true);
        return;
      }
      if (data?.error) { toast.error(`Send failed: ${data.error}${data.detail ? ' — ' + data.detail : ''}`); return; }
      setBlockedWindow(false);
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

  const toggleChannel = () => {
    const next = channel === 'personal' ? 'api' : 'personal';
    setChannel(next);
    setStoredChannel(landlord?.id, next);
    setBlockedWindow(false);
  };

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
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
            <Send className="w-4 h-4" /> WhatsApp
          </div>
          {/* Channel toggle */}
          <button
            type="button"
            onClick={toggleChannel}
            title="Toggle send channel"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
            style={channel === 'personal'
              ? { background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }
              : { background: 'rgba(245,158,11,0.15)', color: 'hsl(38 92% 60%)', border: '1px solid rgba(245,158,11,0.3)' }
            }
          >
            {channel === 'personal' ? '📱 Personal' : '☁️ Business'}
          </button>
        </div>
        <div className="flex-1 relative min-h-0">
          <div ref={scrollContainerRef} className="h-full overflow-y-auto space-y-2 p-1">
            {isLoading ? (
              <div className="text-sm text-muted-foreground text-center py-8">Loading…</div>
            ) : messages.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">No messages yet.</div>
            ) : (
              messages.map((m) => {
                const out = m.direction === 'outgoing';
                const isApi = m.channel === 'api';
                return (
                  <div key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${out ? 'text-white rounded-br-sm' : 'bg-white/10 rounded-bl-sm'}`}
                      style={out
                        ? isApi
                          ? { background: 'rgba(245,158,11,0.25)', borderLeft: '3px solid hsl(38 92% 50%)' }
                          : { background: 'rgba(16,185,129,0.7)' }
                        : isApi
                          ? { background: 'rgba(245,158,11,0.08)', borderLeft: '2px solid rgba(245,158,11,0.4)' }
                          : {}
                      }
                    >
                      {isApi && (
                        <div className="text-[9px] font-semibold uppercase mb-0.5" style={{ color: out ? 'rgba(255,255,255,0.65)' : 'rgba(245,158,11,0.8)' }}>
                          ☁️ Business
                        </div>
                      )}
                      <div className="whitespace-pre-wrap break-words">{m.text}</div>
                      <div className={`mt-1 text-[10px] ${out ? 'text-white/70' : 'text-muted-foreground'}`}>
                        {fmt(m.timestamp)}{m.status ? ` · ${m.status}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
          {showNewPill && (
            <button
              onClick={() => scrollToBottom()}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg z-10"
              style={{ background: 'hsl(38 92% 50%)', color: 'hsl(222 47% 11%)' }}
            >
              <ChevronDown className="w-3.5 h-3.5" /> New message
            </button>
          )}
        </div>
        {/* 24h window blocked notice */}
        {blockedWindow && (
          <div className="mx-1 mb-2 rounded-lg px-3 py-2 text-[11px] leading-relaxed" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: 'hsl(38 92% 65%)' }}>
            ⚠️ This contact hasn't messaged the Business number in 24h — Meta only allows template messages.{' '}
            <button type="button" onClick={switchToPersonal} className="underline font-semibold" style={{ color: '#34d399' }}>
              Switch to Personal instead?
            </button>
          </div>
        )}
        <form onSubmit={submit} className="flex items-center gap-2 pt-2 border-t border-white/10">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={landlord?.phone ? `Type a reply via ${channel === 'personal' ? 'Personal' : 'Business'}…` : 'No phone number on file'}
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