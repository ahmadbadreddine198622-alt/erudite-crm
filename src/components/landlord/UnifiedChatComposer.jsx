// UnifiedChatComposer — compact HubSpot-style composer for the WhatsApp, Telegram and SMS
// landlord tabs. One short auto-growing textarea + a single slim icon toolbar:
//   [Templates] [Meta Business Templates — business WA only] [AI suggested messages — Chat only]
//   [Save as template] [Send]
// No big labeled buttons, no stacked text fields. Navy/gold Erudite styling preserved.
//
// This is a LAYOUT-ONLY redesign — all send/template logic stays in the parent (LandlordDetailPage).

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Save, FileText, X, Zap, Paperclip, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import EmailTemplatePicker from './EmailTemplatePicker';
import EmojiPicker from './EmojiPicker';
import ModernComposerField from './ModernComposerField';
import TemplateField from '@/components/common/TemplateField';
import ChatTemplatePanel from './ChatTemplatePanel';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

// Infer a coarse media type from filename / mime so the backend can pick the
// right send endpoint (image vs document vs video vs audio).
function detectMediaType(filename, mime) {
  const ext = String(filename || '').toLowerCase().split('.').pop();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  if (['mp4', 'mov', '3gp', 'webm', 'mkv'].includes(ext)) return 'video';
  if (['mp3', 'ogg', 'aac', 'm4a', 'opus', 'wav'].includes(ext)) return 'audio';
  if (mime) {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
  }
  return 'document';
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

const tplBtn = (on, color) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
  background: on ? (color + '22') : 'transparent',
  color: on ? color : 'rgba(255,255,255,0.6)',
  border: '1px solid ' + (on ? (color + '55') : 'transparent'),
  transition: 'background 0.15s, border-color 0.15s',
});

