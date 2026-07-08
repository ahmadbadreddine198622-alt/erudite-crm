// NoteComposerBar — full-width textarea + bottom toolbar matching the Erudite
// note-feed design. Toolbar includes ALL tools from the design reference:
//   [Templates] [Save tpl] [Emoji] [Attach] | [✨ AI magic] [Globe web] [✦ Polish] [Mic] | [words] [WhatsApp] [Clear] [Send]
//
// Props:
//   composerRef, value, onChange, onKeyDown, onSend, placeholder,
//   composerType ('Note'|'Task'|'Follow-up'), landlordId, busy, composerParsing,
//   onSwitchToWhatsApp, onSaveTemplate

import React, { useState, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import {
  Sparkles, Loader2, Send, Eraser, MessageCircle,
  Save, Paperclip, Globe, Mic, Square, X, FileText,
} from 'lucide-react';
import EmailTemplatePicker from './EmailTemplatePicker';
import EmojiPicker from './EmojiPicker';
import useVoiceRecorder from '@/hooks/useVoiceRecorder';

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

const iconBtn = (active, color = 'rgba(255,255,255,0.6)', activeColor = GOLD) => ({
  flex: 'none', width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: active ? (activeColor + '22') : 'transparent',
  color: active ? activeColor : color,
  border: '1px solid ' + (active ? (activeColor + '55') : 'transparent'),
  transition: 'background 0.15s, border-color 0.15s',
});

function detectMediaType(filename) {
  const ext = String(filename || '').toLowerCase().split('.').pop();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'webm'].includes(ext)) return 'video';
  if (['mp3', 'ogg', 'aac', 'm4a', 'opus', 'wav'].includes(ext)) return 'audio';
  return 'document';
}

