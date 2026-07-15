// FlowComposer — smart multi-channel composer for the Flow command center.
//
// Default send channel = channel of the landlord's most recent inbound message.
// Fallback order if that's unavailable: iMessage (if imessage_status='available'),
// then WhatsApp, then Telegram (if telegram_chat_id exists), then Email.
//
// A small chip above the input shows the target channel/line; tapping it
// cycles through available channels.
//
// Sending routes ONLY through existing send functions:
//   WhatsApp  → sendMultiChannelWhatsApp
//   iMessage  → sendIMessage
//   Telegram  → sendTelegram
//   Email     → sendLandlordEmail

import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { MessageCircle, Send, Mail, MessageSquare, Loader2, ChevronDown } from 'lucide-react';
import DictationMicButton from '@/components/shared/DictationMicButton';

const CHANNELS = [
  { key: 'whatsapp', icon: MessageCircle, color: '#25D366', label: 'WhatsApp', waChannel: 'personal' },
  { key: 'imessage', icon: MessageSquare, color: '#0A84FF', label: 'iMessage' },
  { key: 'telegram', icon: Send, color: '#29b6f6', label: 'Telegram' },
  { key: 'email', icon: Mail, color: 'hsl(38 92% 55%)', label: 'Email' },
];

function css(str) {
  const o = {};
  String(str).split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) return;
    o[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  });
  return o;
}

function plainTextToHtml(text) {
  const escaped = String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.split(/\n{2,}/).map((p) => `<p style="text-align:left;">${p.replace(/\n/g, '<br/>')}</p>`).join('');
}

