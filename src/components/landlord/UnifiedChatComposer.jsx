// UnifiedChatComposer — compact HubSpot-style composer for the WhatsApp, Telegram and SMS
// landlord tabs. One short auto-growing textarea + a single slim icon toolbar:
//   [Templates] [Meta Business Templates — business WA only] [AI suggested messages — Chat only]
//   [Save as template] [Send]
// No big labeled buttons, no stacked text fields. Navy/gold Erudite styling preserved.
//
// This is a LAYOUT-ONLY redesign — all send/template logic stays in the parent (LandlordDetailPage).

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Save, FileText, X, Zap } from 'lucide-react';
import EmailTemplatePicker from './EmailTemplatePicker';
import ChatTemplatePanel from './ChatTemplatePanel';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

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
}) {
  const [aiOpen, setAiOpen] = useState(false);
  const taRef = useRef(null);

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
  const busy = !!(sending || parsing);
  const canSend = !!((text || '').trim()) && !busy && !channelDisabled;

  return (
    <div style={css("position:relative;")}>
      {/* Meta Business Templates panel — business WhatsApp only, toggled by the toolbar icon */}
      {composerType === 'Chat' && streamFilter === 'business' && chatTemplatesOpen && (
        <div style={css("margin-bottom:8px;")}>
          <ChatTemplatePanel landlordId={landlordId} phone={phone} onClose={onToggleChatTemplates} />
        </div>
      )}

      {/* Compact auto-growing textarea */}
      <textarea
        ref={taRef}
        value={text}
        onChange={onTextChange}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder={placeholder}
        style={css(
          "display:block; width:100%; resize:none; min-height:38px; max-height:140px; "+
          "padding:8px 11px; border-radius:10px; "+
          "background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); "+
          "color:rgba(255,255,255,0.9); font-size:12.5px; font-family:'Inter',sans-serif; line-height:1.4; overflow-y:auto; outline:none;"
        )}
      />

      {channelDisabled && (
        <div style={css("margin-top:6px; padding:6px 10px; border-radius:8px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); font-size:10.5px; color:#fca5a5;")}>⚠ {disabledHint || 'Channel not configured'}</div>
      )}
      {/* Slim icon toolbar — single row */}
      <div style={css("display:flex; align-items:center; gap:4px; margin-top:6px;")}>
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

        {/* Send — icon button at the end */}
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          title={parsing ? 'Parsing…' : 'Send'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 32, borderRadius: 8, flex: 'none',
            background: canSend ? 'linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%))' : 'rgba(255,255,255,0.08)',
            color: canSend ? '#1a1205' : 'rgba(255,255,255,0.4)',
            border: '1px solid ' + (canSend ? 'hsl(38 92% 50% / 0.5)' : 'rgba(255,255,255,0.1)'),
            cursor: canSend ? 'pointer' : 'not-allowed',
            marginLeft: 'auto',
          }}
        >
          {busy ? (
            <span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'ld-spin 0.7s linear infinite' }} />
          ) : (
            <Send size={15} />
          )}
        </button>
      </div>
    </div>
  );
}