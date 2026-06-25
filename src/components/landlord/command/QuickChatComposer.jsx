// Minimal free-text composer for WhatsApp / Telegram — reuses the EXISTING send functions
// (sendMultiChannelWhatsApp / sendTelegram). No forked logic. Used inside ComposerModal.
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { PALETTE } from './cmdHelpers';

export default function QuickChatComposer({ landlordId, channel, prefill = '', onSent }) {
  const [text, setText] = useState(prefill);
  const [sending, setSending] = useState(false);
  useEffect(() => { setText(prefill); }, [prefill]);

  const isTelegram = channel === 'telegram';
  const accent = isTelegram ? '#29b6f6' : PALETTE.green;

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const fn = isTelegram ? 'sendTelegram' : 'sendMultiChannelWhatsApp';
      const payload = isTelegram ? { landlord_id: landlordId, text: body } : { landlord_id: landlordId, text: body, channel: 'personal' };
      const res = await base44.functions.invoke(fn, payload);
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      toast.success(isTelegram ? 'Telegram sent' : 'WhatsApp sent');
      setText('');
      onSent?.({ text: body, channel });
    } catch (e) {
      toast.error('Failed to send: ' + (e?.message || 'unknown error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={isTelegram ? 'Type a Telegram message…' : 'Type a WhatsApp message…'}
        className="w-full rounded-lg p-3 text-[13px] resize-y"
        style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${PALETTE.cardBorder}`, color: PALETTE.text, minHeight: 90 }}
      />
      <button onClick={send} disabled={sending || !text.trim()} className="h-10 rounded-lg text-[13px] font-bold" style={{ background: accent, color: '#06121f', opacity: sending || !text.trim() ? 0.6 : 1 }}>
        {sending ? 'Sending…' : `Send ${isTelegram ? 'Telegram' : 'WhatsApp'}`}
      </button>
    </div>
  );
}