export default function FlowComposer({ landlord, thread, onSent, aiDraftFields }) {
  const [text, setText] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [waChannel, setWaChannel] = useState('personal');
  const [emailSubject, setEmailSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [channelMenuOpen, setChannelMenuOpen] = useState(false);
  const taRef = useRef(null);

  // Determine available channels and default channel
  const availableChannels = CHANNELS.filter((c) => {
    if (c.key === 'whatsapp') return landlord?.phone || landlord?.whatsapp;
    if (c.key === 'imessage') return landlord?.imessage_status === 'available';
    if (c.key === 'telegram') return !!landlord?.telegram_chat_id;
    if (c.key === 'email') return !!landlord?.email;
    return false;
  });

  useEffect(() => {
    if (!landlord) return;
    // Default: channel of most recent inbound message
    const inbound = [...thread].reverse().find((m) => m.direction === 'inbound');
    let defaultCh = null;
    if (inbound) {
      defaultCh = inbound.channel;
      if (inbound.wa_channel) setWaChannel(inbound.wa_channel);
    }
    // Fallback order
    if (!defaultCh) {
      if (landlord.imessage_status === 'available') defaultCh = 'imessage';
      else if (landlord.phone || landlord.whatsapp) defaultCh = 'whatsapp';
      else if (landlord.telegram_chat_id) defaultCh = 'telegram';
      else if (landlord.email) defaultCh = 'email';
    }
    // Only set if the channel is available
    const chMeta = CHANNELS.find((c) => c.key === defaultCh);
    if (chMeta && availableChannels.some((c) => c.key === defaultCh)) {
      setChannel(defaultCh);
    } else if (availableChannels.length > 0) {
      setChannel(availableChannels[0].key);
    }
    setText('');
    setEmailSubject('');
  }, [landlord?.id]);

  const activeChannel = CHANNELS.find((c) => c.key === channel) || CHANNELS[0];
  const Icon = activeChannel.icon;

  const handleSend = async () => {
    if (!text.trim() || !landlord) return;
    if (sending) return;
    setSending(true);
    try {
      // AI draft provenance
      const { messageAiSource, messageAiDraft } = aiDraftFields || {};
      const createdFromAi = !!messageAiSource;
      const wasEdited = createdFromAi ? (text.trim() !== (messageAiDraft || '').trim()) : false;
      const aiDisposition = createdFromAi ? (wasEdited ? 'edited' : 'accepted') : undefined;

      if (channel === 'whatsapp') {
        const res = await base44.functions.invoke('sendMultiChannelWhatsApp', {
          landlord_id: landlord.id, text: text.trim(), channel: waChannel,
          created_from_ai: createdFromAi,
          ai_source: createdFromAi ? messageAiSource : undefined,
          ai_draft_text: createdFromAi ? messageAiDraft : undefined,
          was_edited_after_draft: wasEdited,
          ai_disposition: aiDisposition,
        });
        const data = res?.data ?? res;
        if (data?.error) throw new Error(data.error);
      } else if (channel === 'imessage') {
        const res = await base44.functions.invoke('sendIMessage', { landlord_id: landlord.id, text: text.trim() });
        const data = res?.data ?? res;
        if (data?.fallback === 'whatsapp' || (data?.error && /no imessage/i.test(data.error))) {
          toast.error('No iMessage handle — try WhatsApp instead.');
          setSending(false);
          return;
        }
        if (data?.error) throw new Error(data.error);
      } else if (channel === 'telegram') {
        const res = await base44.functions.invoke('sendTelegram', { landlord_id: landlord.id, text: text.trim() });
        const data = res?.data ?? res;
        if (data?.fallback === 'whatsapp' || (data?.error && /no telegram chat/i.test(data.error))) {
          toast.error('No Telegram chat — try WhatsApp instead.');
          setSending(false);
          return;
        }
        if (data?.error) throw new Error(data.error);
      } else if (channel === 'email') {
        const res = await base44.functions.invoke('sendLandlordEmail', {
          to: landlord.email, subject: emailSubject.trim() || 'Re: your property',
          body_html: plainTextToHtml(text.trim()), landlord_id: landlord.id,
        });
        const data = res?.data ?? res;
        if (!data?.ok && data?.error) throw new Error(data.error);
      }

      toast.success('Sent ✓');
      setText('');
      setEmailSubject('');
      if (aiDraftFields?.onClear) aiDraftFields.onClear();
      if (onSent) onSent({ channel, text: text.trim() });
    } catch (e) {
      toast.error(e?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // When an AI suggestion is picked, it sets text via aiDraftFields.setText
  useEffect(() => {
    if (aiDraftFields?.text && aiDraftFields.text !== text) {
      setText(aiDraftFields.text);
      if (taRef.current) {
        taRef.current.focus();
        taRef.current.scrollTop = taRef.current.scrollHeight;
      }
    }
  }, [aiDraftFields?.text]);

  return (
    <div style={css("padding:10px 14px; border-top:1px solid rgba(255,255,255,0.08); flex:none;")}>
      {/* Channel selector chip */}
      <div style={css("display:flex; align-items:center; gap:6px; margin-bottom:7px; position:relative;")}>
        <button type="button" onClick={() => setChannelMenuOpen(!channelMenuOpen)}
          style={css("display:inline-flex; align-items:center; gap:5px; padding:3px 9px 3px 7px; border-radius:99px; cursor:pointer; font-family:'Inter',sans-serif; font-size:10px; font-weight:600; transition:background 0.12s;")}
          {...({})}>
          <Icon size={11} style={{ color: activeChannel.color, flex: 'none' }} />
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>{activeChannel.label}</span>
          {channel === 'whatsapp' && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', textTransform: 'capitalize' }}>({waChannel})</span>}
          <ChevronDown size={10} style={{ color: 'rgba(255,255,255,0.4)' }} />
        </button>
        {channelMenuOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setChannelMenuOpen(false)} />
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50, background: '#1a2235', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 9, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden', minWidth: 140 }}>
              {availableChannels.map((c) => (
                <button key={c.key} type="button"
                  onClick={() => { setChannel(c.key); setChannelMenuOpen(false); }}
                  style={css("display:flex; align-items:center; gap:7px; width:100%; padding:7px 10px; cursor:pointer; font-family:'Inter',sans-serif; font-size:11px; font-weight:600; background:transparent; border:none; color:" + (channel === c.key ? 'hsl(38 92% 60%)' : 'rgba(255,255,255,0.7)') + ';' + (channel === c.key ? 'background:rgba(255,255,255,0.06);' : ''))}>
                  <c.icon size={12} style={{ color: c.color, flex: 'none' }} />
                  {c.label}
                </button>
              ))}
            </div>
          </>
        )}
        {aiDraftFields?.messageAiSource && (
          <span style={css("font-size:8px; font-weight:600; padding:1px 6px; border-radius:99px; background:rgba(139,92,246,0.15); color:#c4b5fd; display:inline-flex; align-items:center; gap:3px;")}>
            ✨ AI draft loaded
          </span>
        )}
      </div>

      {/* Email subject (email only) */}
      {channel === 'email' && (
        <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Subject"
          style={css("width:100%; padding:6px 10px; border-radius:8px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.9); font-size:12px; font-family:'Inter',sans-serif; outline:none; margin-bottom:6px;")} />
      )}

      {/* Text area + send button */}
      <div style={css("display:flex; align-items:flex-end; gap:8px;")}>
        <textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={handleKeyDown}
          placeholder={`Send via ${activeChannel.label}…`}
          rows={1}
          style={css("flex:1; resize:none; min-height:38px; max-height:120px; padding:8px 12px; border-radius:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.9); font-size:13px; font-family:'Inter',sans-serif; line-height:1.5; outline:none; overflow-y:auto;")} />
        <DictationMicButton value={text} onChange={(val) => setText(val)} />
        <button type="button" onClick={handleSend} disabled={!text.trim() || sending}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 10,
            cursor: (!text.trim() || sending) ? 'not-allowed' : 'pointer', flex: 'none', transition: 'opacity 0.15s',
            background: (!text.trim() || sending) ? 'rgba(255,255,255,0.08)' : `linear-gradient(180deg, ${activeChannel.color}, ${activeChannel.color}dd)`,
            color: (!text.trim() || sending) ? 'rgba(255,255,255,0.3)' : '#0a0e1a',
            border: 'none', opacity: sending ? 0.6 : 1,
          }}>
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
        </button>
      </div>
    </div>
  );
}