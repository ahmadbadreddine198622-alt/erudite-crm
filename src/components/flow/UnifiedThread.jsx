// UnifiedThread — center panel of Flow. Loads and merges all message records
// for a landlord into a single chronological stream.
//
// Sources merged (excluding is_deleted=true):
//   Message (WhatsApp) — direction: incoming/outgoing
//   IMessage — direction: inbound/outbound
//   TelegramMessage — direction: inbound/outbound
//   Email — direction: inbound/outbound
//
// Direction is normalized to 'inbound' (from landlord) / 'outbound' (from agent).
// Translated text and transcripts are shown inline under the original.

import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, MessageCircle, Send, Mail, MessageSquare } from 'lucide-react';

const CHANNEL_META = {
  whatsapp: { icon: MessageCircle, color: '#25D366', label: 'WA' },
  imessage: { icon: MessageSquare, color: '#0A84FF', label: 'iMsg' },
  telegram: { icon: Send, color: '#29b6f6', label: 'TG' },
  email: { icon: Mail, color: 'hsl(38 92% 55%)', label: 'Mail' },
};

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function normalizeDirection(raw) {
  if (raw === 'incoming' || raw === 'inbound') return 'inbound';
  if (raw === 'outgoing' || raw === 'outbound') return 'outbound';
  return 'outbound';
}

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

export default function UnifiedThread({ landlordId, onThreadLoaded }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!landlordId) { setItems([]); setLoading(false); return; }
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const [messages, imessages, tgrams, emails] = await Promise.all([
          base44.entities.Message.filter({ landlord_id: landlordId, is_deleted: { $ne: true } }, 'timestamp', 200).catch(() => []),
          base44.entities.IMessage.filter({ landlord_id: landlordId }, 'sent_at', 200).catch(() => []),
          base44.entities.TelegramMessage.filter({ landlord_id: landlordId }, 'sent_at', 200).catch(() => []),
          base44.entities.Email.filter({ landlord_id: landlordId }, 'received_at', 200).catch(() => []),
        ]);

        const merged = [];
        for (const m of messages) {
          if (m.is_deleted) continue;
          merged.push({
            id: 'wa_' + m.id, channel: 'whatsapp', direction: normalizeDirection(m.direction),
            text: m.text || '', timestamp: m.timestamp,
            translated_text: m.translated_text || '', transcript: m.transcript || '',
            wa_channel: m.channel,
          });
        }
        for (const m of imessages) {
          merged.push({ id: 'im_' + m.id, channel: 'imessage', direction: normalizeDirection(m.direction), text: m.body || '', timestamp: m.sent_at });
        }
        for (const m of tgrams) {
          merged.push({ id: 'tg_' + m.id, channel: 'telegram', direction: normalizeDirection(m.direction), text: m.body || '', timestamp: m.sent_at });
        }
        for (const m of emails) {
          merged.push({
            id: 'em_' + m.id, channel: 'email', direction: normalizeDirection(m.direction),
            text: m.body_text || m.snippet || '', timestamp: m.received_at,
            subject: m.subject || '', from: m.from_email || '',
          });
        }

        merged.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
        if (mounted) {
          setItems(merged);
          setLoading(false);
          if (onThreadLoaded) onThreadLoaded(merged);
          requestAnimationFrame(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          });
        }
      } catch {
        if (mounted) { setLoading(false); }
      }
    })();
    return () => { mounted = false; };
  }, [landlordId]);

  if (loading) {
    return (
      <div style={css("display:flex; align-items:center; justify-content:center; height:100%;")}>
        <Loader2 className="animate-spin" style={{ color: 'hsl(38 92% 50%)' }} size={22} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={css("display:flex; align-items:center; justify-content:center; height:100%;")}>
        <span style={css("font-size:13px; color:rgba(255,255,255,0.3); font-family:'Inter',sans-serif;")}>No messages yet for this landlord.</span>
      </div>
    );
  }

  return (
    <div ref={scrollRef} style={css("flex:1; overflow-y:auto; padding:16px 14px; display:flex; flex-direction:column; gap:8px;")}>
      {items.map((item) => {
        const meta = CHANNEL_META[item.channel] || CHANNEL_META.whatsapp;
        const Icon = meta.icon;
        const isInbound = item.direction === 'inbound';
        return (
          <div key={item.id} style={css("display:flex; flex-direction:column; gap:3px; max-width:82%; ") + (isInbound ? 'align-self:flex-start;' : 'align-self:flex-end; align-items:flex-end;')}>
            <div style={css("display:flex; align-items:center; gap:5px; padding:0 4px;")}>
              <Icon size={11} style={{ color: meta.color, flex: 'none' }} />
              {item.subject && <span style={css("font-size:9px; font-weight:600; color:rgba(255,255,255,0.4);")}>{item.subject}</span>}
              <span style={css("font-size:9px; color:rgba(255,255,255,0.3);")}>{formatTime(item.timestamp)}</span>
            </div>
            <div style={{
              padding: '8px 12px', borderRadius: 14, fontSize: 13, lineHeight: 1.5, fontFamily: "'Inter',sans-serif",
              wordBreak: 'break-word', whiteSpace: 'pre-wrap',
              background: isInbound ? 'rgba(255,255,255,0.07)' : 'linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%))',
              color: isInbound ? 'rgba(255,255,255,0.9)' : '#1a1205',
              borderBottomLeftRadius: isInbound ? 4 : 14,
              borderBottomRightRadius: isInbound ? 14 : 4,
              border: isInbound ? '1px solid rgba(255,255,255,0.1)' : 'none',
            }}>
              {item.text || '(empty)'}
            </div>
            {/* Translation / transcript inline */}
            {item.translated_text && (
              <div style={css("padding:4px 8px; font-size:11px; color:rgba(255,255,255,0.45); line-height:1.4; border-left:2px solid rgba(255,255,255,0.12); margin:2px 4px 0; border-radius:2px;")}>
                <span style={css("font-size:8px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.3); display:block; margin-bottom:2px;")}>EN translation</span>
                {item.translated_text}
              </div>
            )}
            {item.transcript && item.transcript !== item.text && (
              <div style={css("padding:4px 8px; font-size:11px; color:rgba(255,255,255,0.45); line-height:1.4; border-left:2px solid rgba(255,255,255,0.12); margin:2px 4px 0; border-radius:2px;")}>
                <span style={css("font-size:8px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.3); display:block; margin-bottom:2px;")}>Transcript</span>
                {item.transcript}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}