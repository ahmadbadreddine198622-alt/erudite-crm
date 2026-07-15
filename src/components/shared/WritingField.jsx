// WritingField — drop-in replacement for a plain <textarea> that adds the full
// writing toolkit: live dictation, Translate popover, Tone rewrite popover,
// auto English translation strip for non-English text, and optional Magic
// Reshape (when landlordId is provided).
//
// Reuses the EXACT same logic/prompts as ModernComposerField (TRANSLATE_LANGS,
// TONE_OPTIONS imported from it). No Send button, no sending logic — purely a
// textarea + toolbar.

import React, { useState, useRef, useEffect } from 'react';
import { Globe, Wand2, Loader2, Sparkles, Check, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import DictationMicButton from '@/components/shared/DictationMicButton';
import { TRANSLATE_LANGS, TONE_OPTIONS } from '@/components/landlord/ModernComposerField';

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

export default function WritingField({
  value, onChange, onKeyDown,
  placeholder, rows, minHeight,
  disabled, className, style, dir,
  landlordId, channel, landlordContext,
  targetLanguage,
  inputRef, ...rest
}) {
  const taRef = useRef(null);
  const ref = inputRef || taRef;

  const [translating, setTranslating] = useState(false);
  const [transOpen, setTransOpen] = useState(false);
  const [translation, setTranslation] = useState(null);
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
  const hasContent = !!String(value || '').trim();
  const hasNonAscii = /[^\u0000-\u007F]/.test(String(value || ''));

  // Auto-translate non-English text to English — always visible so the agent
  // can read what they're sending in a language they understand.
  useEffect(() => {
    const text = String(value || '').trim();
    if (skipAutoGloss.current) { skipAutoGloss.current = false; return; }
    setGlossEdited(false);
    if (!text || !hasNonAscii) { setAutoGloss(text); return; }
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
  }, [value, hasNonAscii]);

  // When the agent edits the English translation, back-translate to the
  // target language and update the main field.
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
          skipAutoGloss.current = true;
          onChange({ target: { value: translated } });
        }
      } catch { /* silent */ } finally { setBackTranslating(false); }
    }, 1000);
  };

  // Magic reshape V2 — each click rewrites using the backend magicReshapeV2.
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

  const showGloss = autoGlossBusy || (hasNonAscii && !!autoGloss) || hasTargetLang;

  const tplBtn = (on, color) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
    background: on ? (color + '22') : 'transparent',
    color: on ? color : 'rgba(255,255,255,0.5)',
    border: '1px solid ' + (on ? (color + '55') : 'transparent'),
    transition: 'background 0.15s, border-color 0.15s',
  });

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Translation preview strip */}
      {translation && (
        <div style={css("border-radius:8px; padding:7px 9px; margin-bottom:7px; background:rgba(37,99,235,0.08); border:1px solid rgba(37,99,235,0.25);")}>
          <div style={css("display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;")}>
            <span style={css("font-size:9px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:#93c5fd;")}>Translation → {translation.langLabel}</span>
            <div style={css("display:flex; gap:5px;")}>
              <button type="button" onClick={applyTranslation} title="Apply translation"
                style={css("display:inline-flex; align-items:center; gap:3px; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:700; cursor:pointer; background:#2563eb; color:#fff; border:1px solid #2563eb;")}>
                <Check size={11} /> Apply
              </button>
              <button type="button" onClick={() => setTranslation(null)} title="Discard translation"
                style={css("display:inline-flex; align-items:center; gap:3px; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:600; cursor:pointer; background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.7); border:1px solid rgba(255,255,255,0.16);")}>
                <X size={11} /> Discard
              </button>
            </div>
          </div>
          <div style={css("font-size:11.5px; line-height:1.45; color:rgba(255,255,255,0.88); white-space:pre-wrap; max-height:140px; overflow:auto;")}>{translation.text}</div>
        </div>
      )}

      {/* Auto English translation strip for non-English text */}
      {showGloss && (
        <div style={css("border-radius:8px; padding:7px 9px; margin-bottom:7px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1);")}>
          <span style={css("font-size:9px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.4);")}>
            English translation (for you){autoGlossBusy ? ' …' : ''}{backTranslating ? ' → ' + langLabel : ''}
          </span>
          <textarea
            value={autoGloss}
            onChange={onGlossEdit}
            rows={1}
            placeholder={hasTargetLang ? 'Write in English — it will be translated to ' + langLabel + ' above' : 'English translation'}
            style={css("display:block; width:100%; resize:none; min-height:32px; max-height:140px; padding:6px 9px; margin-top:4px; border-radius:7px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.7); font-size:12px; font-family:'Inter',sans-serif; line-height:1.45; overflow-y:auto; outline:none;")}
          />
        </div>
      )}

      {/* Textarea — drop-in replacement */}
      <textarea
        ref={ref}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full ${className || ''}`}
        style={minHeight ? { minHeight, ...style } : style}
        dir={dir}
        {...rest}
      />

      {/* Slim toolbar */}
      <div style={css("display:flex; align-items:center; gap:4px; margin-top:5px;")}>
        {/* Magic reshape — only when landlordId is provided */}
        {landlordId && (
          <button type="button" onClick={runMagic} disabled={magicBusy || !hasContent}
            title="Magic reshape — rewrite with a fresh, powerful angle"
            className="flex items-center justify-center w-7 h-7 rounded-md transition-all border"
            style={{
              background: magicBusy ? 'rgba(245,158,11,0.18)' : 'linear-gradient(135deg, rgba(245,158,11,0.28), rgba(212,175,55,0.18))',
              color: magicBusy ? '#fcd34d' : '#fbbf24',
              border: '1px solid ' + (magicBusy ? 'rgba(245,158,11,0.5)' : 'rgba(245,158,11,0.55)'),
              cursor: (magicBusy || !hasContent) ? 'not-allowed' : 'pointer',
              opacity: (magicBusy || !hasContent) ? 0.55 : 1,
            }}>
            {magicBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          </button>
        )}

        {/* Translate */}
        <Popover open={transOpen} onOpenChange={setTransOpen}>
          <PopoverTrigger asChild>
            <button type="button" title="Translate" disabled={translating || !hasContent}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-all border"
              style={{
                background: transOpen ? 'rgba(37,99,235,0.18)' : 'transparent',
                color: transOpen ? '#93c5fd' : 'rgba(255,255,255,0.5)',
                border: '1px solid ' + (transOpen ? 'rgba(37,99,235,0.4)' : 'transparent'),
                cursor: (translating || !hasContent) ? 'not-allowed' : 'pointer',
                opacity: (translating || !hasContent) ? 0.5 : 1,
              }}>
              {translating ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" style={{ background: '#1a2235', border: '1px solid rgba(255,255,255,0.15)' }} align="start">
            <div style={css("font-size:10px; font-weight:700; color:rgba(255,255,255,0.6); margin-bottom:5px; letter-spacing:0.04em; text-transform:uppercase;")}>Translate to</div>
            <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:4px;")}>
              {TRANSLATE_LANGS.map((l) => (
                <button key={l.code} type="button" onClick={() => runTranslate(l)}
                  style={css("padding:5px 8px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer; text-align:left; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.82);")}>
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
              className="flex items-center justify-center w-7 h-7 rounded-md transition-all border"
              style={{
                background: toneOpen ? 'rgba(168,85,247,0.18)' : 'transparent',
                color: toneOpen ? '#c4b5fd' : 'rgba(255,255,255,0.5)',
                border: '1px solid ' + (toneOpen ? 'rgba(168,85,247,0.4)' : 'transparent'),
                cursor: (toneBusy || !hasContent) ? 'not-allowed' : 'pointer',
                opacity: (toneBusy || !hasContent) ? 0.5 : 1,
              }}>
              {toneBusy ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-2" style={{ background: '#1a2235', border: '1px solid rgba(255,255,255,0.15)' }} align="start">
            <div style={css("font-size:10px; font-weight:700; color:rgba(255,255,255,0.6); margin-bottom:5px; letter-spacing:0.04em; text-transform:uppercase;")}>Rewrite tone</div>
            <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:4px; max-height:200px; overflow-y:auto;")}>
              {TONE_OPTIONS.map((t) => (
                <button key={t.key} type="button" onClick={() => runTone(t)}
                  style={css("padding:5px 8px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer; text-align:left; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.82);")}>
                  {t.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Divider */}
        <span style={{ flex: 'none', width: 1, height: 18, background: 'rgba(255,255,255,0.07)', margin: '0 2px' }} />

        {/* Live dictation */}
        <DictationMicButton
          value={value}
          onChange={(val) => onChange({ target: { value: val } })}
          size={14}
          disabled={disabled}
          focusTargetRef={ref}
        />
      </div>
    </div>
  );
}