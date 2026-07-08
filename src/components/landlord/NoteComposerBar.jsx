// NoteComposerBar — full-width textarea + bottom toolbar matching the Erudite
// note-feed design. Toolbar: [Templates…] [icon cluster incl. ✨ magic (gold)] … [0 words] [Clear] [Send pill]
//
// Props (unchanged interface — works for Note / Task / Follow-up):
//   composerRef, value, onChange, onKeyDown, onSend, placeholder,
//   composerType ('Note'|'Task'|'Follow-up'), landlordId, busy, composerParsing

import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Sparkles, Loader2, Send, Eraser, MessageCircle } from 'lucide-react';
import EmailTemplatePicker from './EmailTemplatePicker';

const GOLD = '#d4b483';

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

export default function NoteComposerBar({
  composerRef, value, onChange, onKeyDown, onSend,
  placeholder, composerType, landlordId, busy, composerParsing,
  onSwitchToWhatsApp,
}) {
  const [magicBusy, setMagicBusy] = useState(false);
  const isNote = composerType === 'Note';
  const hasText = !!((value || '').trim());

  const wordCount = useMemo(() => {
    const t = (value || '').trim();
    if (!t) return 0;
    return t.split(/\s+/).length;
  }, [value]);

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

  const handleClear = () => {
    const ta = composerRef?.current;
    if (ta) { ta.value = ''; onChange({ target: ta }); }
    else { onChange({ target: { value: '' } }); }
  };

  const busy2 = !!(busy || composerParsing);

  return (
    <div style={css("display:flex; flex-direction:column; gap:6px;")}>
      {/* Full-width textarea */}
      <textarea
        ref={composerRef}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder || 'Type a message'}
        rows={2}
        style={{
          width: '100%', resize: 'none', minHeight: 48, maxHeight: 140,
          padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.9)', fontSize: '13px',
          fontFamily: "'Inter',sans-serif", lineHeight: 1.45, overflowY: 'auto', outline: 'none',
        }}
      />
      {/* Toolbar */}
      <div style={css("display:flex; align-items:center; gap:7px; flex-wrap:nowrap;")}>
        {/* Templates dropdown */}
        <div style={css("flex:none;")}>
          <EmailTemplatePicker
            channel="email"
            landlordId={landlordId}
            compact
            onSelect={({ body }) => {
              const ta = composerRef?.current;
              if (ta) { ta.value = body || ''; onChange({ target: ta }); }
              else { onChange({ target: { value: body || '' } }); }
            }}
          />
        </div>

        {/* Icon cluster — AI magic reshape (Note only) */}
        {isNote && (
          <button type="button" onClick={runMagic} disabled={magicBusy || !hasText}
            title="✨ Structure this note for the AI brain"
            style={{
              flex: 'none', width: 30, height: 30, borderRadius: 8, cursor: (magicBusy || !hasText) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: magicBusy ? 'rgba(212,180,131,0.15)' : 'rgba(212,180,131,0.08)',
              color: magicBusy ? '#fcd34d' : GOLD,
              border: '1px solid ' + (magicBusy ? 'rgba(212,180,131,0.4)' : 'rgba(212,180,131,0.55)'),
              boxShadow: magicBusy ? 'none' : '0 0 8px rgba(212,180,131,0.18)',
              opacity: (magicBusy || !hasText) ? 0.45 : 1,
            }}>
            {magicBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          </button>
        )}

        <span style={css("flex:1;")} />

        {/* Word counter */}
        <span style={css("font-size:10px; color:rgba(255,255,255,0.35); white-space:nowrap; font-family:'Inter',sans-serif;")}>
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </span>

        {/* Quick-switch to WhatsApp — carry the text over */}
        {isNote && onSwitchToWhatsApp && (
          <button type="button" onClick={() => onSwitchToWhatsApp(value)}
            title="Send via WhatsApp"
            style={css("display:inline-flex; align-items:center; gap:4px; padding:5px 11px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(37,211,102,0.14); color:#25D366; border:1px solid rgba(37,211,102,0.4);")}>
            <MessageCircle size={12} /> WhatsApp
          </button>
        )}

        {/* Clear */}
        <button type="button" onClick={handleClear} disabled={!hasText}
          style={css("display:inline-flex; align-items:center; gap:4px; padding:5px 10px; border-radius:8px; font-size:11px; font-weight:600; cursor:"+(hasText?'pointer':'not-allowed')+"; font-family:'Inter',sans-serif; background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.6); border:1px solid rgba(255,255,255,0.1); opacity:"+(hasText?1:0.4)+";")}>
          <Eraser size={11} /> Clear
        </button>

        {/* Send — pill */}
        <button onClick={onSend} disabled={busy2}
          style={css("display:inline-flex; align-items:center; gap:5px; padding:6px 16px; border-radius:99px; font-size:11.5px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%)); color:#1a1205; border:1px solid hsl(38 92% 50% / 0.5); opacity:"+(busy2?0.6:1)+";")}>
          {composerParsing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          {composerParsing ? 'Parsing…' : busy ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}