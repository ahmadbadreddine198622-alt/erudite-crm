// ModernComposerField — image-style composer shell shared across Email, iMessage,
// WhatsApp, Telegram and SMS. Renders a large "Type a message" WritingField with a
// bottom toolbar: left = channel-specific icons (passed as children), right =
// word count + Clear + Send (blue, with a history glyph).
//
// All existing send / template / attachment / emoji logic stays in the parent —
// this is a presentational shell.

import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Globe, Loader2, Check, Plus, History, Wand2, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import WritingField from '@/components/shared/WritingField';

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

export default function ModernComposerField({
  value, onChange, onKeyDown,
  placeholder = 'Type a message',
  onSend, sending = false, sendDisabled = false, sendLabel = 'Send',
  accent = '#2563eb',
  gloss,                          // optional external English translation (from AI draft)
  targetLanguage,                 // landlord's preferred language code (e.g. 'hi', 'ar', 'ru', 'zh') — enables bidirectional editing
  landlordContext,                // { name, unit, project, asking, agentName } — grounds the magic reshape in the unit + project
  landlordId,                     // landlord entity ID — for V2 magic reshape backend call
  channel,                        // 'imessage' | 'whatsapp' | 'telegram' | 'sms' | 'email' — context for the backend
  children,                       // left-cluster toolbar icons (templates / AI / attach / emoji)
  inputRef, minHeight = 72,
}) {
  const taRef = useRef(null);
  const ref = inputRef || taRef;
  const [translating, setTranslating] = useState(false);
  const [transOpen, setTransOpen] = useState(false);
  const [translation, setTranslation] = useState(null); // { text, langLabel }
  const [toneOpen, setToneOpen] = useState(false);
  const [toneBusy, setToneBusy] = useState(false);
  const [magicBusy, setMagicBusy] = useState(false);
  const magicAngleIdx = useRef(0);
  const [autoGloss, setAutoGloss] = useState('');
  const [autoGlossBusy, setAutoGlossBusy] = useState(false);
  const autoGlossTimer = useRef(null);
  const [glossEdited, setGlossEdited] = useState(false);
  const [backTranslating, setBackTranslating] = useState(false);
  const skipAutoGloss = useRef(false);
  const backTranslateTimer = useRef(null);

  const langLabel = TRANSLATE_LANGS.find((l) => l.code === targetLanguage)?.label || '';
  const hasTargetLang = targetLanguage && targetLanguage !== 'en' && langLabel;

  // Auto-grow textarea to a sensible max.
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(220, Math.max(minHeight, ta.scrollHeight)) + 'px';
  }, [value, minHeight, ref]);

  // Auto-translate non-English text to English — always visible so the agent
  // can read what they're sending in a language they understand.
  useEffect(() => {
    const text = String(value || '').trim();
    if (gloss && !glossEdited) return; // external gloss (AI draft) takes priority until edited
    if (skipAutoGloss.current) { skipAutoGloss.current = false; return; }
    // User edited the main field → resume auto-translation mode
    setGlossEdited(false);
    if (!text || !/[^\u0000-\u007F]/.test(text)) { setAutoGloss(text); return; }
    if (autoGlossTimer.current) clearTimeout(autoGlossTimer.current);
    autoGlossTimer.current = setTimeout(async () => {
      setAutoGlossBusy(true);
      try {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `Translate the following message into English. Preserve the tone, meaning, and any placeholders. Output ONLY the translated text — no quotes, no commentary.\n\nMessage:\n${text}`,
          response_json_schema: { type: 'object', properties: { translated: { type: 'string' } } },
        });
        const data = res?.data ?? res;
        setAutoGloss(data?.translated || (typeof data === 'string' ? data : '') || '');
      } catch { /* silent */ } finally { setAutoGlossBusy(false); }
    }, 800);
    return () => { if (autoGlossTimer.current) clearTimeout(autoGlossTimer.current); };
  }, [value, gloss, glossEdited]);

  // When the agent edits the English translation, back-translate to the
  // landlord's language and update the main message field.
  const onGlossEdit = (e) => {
    const newText = e?.target?.value ?? '';
    setGlossEdited(true);
    setAutoGloss(newText);
    if (!hasTargetLang) return;
    if (backTranslateTimer.current) clearTimeout(backTranslateTimer.current);
    backTranslateTimer.current = setTimeout(async () => {
      if (!newText.trim()) return;
      setBackTranslating(true);
      try {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `Translate the following message into ${langLabel}. Preserve the tone, meaning, and any placeholders. Output ONLY the translated text — no quotes, no commentary.\n\nMessage:\n${newText}`,
          response_json_schema: { type: 'object', properties: { translated: { type: 'string' } } },
        });
        const data = res?.data ?? res;
        const translated = data?.translated || (typeof data === 'string' ? data : '') || '';
        if (translated) {
          skipAutoGloss.current = true; // prevent main→English re-translation loop
          onChange({ target: { value: translated } });
        }
      } catch { /* silent */ } finally { setBackTranslating(false); }
    }, 1000);
  };

  // ── Magic reshape V2 — one button. Each click rewrites the current message using
  // the backend `magicReshapeV2` function which merges THREE brains:
  //   1. The landlord's AI brain (deal thesis, next best action, coaching, objections)
  //   2. The unit details (unit number, project, asking price, layout)
  //   3. The full conversation history (WhatsApp, email, iMessage, Telegram, notes)
  // The angle rotates on every click so you never get the same approach twice.
  const runMagic = async () => {
    const src = String(value || '').trim();
    if (!src) { toast.error('Nothing to reshape'); return; }
    if (magicBusy) return;
    if (!landlordId) { toast.error('No landlord selected'); return; }
    setMagicBusy(true);
    try {
      const res = await base44.functions.invoke('magicReshapeV2', {
        landlord_id: landlordId,
        text: src,
        channel: channel || 'unknown',
        angle_index: magicAngleIdx.current,
      });
      const data = res?.data ?? res;
      if (!data?.ok) throw new Error(data?.error || 'Reshape failed');
      const msg = data.message || '';
      if (!msg) throw new Error('No message returned');
      onChange({ target: { value: msg } });
      magicAngleIdx.current = data.next_angle_index || magicAngleIdx.current + 1;
      toast.success(`✨ Reshaped · ${data.angle_label || 'smart rewrite'}`);
    } catch (e) {
      toast.error(e?.message || 'Magic reshape failed');
    } finally {
      setMagicBusy(false);
    }
  };

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

  const clearAll = () => {
    onChange({ target: { value: '' } });
    setTranslation(null);
  };

  const hasContent = !!String(value || '').trim();
  const canSend = hasContent && !sendDisabled && !sending;

  return (
    <div style={css("position:relative; border-radius:12px; border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.04); padding:10px 12px 8px;")}>

      {/* WritingField — textarea + dictation + translate + tone + magic reshape (all unified) */}
      <WritingField
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        minHeight={minHeight}
        landlordId={landlordId}
        channel={channel}
        landlordContext={landlordContext}
        targetLanguage={targetLanguage}
        inputRef={ref}
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