export default function NoteComposerBar({
  composerRef, value, onChange, onKeyDown, onSend,
  placeholder, composerType, landlordId, busy, composerParsing,
  onSwitchToWhatsApp, onSaveTemplate,
}) {
  const [magicBusy, setMagicBusy] = useState(false);
  const [webBusy, setWebBusy] = useState(false);
  const [polishBusy, setPolishBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachment, setAttachment] = useState(null); // { file_url, file_name, media_type }
  const fileInputRef = useRef(null);
  const vr = useVoiceRecorder();
  const isNote = composerType === 'Note';
  const hasText = !!((value || '').trim());

  const wordCount = useMemo(() => {
    const t = (value || '').trim();
    if (!t) return 0;
    return t.split(/\s+/).length;
  }, [value]);

  // ── Insert text at cursor position in the textarea ──
  const insertAtCursor = (text) => {
    const ta = composerRef?.current;
    if (!ta) { onChange({ target: { value: (value || '') + text } }); return; }
    const start = ta.selectionStart ?? (value || '').length;
    const end = ta.selectionEnd ?? (value || '').length;
    const next = (value || '').slice(0, start) + text + (value || '').slice(end);
    onChange({ target: { value: next } });
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + text.length, start + text.length); });
  };

  // ── AI Magic: structure the note for the AI brain ──
  const runMagic = async () => {
    if (magicBusy || !hasText || !landlordId) return;
    setMagicBusy(true);
    try {
      const res = await base44.functions.invoke('magicReshapeNote', { landlord_id: landlordId, text: value });
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

  // ── Web Search: enrich the note with real-time web context ──
  const runWebEnrich = async () => {
    if (webBusy || !hasText) return;
    setWebBusy(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a Dubai real estate expert assistant. The agent is writing an internal note about a landlord/unit. Enrich this note with any relevant real-time market context (current prices, trends, news) that would help the agent. Keep the agent's original text and ADD a "Market Context" section below it.\n\nAgent's note:\n${value}`,
        add_context_from_internet: true,
        response_json_schema: { type: 'object', properties: { enriched_note: { type: 'string' } }, required: ['enriched_note'] },
      });
      const enriched = res?.enriched_note || res?.data?.enriched_note;
      if (!enriched) throw new Error('No enrichment returned');
      const ta = composerRef?.current;
      if (ta) { ta.value = enriched; onChange({ target: ta }); }
      else { onChange({ target: { value: enriched } }); }
      toast.success('🌐 Note enriched with market context');
    } catch (e) {
      toast.error(e?.message || 'Web enrichment failed');
    } finally {
      setWebBusy(false);
    }
  };

  // ── Polish: clean up grammar, structure, and tone ──
  const runPolish = async () => {
    if (polishBusy || !hasText) return;
    setPolishBusy(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Clean up and polish this internal CRM note. Fix grammar, tighten sentences, improve clarity, and ensure professional tone. Keep it concise. Return ONLY the polished text, no commentary.\n\n${value}`,
        response_json_schema: { type: 'object', properties: { polished: { type: 'string' } }, required: ['polished'] },
      });
      const polished = res?.polished || res?.data?.polished;
      if (!polished) throw new Error('No polished text returned');
      const ta = composerRef?.current;
      if (ta) { ta.value = polished; onChange({ target: ta }); }
      else { onChange({ target: { value: polished } }); }
      toast.success('✦ Note polished');
    } catch (e) {
      toast.error(e?.message || 'Polish failed');
    } finally {
      setPolishBusy(false);
    }
  };

  // ── File attachment: upload to storage, show chip ──
  const handleFilePick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast.error('File too large (max 25 MB)'); return; }
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      const url = res?.file_url || res?.data?.file_url || res?.url;
      if (!url) throw new Error('Upload failed');
      setAttachment({ file_url: url, file_name: file.name, media_type: detectMediaType(file.name) });
      toast.success('Attachment ready');
    } catch (err) {
      toast.error('Upload failed: ' + (err?.message || 'unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = () => setAttachment(null);

  // ── Voice input: record → upload → transcribe → insert text ──
  const handleMicClick = async () => {
    if (vr.recording) {
      const blob = await vr.stop();
      vr.reset();
      if (!blob) return;
      setUploading(true);
      try {
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
        const upRes = await base44.integrations.Core.UploadFile({ file });
        const audioUrl = upRes?.file_url || upRes?.data?.file_url || upRes?.url;
        if (!audioUrl) throw new Error('Upload failed');
        const trRes = await base44.integrations.Core.TranscribeAudio({ audio_url: audioUrl });
        const transcript = typeof trRes === 'string' ? trRes : (trRes?.text || trRes?.data?.text || '');
        if (transcript) { insertAtCursor(transcript + ' '); toast.success('🎤 Voice transcribed'); }
        else { toast.error('No transcript returned'); }
      } catch (e) {
        toast.error('Voice transcription failed: ' + (e?.message || 'unknown error'));
      } finally {
        setUploading(false);
      }
    } else {
      vr.start();
    }
  };

  const handleClear = () => {
    const ta = composerRef?.current;
    if (ta) { ta.value = ''; onChange({ target: ta }); }
    else { onChange({ target: { value: '' } }); }
    setAttachment(null);
  };

  // On send, append attachment URL to the note text if present
  const handleSend = () => {
    if (attachment) {
      const ta = composerRef?.current;
      const enriched = (value || '') + `\n📎 ${attachment.file_name}: ${attachment.file_url}`;
      if (ta) { ta.value = enriched; onChange({ target: ta }); }
      else { onChange({ target: { value: enriched } }); }
      setAttachment(null);
    }
    if (onSend) onSend();
  };

  const busy2 = !!(busy || composerParsing);
  const anyBusy = !!(magicBusy || webBusy || polishBusy || uploading);

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

      {/* Pending attachment chip */}
      {attachment && (
        <div style={css("display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:9px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.15);")}>
          <span style={{ flex: 'none', width: 22, height: 22, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.1)', fontSize: 11 }}>
            {attachment.media_type === 'image' ? '🖼' : attachment.media_type === 'video' ? '🎬' : attachment.media_type === 'audio' ? '🎵' : '📎'}
          </span>
          <span style={css("flex:1; min-width:0; font-size:11px; color:rgba(255,255,255,0.7); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;")}>
            {attachment.file_name || 'Attachment'}
          </span>
          <button type="button" onClick={removeAttachment} title="Remove" style={css("flex:none; cursor:pointer; background:none; border:none; color:rgba(255,255,255,0.5); padding:2px; display:flex;")}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* Voice recording indicator */}
      {vr.recording && (
        <div style={css("display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:9px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3);")}>
          <span style={css("flex:none; width:8px; height:8px; border-radius:50%; background:#ef4444; animation: ld-pulse 1s ease-in-out infinite;")} />
          <span style={css("font-size:11px; color:#fca5a5; font-family:'Inter',sans-serif;")}>Recording… {vr.seconds}s</span>
          <span style={css("flex:1;")} />
          <button type="button" onClick={handleMicClick} title="Stop & transcribe" style={css("flex:none; cursor:pointer; display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:7px; font-size:10.5px; font-weight:700; font-family:'Inter',sans-serif; background:rgba(239,68,68,0.2); color:#fca5a5; border:1px solid rgba(239,68,68,0.4);")}>
            <Square size={10} /> Stop
          </button>
        </div>
      )}

      {vr.error && (
        <div style={css("padding:4px 10px; border-radius:7px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); font-size:10px; color:#fca5a5;")}>{vr.error}</div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFilePick} />

      {/* Toolbar — left cluster scrolls horizontally, right cluster is fixed */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
        {/* Left: scrollable tool cluster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', flex: 1, minWidth: 0, paddingBottom: 2, scrollbarWidth: 'thin' }}>
          {/* Templates dropdown */}
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

          {/* Save as template */}
          {isNote && onSaveTemplate && (
            <button type="button" onClick={onSaveTemplate} disabled={!hasText}
              title="Save as template"
              style={iconBtn(false, 'rgba(255,255,255,0.5)')}>
              <FileText size={13} />
            </button>
          )}

          {/* Emoji picker */}
          {isNote && (
            <EmojiPicker onSelect={(emoji) => insertAtCursor(emoji)} />
          )}

          {/* Attachment picker */}
          {isNote && (
            <button type="button" onClick={() => fileInputRef.current && fileInputRef.current.click()} disabled={anyBusy}
              title="Attach a file"
              style={iconBtn(!!attachment)}>
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}
            </button>
          )}

          {/* Divider */}
          {isNote && <span style={{ flex: 'none', width: 1, height: 18, background: 'rgba(255,255,255,0.1)' }} />}

          {/* AI magic — gold sparkle */}
          {isNote && (
            <button type="button" onClick={runMagic} disabled={magicBusy || !hasText}
              title="✨ AI Magic — reshape for impact"
              style={iconBtn(magicBusy, GOLD, GOLD)}>
              {magicBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            </button>
          )}

          {/* Web search */}
          {isNote && (
            <button type="button" onClick={runWebEnrich} disabled={webBusy || !hasText}
              title="🌐 Enrich with real-time market context"
              style={iconBtn(webBusy, 'rgba(59,130,246,0.7)', '#3b82f6')}>
              {webBusy ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
            </button>
          )}

          {/* Polish */}
          {isNote && (
            <button type="button" onClick={runPolish} disabled={polishBusy || !hasText}
              title="✦ Polish & clean grammar"
              style={iconBtn(polishBusy, 'rgba(167,139,246,0.7)', '#a78bfa')}>
              {polishBusy ? <Loader2 size={13} className="animate-spin" /> : <span style={{ fontSize: 13, fontWeight: 700 }}>✦</span>}
            </button>
          )}

          {/* Voice input — fast smart AI transcription */}
          {isNote && (
            <button type="button" onClick={handleMicClick} disabled={anyBusy && !vr.recording}
              title={vr.recording ? 'Stop & transcribe' : '🎤 Voice input — AI transcript'}
              style={iconBtn(vr.recording, 'rgba(239,68,68,0.8)', '#ef4444')}>
              {vr.recording ? <Square size={11} /> : <Mic size={13} />}
            </button>
          )}
        </div>

        {/* Right: fixed action cluster — always visible */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 'none' }}>
          {/* Word counter */}
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', fontFamily: "'Inter',sans-serif" }}>
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>

          {/* Quick-switch to WhatsApp */}
          {isNote && onSwitchToWhatsApp && (
            <button type="button" onClick={() => onSwitchToWhatsApp(value)}
              title="Send via WhatsApp"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter',sans-serif", background: 'rgba(37,211,102,0.14)', color: '#25D366', border: '1px solid rgba(37,211,102,0.4)' }}>
              <MessageCircle size={12} /> WhatsApp
            </button>
          )}

          {/* Clear */}
          <button type="button" onClick={handleClear} disabled={!hasText}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: hasText ? 'pointer' : 'not-allowed', fontFamily: "'Inter',sans-serif", background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', opacity: hasText ? 1 : 0.4 }}>
            <Eraser size={11} /> Clear
          </button>

          {/* Send */}
          <button onClick={handleSend} disabled={busy2}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter',sans-serif", background: 'linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%))', color: '#1a1205', border: '1px solid hsl(38 92% 50% / 0.5)', opacity: busy2 ? 0.6 : 1 }}>
            {composerParsing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {composerParsing ? 'Parsing…' : busy ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}