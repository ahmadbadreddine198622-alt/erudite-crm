// Suggested messages — each ai_suggested_messages item as a sub-card with badges,
// language-correct (RTL/Cyrillic) body, rationale, Copy + Send. Read-only consume.
import React, { useState } from 'react';
import { Copy, Send, Check } from 'lucide-react';
import { Card, Chip, textDir, GOLD } from './ccPrimitives';
import { toast } from 'sonner';

function MessageCard({ msg, onSend }) {
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const dir = textDir(msg.text);

  const copy = async () => {
    try { await navigator.clipboard.writeText(msg.text || ''); setCopied(true); setTimeout(() => setCopied(false), 1500); toast.success('Copied'); }
    catch { toast.error('Copy failed'); }
  };
  const send = async () => {
    if (sending) return;
    setSending(true);
    try { await onSend(msg); } finally { setSending(false); }
  };

  const badges = [msg.channel, msg.language, msg.tone, msg.intent, msg.mode].filter(Boolean);

  return (
    <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)', padding: '11px 12px' }}>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
        {badges.map((b, i) => <Chip key={i} label={b} style={{ fontSize: 9.5, padding: '2px 8px' }} />)}
      </div>
      <div dir={dir} style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.92)', whiteSpace: 'pre-wrap', textAlign: dir === 'rtl' ? 'right' : 'left' }}>{msg.text}</div>
      {msg.rationale && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 7, lineHeight: 1.4 }}>{msg.rationale}</div>}
      <div style={{ display: 'flex', gap: 7, marginTop: 9 }}>
        <button onClick={copy} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)', fontFamily: 'Montserrat,sans-serif' }}>
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy'}
        </button>
        <button onClick={send} disabled={sending} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: sending ? 'wait' : 'pointer', background: `${GOLD}1f`, border: `1px solid ${GOLD}66`, color: GOLD, fontFamily: 'Montserrat,sans-serif', opacity: sending ? 0.6 : 1 }}>
          <Send className="w-3 h-3" /> {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

export default function CCSuggestedMessages({ messages, onSend }) {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  return (
    <Card icon="💬" title="Suggested Messages" count={messages.length} accent={GOLD}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {messages.map((m, i) => <MessageCard key={i} msg={m} onSend={onSend} />)}
      </div>
    </Card>
  );
}