export default function UnifiedChatComposer({
  composerType,        // 'Chat' | 'Telegram' | 'SMS'
  text, onTextChange, onKeyDown,
  onSend, sending, parsing,
  placeholder,
  tplChannel,          // 'whatsapp' | 'telegram' | 'sms'
  onPickTemplate,      // fn(body) — load a user template body into the composer
  onSaveTemplate,      // fn() — open the save-as-template dialog
  aiSuggestedMessages, // array (Chat only)
  onPickSuggested,     // fn(text)
  chatTemplatesOpen, onToggleChatTemplates, // Meta Business templates (business WA only)
  landlordId, phone,
  streamFilter,        // 'business' | 'personal' (Chat only)
  channelDisabled = false,
  disabledHint = '',
  attachment,          // { file_url, file_name, media_type } | null — current pending attachment
  onAttachmentChange,  // fn(att | null) — set/clear the pending attachment in parent state
  targetLanguage,     // landlord's preferred language code — enables bidirectional EN↔target editing
  extraToolbarChildren, // additional React nodes rendered in the ModernComposerField toolbar (e.g. EruditeToneButton)
  }) {
  const [aiOpen, setAiOpen] = useState(false);
  const taRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [llCtx, setLlCtx] = useState(null);

  // Fetch the landlord record once so the magic-reshape button can ground its
  // rewrites in the exact unit + project + asking price.
  useEffect(() => {
    let mounted = true;
    if (!landlordId) return;
    (async () => {
      try {
        const l = await base44.entities.Landlord.get(landlordId);
        if (mounted) setLlCtx({
          name: l?.full_name_en || l?.full_name || '',
          unit: l?.unit_reference || '',
          project: l?.project_name || '',
          asking: l?.asking_price_aed || '',
          agentName: l?.assigned_agent_email || '',
        });
      } catch (_) {}
    })();
    return () => { mounted = false; };
  }, [landlordId]);

  // Attachment is only available for WhatsApp and Telegram (not SMS).
  const canAttach = composerType === 'Chat' || composerType === 'Telegram';

  // Pick a file, upload it to Base44 storage, then hand the URL to the parent.
  const handleFilePick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    const maxMb = 25;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`File too large (max ${maxMb} MB)`);
      return;
    }
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      const url = res?.file_url || res?.data?.file_url || res?.url;
      if (!url) throw new Error('Upload failed — no file URL returned');
      onAttachmentChange && onAttachmentChange({
        file_url: url,
        file_name: file.name,
        media_type: detectMediaType(file.name, file.type),
        mime: file.type || '',
      });
    } catch (err) {
      toast.error('Upload failed: ' + (err?.message || 'unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = () => onAttachmentChange && onAttachmentChange(null);

  const suggestions = (Array.isArray(aiSuggestedMessages) ? aiSuggestedMessages : [])
    .filter(m => m && typeof m === 'object' && typeof m.text === 'string' && m.text.trim());
  const hasAi = suggestions.length > 0;

  // Auto-grow: short by default, expands only as the user types more.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(140, Math.max(38, ta.scrollHeight)) + 'px';
  }, [text, composerType]);

  const accent = composerType === 'Telegram' ? '#29b6f6' : composerType === 'SMS' ? '#60a5fa' : '#25D366';
  const busy = !!(sending || parsing || uploading);
  const hasContent = !!((text || '').trim()) || !!attachment;
  const canSend = hasContent && !busy && !channelDisabled;

  // Insert an emoji at the cursor position in the textarea, then restore focus.
  const insertEmoji = (emoji) => {
    const ta = taRef.current;
    if (!ta) { onTextChange({ target: { value: (text || '') + emoji } }); return; }
    const start = ta.selectionStart ?? (text || '').length;
    const end = ta.selectionEnd ?? (text || '').length;
    const next = (text || '').slice(0, start) + emoji + (text || '').slice(end);
    onTextChange({ target: { value: next } });
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + emoji.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  return (
    <div style={css("position:relative;")}>
      {/* Meta Business Templates panel — business WhatsApp only, toggled by the toolbar icon */}
      {composerType === 'Chat' && streamFilter === 'business' && chatTemplatesOpen && (
        <div style={css("margin-bottom:8px;")}>
          <ChatTemplatePanel landlordId={landlordId} phone={phone} onClose={onToggleChatTemplates} />
        </div>
      )}

      {channelDisabled && (
        <div style={css("margin-top:6px; padding:6px 10px; border-radius:8px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); font-size:10.5px; color:#fca5a5;")}>⚠ {disabledHint || 'Channel not configured'}</div>
      )}

      {/* Pending attachment chip */}
      {attachment && (
        <div style={css("margin-top:6px; display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:9px; background:" + accent + "1a; border:1px solid " + accent + "44;")}>
          <span style={{ flex: 'none', width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: accent + '33', color: accent, fontSize: 13 }}>
            {attachment.media_type === 'image' ? '🖼' : attachment.media_type === 'video' ? '🎬' : attachment.media_type === 'audio' ? '🎵' : '📎'}
          </span>
          <span style={css("flex:1; min-width:0; font-size:11.5px; color:rgba(255,255,255,0.85); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;")}>
            {attachment.file_name || 'Attachment'}
          </span>
          <button type="button" onClick={removeAttachment} title="Remove attachment"
            style={css("flex:none; cursor:pointer; background:none; border:none; color:rgba(255,255,255,0.5); padding:2px; display:flex;")}>
            <X size={13} />
          </button>
        </div>
      )}
      <ModernComposerField
        value={text}
        onChange={onTextChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        onSend={onSend}
        sending={busy}
        sendDisabled={channelDisabled}
        accent={accent}
        voiceEnabled={composerType !== 'SMS'}
        voiceCanSendAudio={composerType !== 'SMS'}
        onVoiceSent={(url, name) => { if (onAttachmentChange) onAttachmentChange({ file_url: url, file_name: name, media_type: 'audio', mime: 'audio/webm' }); setTimeout(() => { if (onSend) onSend(); }, 80); }}
        onVoiceText={(t) => onTextChange({ target: { value: t } })}
        targetLanguage={targetLanguage}
        landlordContext={llCtx}
        landlordId={landlordId}
        channel={tplChannel}
        inputRef={taRef}
        minHeight={44}
      >
        {/* Extra toolbar children (EruditeToneButton etc.) */}
        {extraToolbarChildren}
        {/* User message templates (MessageTemplate entity) */}
        <div style={css("position:relative;")}>
          <EmailTemplatePicker channel={tplChannel} landlordId={landlordId} compact onSelect={({ body }) => onPickTemplate(body || '')} />
        </div>

        {/* Meta Business Templates — business WhatsApp only */}
        {composerType === 'Chat' && streamFilter === 'business' && (
          <button
            type="button"
            onClick={onToggleChatTemplates}
            title="Meta Business Templates"
            style={tplBtn(chatTemplatesOpen, 'hsl(38 92% 60%)')}
          >
            <FileText size={14} />
          </button>
        )}

        {/* AI suggested messages — Chat only, when available */}
        {composerType === 'Chat' && hasAi && (
          <Popover open={aiOpen} onOpenChange={setAiOpen}>
            <PopoverTrigger asChild>
              <button type="button" title="AI suggested messages" style={tplBtn(aiOpen, '#a78bfa')}>
                <Sparkles size={14} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-72 p-2"
              style={{ background: '#1a2235', border: '1px solid rgba(139,92,246,0.35)' }}
            >
              <div style={css("display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;")}>
                <span style={css("font-size:11px; font-weight:700; color:#c4b5fd; display:flex; align-items:center; gap:5px;")}>
                  <Sparkles size={12} /> AI Suggested Messages
                </span>
                <button type="button" onClick={() => setAiOpen(false)} style={css("cursor:pointer; background:none; border:none; color:rgba(255,255,255,0.4);")}>
                  <X size={13} />
                </button>
              </div>
              <div style={css("display:flex; flex-direction:column; gap:4px; max-height:220px; overflow-y:auto;")}>
                {suggestions.map((m, i) => {
                  const isCold = m.mode === 'cold_open';
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { onPickSuggested(m.text.trim()); setAiOpen(false); }}
                      title="Load into message box"
                      style={css(
                        "display:flex; flex-direction:column; align-items:flex-start; gap:3px; text-align:left; width:100%; padding:6px 9px; border-radius:8px; cursor:pointer; font-family:'Inter',sans-serif; "+
                        "background:rgba(139,92,246,0.07); border:1px solid rgba(139,92,246,0.25);"
                      )}
                    >
                      <span style={css("display:flex; align-items:center; gap:6px; width:100%;")}>
                        <span style={css(
                          "flex:none; padding:1px 6px; border-radius:99px; font-size:8px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; "+
                          (isCold ? "background:rgba(59,130,246,0.16); color:#93c5fd;" : "background:rgba(37,211,102,0.16); color:#4ade80;")
                        )}>{isCold ? 'Cold open' : 'Reply'}</span>
                        {m.tone && <span style={css("flex:none; font-size:9px; font-weight:600; color:rgba(255,255,255,0.4);")}>{m.tone}</span>}
                        {m.language && m.language !== 'en' && <span style={css("flex:none; margin-left:auto; font-size:9px; font-weight:600; color:rgba(255,255,255,0.35); text-transform:uppercase;")}>{m.language}</span>}
                      </span>
                      <span style={css("font-size:11.5px; line-height:1.4; color:rgba(255,255,255,0.85);")}>{m.text.trim()}</span>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Save as template */}
        <button
          type="button"
          onClick={onSaveTemplate}
          disabled={!((text || '').trim())}
          title="Save as template"
          style={tplBtn(false, 'rgba(255,255,255,0.7)')}
        >
          <Save size={14} />
        </button>

        {/* Emoji picker */}
        <EmojiPicker onSelect={insertEmoji} />

        {/* Attachment picker — WhatsApp + Telegram only */}
        {canAttach && (
          <>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFilePick} />
            <button
              type="button"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              disabled={busy}
              title="Attach a file"
              style={tplBtn(!!attachment, accent)}
            >
              {uploading
                ? <Loader2 size={14} className="animate-spin" />
                : <Paperclip size={14} />}
            </button>
          </>
        )}
      </ModernComposerField>
    </div>
  );
}