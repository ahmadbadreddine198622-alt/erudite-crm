// ModernComposerField — image-style composer shell shared across Email, iMessage,
// WhatsApp, Telegram and SMS. Renders a large "Type a message" textarea with a
// bottom toolbar: left = channel-specific icons (passed as children), right =
// word count + Clear + Send (blue, with a history glyph).
//
// Two features live INSIDE this field so each composer doesn't re-implement them:
//   • Translate — globe icon opens a language menu (en, ru, zh, ko, ar, hi, ja,
//     es, it). The translation is shown in a preview strip BELOW the textarea
//     (the original stays); the agent taps Apply to replace the text or Discard.
//   • Voice — mic icon (only when `voiceEnabled`). Records via useVoiceRecorder;
//     on stop shows "Send voice" / "Convert to text". Send-voice is hidden when
//     `voiceCanSendAudio` is false (e.g. iMessage), leaving only Convert-to-text.
//
// All existing send / template / attachment / emoji logic stays in the parent —
// this is a presentational shell plus the two new features.

import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Globe, Mic, Square, Loader2, Check, Plus, History, Wand2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import useVoiceRecorder from '@/hooks/useVoiceRecorder';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

export const TRANSLATE_LANGS = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Russian' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ja', label: 'Japanese' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' },
];

