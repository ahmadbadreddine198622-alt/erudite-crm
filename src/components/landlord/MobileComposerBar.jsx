import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

/* Convert a CSS declaration string into a React style object. */
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

/*
 * Mobile/tablet-only slim composer bar + "＋" action sheet.
 * Renders the chosen-mode input + send button always-visible, and tucks the full
 * action set (Note/Task/Follow-up/Appointment/Chat/iMessage/Telegram/Email + SmartTask +
 * Smart Calendar) into a slide-up bottom sheet opened by the ＋ button. Picking an action
 * calls setComposerType (reusing the page's existing logic) and closes the sheet.
 *
 * Only the slim Note/Task/Follow-up/Chat/Telegram text flow uses this input; iMessage,
 * Email and Appointment have their own dedicated panels (rendered by the page) and the
 * picker simply switches composerType so those panels mount above the bar.
 */
export default function MobileComposerBar({
  composerType,
  composerText,
  placeholder,
  busy,
  composerTypes,        // [{ label, icon, onClick, ... }]
  onInput,              // (e) => void
  onSend,               // () => void
  onSetType,            // (label) => void
  onSmartTask,          // () => void
  onSmartCalendar,      // () => void
  textareaRef,
  panelMode,            // true when the active type renders its own dedicated panel (iMessage/Email/Appointment)
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const pick = (fn) => { fn && fn(); setSheetOpen(false); };

  const tileStyle = (active) => css(
    "display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:14px 8px; border-radius:14px; cursor:pointer; font-family:'Inter',sans-serif; font-size:12px; font-weight:600; "+
    "background:"+(active ? "hsl(38 92% 50% / 0.16)" : "rgba(255,255,255,0.05)")+"; "+
    "color:"+(active ? "hsl(38 92% 62%)" : "rgba(255,255,255,0.78)")+"; "+
    "border:1px solid "+(active ? "hsl(38 92% 50% / 0.45)" : "rgba(255,255,255,0.1)")+";"
  );

  return (
    <React.Fragment>
      {/* Slim docked bar: ＋ + input + send. Sits above the app dock via the wrapper's padding. */}
      <div style={css("display:flex; align-items:flex-end; gap:8px;")}>
        <button
          onClick={() => setSheetOpen(true)}
          aria-label="More actions"
          style={css("flex:none; width:42px; height:42px; border-radius:12px; border:1px solid hsl(38 92% 50% / 0.4); background:hsl(38 92% 50% / 0.12); color:hsl(38 92% 62%); display:flex; align-items:center; justify-content:center; cursor:pointer;")}
        >
          <Plus size={20} />
        </button>

        {!panelMode && (
          <React.Fragment>
            <textarea
              ref={textareaRef}
              value={composerText}
              onChange={onInput}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if ((composerText || '').trim()) onSend(); } }}
              placeholder={placeholder}
              rows={1}
              style={css("flex:1; resize:none; min-height:42px; max-height:120px; padding:11px 13px; border-radius:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.9); font-size:14px; font-family:'Inter',sans-serif; line-height:1.4; overflow-y:auto;")}
            />
            <button
              onClick={onSend}
              disabled={busy}
              aria-label="Send"
              style={css("flex:none; width:42px; height:42px; border-radius:12px; border:1px solid hsl(38 92% 50% / 0.5); background:linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%)); color:#1a1205; font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center; opacity:"+(busy ? 0.6 : 1)+";")}
            >
              {busy ? '…' : '➤'}
            </button>
          </React.Fragment>
        )}

        {panelMode && (
          <div style={css("flex:1; display:flex; align-items:center; padding:0 12px; height:42px; border-radius:12px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); font-size:12.5px; color:rgba(255,255,255,0.5);")}>
            Use the {composerType} panel above to send
          </div>
        )}
      </div>

      {/* Bottom sheet — full action set */}
      {sheetOpen && (
        <div
          onClick={() => setSheetOpen(false)}
          style={css("position:fixed; inset:0; z-index:1000; background:rgba(0,0,0,0.55); backdrop-filter:blur(4px); display:flex; align-items:flex-end;")}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ ...css("width:100%; border-radius:20px 20px 0 0; background:hsl(222 47% 9%); border:1px solid rgba(255,255,255,0.1); border-bottom:none; padding:14px 16px; animation: ld-rise 0.25s cubic-bezier(0.22,1,0.36,1) both;"), paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}
          >
            <div style={css("display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;")}>
              <span style={css("font-size:13px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.6);")}>New action</span>
              <button onClick={() => setSheetOpen(false)} aria-label="Close" style={css("width:30px; height:30px; border-radius:9px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.05); color:rgba(255,255,255,0.6); display:flex; align-items:center; justify-content:center; cursor:pointer;")}>
                <X size={16} />
              </button>
            </div>

            <div style={css("display:grid; grid-template-columns:repeat(4, 1fr); gap:8px;")}>
              {composerTypes.map((t) => (
                <button key={t.label} onClick={() => pick(() => onSetType(t.label))} style={tileStyle(composerType === t.label)}>
                  <span style={css("font-size:18px; line-height:1;")}>{t.icon || '•'}</span>
                  {t.label}
                </button>
              ))}
              <button onClick={() => pick(onSmartTask)} style={tileStyle(false)}>
                <span style={css("font-size:18px; line-height:1;")}>🗓</span>
                SmartTask
              </button>
              <button onClick={() => pick(onSmartCalendar)} style={tileStyle(composerType === 'Appointment')}>
                <span style={css("font-size:18px; line-height:1;")}>📅</span>
                Calendar
              </button>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}