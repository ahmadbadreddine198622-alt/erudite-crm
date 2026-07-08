// NoteComposerBar — the textarea + send button for the Note/Task/Follow-up composers
// on LandlordDetailPage. Extracted to keep LandlordDetailPage under the line limit.
//
// For the Note type, a gold ✨ magic button is shown that calls the `magicReshapeNote`
// backend function — rewriting the agent's rough note into structured intelligence
// that educates the AI brain about barriers, new info, and next steps.
//
// Props:
//   composerRef     — ref forwarded to the textarea
//   value           — current composer text
//   onChange        — fn(e) called on textarea input
//   onKeyDown      — fn(e) called on keydown
//   onSend          — fn() called when the send button is clicked
//   placeholder     — textarea placeholder
//   composerType    — 'Note' | 'Task' | 'Follow-up'
//   landlordId      — current landlord id (for magic reshape)
//   busy            — bool, any sending/parsing in progress
//   composerParsing — bool, scribe brain parsing in progress

import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Sparkles, Loader2 } from 'lucide-react';

export default function NoteComposerBar({
  composerRef, value, onChange, onKeyDown, onSend,
  placeholder, composerType, landlordId, busy, composerParsing,
}) {
  const [magicBusy, setMagicBusy] = useState(false);
  const isNote = composerType === 'Note';
  const hasText = !!((value || '').trim());

  const runMagic = async () => {
    if (magicBusy || !hasText || !landlordId) return;
    setMagicBusy(true);
    try {
      const res = await base44.functions.invoke('magicReshapeNote', {
        landlord_id: landlordId,
        text: value,
      });
      const data = res?.data ?? res;
      if (!data?.ok) throw new Error(data?.error || 'Reshape failed');
      const msg = data.message || '';
      if (!msg) throw new Error('No message returned');
      // Use the real textarea DOM element as the event target so the parent's
      // onComposerInput can access .style and .scrollHeight for auto-grow.
      const ta = composerRef?.current;
      if (ta) { ta.value = msg; onChange({ target: ta }); }
      else { onChange({ target: { value: msg } }); }
      toast.success('✨ Note structured for the brain');
    } catch (e) {
      toast.error(e?.message || 'Magic reshape failed');
    } finally {
      setMagicBusy(false);
    }
  };

  const btnStyle = {
    flex: 'none', width: 38, height: 38, borderRadius: 10,
    border: '1px solid hsl(38 92% 50% / 0.5)',
    background: 'linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%))',
    color: '#1a1205', fontSize: 15, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: busy ? 0.6 : 1,
  };

  const magicBtnStyle = {
    flex: 'none', width: 38, height: 38, borderRadius: 10,
    background: magicBusy
      ? 'rgba(245,158,11,0.18)'
      : 'linear-gradient(135deg, rgba(245,158,11,0.28), rgba(212,175,55,0.18))',
    color: magicBusy ? '#fcd34d' : '#fbbf24',
    border: '1px solid ' + (magicBusy ? 'rgba(245,158,11,0.5)' : 'rgba(245,158,11,0.55)'),
    boxShadow: magicBusy ? 'none' : '0 0 10px rgba(245,158,11,0.22)',
    cursor: (magicBusy || !hasText) ? 'not-allowed' : 'pointer',
    opacity: (magicBusy || !hasText) ? 0.45 : 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7 }}>
      <textarea
        ref={composerRef}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={2}
        style={{
          flex: 1, resize: 'none', minHeight: 44, maxHeight: 140,
          padding: '9px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.9)', fontSize: '12.5px',
          fontFamily: "'Inter',sans-serif", lineHeight: 1.4, overflowY: 'auto',
        }}
      />
      {isNote && (
        <button type="button" onClick={runMagic} disabled={magicBusy || !hasText}
          title="✨ Structure this note for the AI brain — clarify barriers, next steps, and new intelligence"
          style={magicBtnStyle}>
          {magicBusy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
        </button>
      )}
      <button onClick={onSend} disabled={busy} title={composerParsing ? 'Parsing…' : 'Send'} style={btnStyle}>
        {composerParsing ? '✦' : busy ? '…' : '➤'}
      </button>
    </div>
  );
}