export const TONE_OPTIONS = [
  { key: 'aggressive', label: 'Aggressive' },
  { key: 'calm', label: 'Calm' },
  { key: 'normal', label: 'Normal' },
  { key: 'peaceful', label: 'Peaceful' },
  { key: 'confident', label: 'Confident' },
  { key: 'friendly', label: 'Friendly' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'persuasive', label: 'Persuasive' },
  { key: 'diplomatic', label: 'Diplomatic' },
  { key: 'formal', label: 'Formal' },
  { key: 'casual', label: 'Casual' },
  { key: 'enthusiastic', label: 'Enthusiastic' },
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

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export default function ModernComposerField({
  value, onChange, onKeyDown,
  placeholder = 'Type a message',
  onSend, sending = false, sendDisabled = false, sendLabel = 'Send',
  accent = '#2563eb',
  voiceEnabled = false,
  voiceCanSendAudio = true,      // hide "Send voice" when false (iMessage)
  onVoiceSent = () => {},         // (fileUrl, filename) — parent sends audio as attachment
  onVoiceText = () => {},         // (transcript) — parent drops transcript into the field
  children,                       // left-cluster toolbar icons (templates / AI / attach / emoji)
  inputRef, minHeight = 72,
}) {
  const taRef = useRef(null);
  const ref = inputRef || taRef;
  const [translating, setTranslating] = useState(false);
  const [transOpen, setTransOpen] = useState(false);
  const [translation, setTranslation] = useState(null); // { text, langLabel }
  const vr = useVoiceRecorder();
  const [stopped, setStopped] = useState(false); // show choice bar after stop
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [toneOpen, setToneOpen] = useState(false);
  const [toneBusy, setToneBusy] = useState(false);

  // Auto-grow textarea to a sensible max.
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(220, Math.max(minHeight, ta.scrollHeight)) + 'px';
  }, [value, minHeight, ref]);

  const wordCount = String(value || '').trim() ? String(value || '').trim().split(/\s+/).length : 0;

  const runTranslate = async (lang) => {
    const src = String(value || '').trim();
    if (!src) { toast.error('Nothing to translate'); return; }
    setTransOpen(false);
    setTranslating(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt:
          `Translate the following message into ${lang.label}. ` +
          `Preserve the tone, line breaks, and any placeholders like {{landlord_name}}. ` +
          `Output ONLY the translated text — no quotes, no commentary.\n\nMessage:\n${src}`,
        response_json_schema: { type: 'object', properties: { translated: { type: 'string' } } },
      });
      const data = res?.data ?? res;
      const text = data?.translated || (typeof data === 'string' ? data : '');
      if (!text) throw new Error('No translation returned');
      setTranslation({ text, langLabel: lang.label });
    } catch (e) {
      toast.error(e?.message || 'Translation failed');
    } finally {
      setTranslating(false);
    }
  };

  const applyTranslation = () => {
    if (!translation) return;
    onChange({ target: { value: translation.text } });
    setTranslation(null);
  };

  const runTone = async (tone) => {
    const src = String(value || '').trim();
    if (!src) { toast.error('Nothing to rewrite'); return; }
    setToneOpen(false);
    setToneBusy(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Rewrite the following message in a ${tone.label} tone. Preserve the meaning, key facts, and any placeholders like {{landlord_name}}. Keep the original language. Output ONLY the rewritten message — no quotes, no commentary.\n\nMessage:\n${src}`,
        response_json_schema: { type: 'object', properties: { rewritten: { type: 'string' } } },
      });
      const data = res?.data ?? res;
      const text = data?.rewritten || (typeof data === 'string' ? data : '');
      if (!text) throw new Error('No rewrite returned');
      onChange({ target: { value: text } });
      toast.success(`Rewritten in ${tone.label.toLowerCase()} tone`);
    } catch (e) {
      toast.error(e?.message || 'Tone rewrite failed');
    } finally {
      setToneBusy(false);
    }
  };

  const startVoice = () => {
    setStopped(false);
    setTranslation(null);
    vr.start();
  };

  const stopVoice = async () => {
    await vr.stop();
    setStopped(true);
  };

  // Send the recorded audio as a media attachment.
  const sendVoice = async () => {
    if (!vr.blob) { setStopped(false); return; }
    setVoiceBusy(true);
    try {
      const file = new File([vr.blob], `voice_note_${Date.now()}.webm`, { type: vr.blob.type || 'audio/webm' });
      const res = await base44.integrations.Core.UploadFile({ file });
      const url = res?.file_url || res?.data?.file_url || res?.url;
      if (!url) throw new Error('Upload failed');
      onVoiceSent(url, file.name);
      vr.reset(); setStopped(false);
      toast.success('Voice note attached — sending…');
    } catch (e) {
      toast.error(e?.message || 'Voice upload failed');
    } finally {
      setVoiceBusy(false);
    }
  };

  // Transcribe the recording and drop the text into the composer.
  const convertToText = async () => {
    if (!vr.blob) { setStopped(false); return; }
    setVoiceBusy(true);
    try {
      const file = new File([vr.blob], `voice_note_${Date.now()}.webm`, { type: vr.blob.type || 'audio/webm' });
      const up = await base44.integrations.Core.UploadFile({ file });
      const url = up?.file_url || up?.data?.file_url || up?.url;
      if (!url) throw new Error('Upload failed');
      const tr = await base44.integrations.Core.TranscribeAudio({ audio_url: url });
      const transcript = tr?.data ?? tr;
      const text = typeof transcript === 'string' ? transcript : (transcript?.text || '');
      if (!text) throw new Error('No transcript returned');
      onVoiceText(text);
      vr.reset(); setStopped(false);
      toast.success('Transcript added to message');
    } catch (e) {
      toast.error(e?.message || 'Transcription failed');
    } finally {
      setVoiceBusy(false);
    }
  };

  const clearAll = () => {
    onChange({ target: { value: '' } });
    setTranslation(null);
  };

  const hasContent = !!String(value || '').trim();
  const canSend = hasContent && !sendDisabled && !sending && !vr.recording && !voiceBusy;

  return (
    <div style={css("position:relative; border-radius:12px; border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.04); padding:10px 12px 8px;")}>
      <style>{`
        @keyframes mcf-pulse { 0%{ box-shadow:0 0 0 0 rgba(244,63,94,0.45);} 100%{ box-shadow:0 0 0 10px rgba(244,63,94,0);} }
        .mcf-rec-dot { animation: mcf-pulse 1.1s ease-out infinite; }
      `}</style>

      {/* Translation preview strip (keep original + show below) */}
      {translation && (
        <div style={css("border-radius:8px; padding:7px 9px; margin-bottom:7px; background:rgba(37,99,235,0.1); border:1px solid rgba(37,99,235,0.32);")}>
          <div style={css("display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:4px;")}>
            <span style={css("font-size:9px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:#93c5fd;")}>{translation.langLabel} translation</span>
            <div style={css("display:flex; gap:5px;")}>
              <button type="button" onClick={applyTranslation} title="Replace message with translation"
                style={css("display:inline-flex; align-items:center; gap:3px; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:#2563eb; color:#fff; border:1px solid #2563eb;")}>
                <Check size={11} /> Apply
              </button>
              <button type="button" onClick={() => setTranslation(null)} title="Discard translation"
                style={css("display:inline-flex; align-items:center; gap:3px; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.7); border:1px solid rgba(255,255,255,0.16);")}>
                <X size={11} /> Discard
              </button>
            </div>
          </div>
          <div style={css("font-size:11.5px; line-height:1.45; color:rgba(255,255,255,0.88); white-space:pre-wrap; max-height:140px; overflow:auto;")}>{translation.text}</div>
        </div>
      )}

      {/* Voice recording bar */}
      {vr.recording && (
        <div style={css("display:flex; align-items:center; gap:9px; padding:7px 10px; margin-bottom:7px; border-radius:8px; background:rgba(244,63,94,0.1); border:1px solid rgba(244,63,94,0.32);")}>
          <span className="mcf-rec-dot" style={css("flex:none; width:10px; height:10px; border-radius:50%; background:#f43f5e;")} />
          <span style={css("font-size:11px; font-weight:700; color:#fda4af; font-family:'Inter',sans-serif;")}>Recording… {fmtTime(vr.seconds)}</span>
          <button type="button" onClick={stopVoice} title="Stop recording"
            style={css("margin-left:auto; display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:6px; font-size:10px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:#f43f5e; color:#fff; border:1px solid #f43f5e;")}>
            <Square size={10} /> Stop
          </button>
        </div>
      )}

      {/* After-stop choice bar */}
      {stopped && !vr.recording && (
        <div style={css("display:flex; align-items:center; gap:7px; padding:7px 10px; margin-bottom:7px; border-radius:8px; background:rgba(37,99,235,0.1); border:1px solid rgba(37,99,235,0.32);")}>
          <Mic size={13} style={{ color: '#93c5fd', flex: 'none' }} />
          <span style={css("font-size:11px; font-weight:600; color:#93c5fd; font-family:'Inter',sans-serif;")}>Voice note ready ({fmtTime(vr.seconds)})</span>
          <div style={css("margin-left:auto; display:flex; gap:5px;")}>
            {voiceCanSendAudio && (
              <button type="button" onClick={sendVoice} disabled={voiceBusy} title="Send as voice note"
                style={css("display:inline-flex; align-items:center; gap:3px; padding:3px 9px; border-radius:6px; font-size:10px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:#2563eb; color:#fff; border:1px solid #2563eb; opacity:"+(voiceBusy?0.6:1)+";")}>
                {voiceBusy ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Send voice
              </button>
            )}
            <button type="button" onClick={convertToText} disabled={voiceBusy} title="Transcribe to text"
              style={css("display:inline-flex; align-items:center; gap:3px; padding:3px 9px; border-radius:6px; font-size:10px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.8); border:1px solid rgba(255,255,255,0.18); opacity:"+(voiceBusy?0.6:1)+";")}>
              {voiceBusy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Convert to text
            </button>
            <button type="button" onClick={() => { vr.reset(); setStopped(false); }} title="Discard"
              style={css("display:inline-flex; align-items:center; justify-content:center; padding:3px 7px; border-radius:6px; cursor:pointer; background:transparent; border:1px solid rgba(255,255,255,0.16); color:rgba(255,255,255,0.6);")}>
              <X size={11} />
            </button>
          </div>
        </div>
      )}

      {vr.error && <div style={css("font-size:10px; color:#fca5a5; margin-bottom:5px;")}>⚠ {vr.error}</div>}

      {/* Large textarea — "Type a message" */}
      <textarea
        ref={ref}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder={placeholder}
        style={css(
          "display:block; width:100%; resize:none; min-height:"+minHeight+"px; max-height:220px; "+
          "padding:9px 11px; border-radius:9px; "+
          "background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); "+
          "color:rgba(255,255,255,0.92); font-size:13px; font-family:'Inter',sans-serif; line-height:1.5; overflow-y:auto; outline:none;"
        )}
      />

      {/* Bottom row — left toolbar (children) + translate + mic ; right: word count + Clear + Send */}
      <div style={css("display:flex; align-items:center; gap:4px; margin-top:7px; justify-content:space-between;")}>
        <div style={css("display:flex; align-items:center; gap:3px;")}>
          {children}

          {/* Translate */}
          <Popover open={transOpen} onOpenChange={setTransOpen}>
            <PopoverTrigger asChild>
              <button type="button" title="Translate message" disabled={translating || !hasContent}
                className="flex items-center justify-center w-8 h-8 rounded-lg transition-all border"
                style={{
                  background: transOpen ? 'rgba(37,99,235,0.18)' : 'transparent',
                  color: transOpen ? '#93c5fd' : 'rgba(255,255,255,0.6)',
                  border: '1px solid ' + (transOpen ? 'rgba(37,99,235,0.4)' : 'transparent'),
                  cursor: (translating || !hasContent) ? 'not-allowed' : 'pointer',
                  opacity: (translating || !hasContent) ? 0.5 : 1,
                }}>
                {translating ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" style={{ background: '#1a2235', border: '1px solid rgba(255,255,255,0.15)' }} align="start">
              <div style={css("font-size:10px; font-weight:700; color:rgba(255,255,255,0.6); margin-bottom:5px; letter-spacing:0.04em; text-transform:uppercase;")}>Translate to</div>
              <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:4px;")}>
                {TRANSLATE_LANGS.map((l) => (
                  <button key={l.code} type="button" onClick={() => runTranslate(l)}
                    style={css("padding:5px 8px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; text-align:left; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.82);")}>
                    {l.label}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Tone rewrite */}
          <Popover open={toneOpen} onOpenChange={setToneOpen}>
            <PopoverTrigger asChild>
              <button type="button" title="Rewrite tone" disabled={toneBusy || !hasContent}
                className="flex items-center justify-center w-8 h-8 rounded-lg transition-all border"
                style={{
                  background: toneOpen ? 'rgba(168,85,247,0.18)' : 'transparent',
                  color: toneOpen ? '#c4b5fd' : 'rgba(255,255,255,0.6)',
                  border: '1px solid ' + (toneOpen ? 'rgba(168,85,247,0.4)' : 'transparent'),
                  cursor: (toneBusy || !hasContent) ? 'not-allowed' : 'pointer',
                  opacity: (toneBusy || !hasContent) ? 0.5 : 1,
                }}>
                {toneBusy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-2" style={{ background: '#1a2235', border: '1px solid rgba(255,255,255,0.15)' }} align="start">
              <div style={css("font-size:10px; font-weight:700; color:rgba(255,255,255,0.6); margin-bottom:5px; letter-spacing:0.04em; text-transform:uppercase;")}>Rewrite tone</div>
              <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:4px; max-height:200px; overflow-y:auto;")}>
                {TONE_OPTIONS.map((t) => (
                  <button key={t.key} type="button" onClick={() => runTone(t)}
                    style={css("padding:5px 8px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; text-align:left; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.82);")}>
                    {t.label}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Voice (WhatsApp / iMessage / Telegram) */}
          {voiceEnabled && !vr.recording && !stopped && (
            <button type="button" onClick={startVoice} title="Record voice note"
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all border border-transparent hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.6)' }}>
              <Mic size={14} />
            </button>
          )}
        </div>

        {/* Right cluster: word count + Clear + Send */}
        <div style={css("display:flex; align-items:center; gap:7px;")}>
          <span style={css("font-size:10px; color:rgba(255,255,255,0.4); font-family:'Inter',sans-serif; white-space:nowrap;")}>{wordCount} word{wordCount === 1 ? '' : 's'}</span>
          <button type="button" onClick={clearAll} disabled={!hasContent && !translation}
            title="Clear"
            className="h-8 px-3 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.75)',
              border: '1px solid rgba(255,255,255,0.16)',
              cursor: (hasContent || translation) ? 'pointer' : 'not-allowed',
              opacity: (hasContent || translation) ? 1 : 0.4, fontFamily: "'Inter',sans-serif",
            }}>
            Clear
          </button>
          <button type="button" onClick={onSend} disabled={!canSend}
            title="Send"
            className="flex items-center justify-center gap-1.5 h-8 px-4 rounded-lg transition-all"
            style={{
              background: canSend ? accent : 'rgba(255,255,255,0.08)',
              color: canSend ? '#fff' : 'rgba(255,255,255,0.4)',
              border: '1px solid ' + (canSend ? accent : 'rgba(255,255,255,0.1)'),
              cursor: canSend ? 'pointer' : 'not-allowed',
              fontSize: '11.5px', fontWeight: 700, fontFamily: "'Inter',sans-serif",
            }}>
            {sending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <>
                {sendLabel}
                <History size={12} style={{ opacity: 0.85 }} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}