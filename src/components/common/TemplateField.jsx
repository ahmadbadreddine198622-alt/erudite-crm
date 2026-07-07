// TemplateField — a drop-in textarea/input with `{{` merge-field autocomplete.
// Type `{{` (optionally followed by search text) and a popup of all CRM variables
// appears; arrow keys + Enter (or click) inserts `{{variable_key}}`.
// Replacement with real values happens at send/load time via replaceTemplateVars.
//
// Props:
//   value, onChange      — controlled text
//   multiline (bool)     — true → <textarea>, false → <input>
//   placeholder, style, className, rows, autoFocus
//   onKeyDown            — forwarded (Enter-to-send etc.); NOT called while the
//                          popup is open (Enter/Arrows/Esc drive the picker)
//   inputRef             — optional ref forwarded to the underlying element
//   ...rest              — passed to the element

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { TEMPLATE_VARIABLES } from '@/lib/templateVariableCatalog';

export default function TemplateField({
  value, onChange, multiline = true,
  placeholder, style, className, rows, autoFocus,
  onKeyDown, inputRef, ...rest
}) {
  const internalRef = useRef(null);
  const [popup, setPopup] = useState(null); // { start, list, active }

  // Forward the internal ref to an optional external ref (for auto-grow etc.).
  useEffect(() => {
    if (!inputRef) return;
    if (typeof inputRef === 'function') inputRef(internalRef.current);
    else inputRef.current = internalRef.current;
  }, [inputRef]);

  // Detect `{{query` immediately before the caret using the live DOM value.
  const detect = useCallback(() => {
    const el = internalRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? el.value.length;
    const before = String(el.value).slice(0, caret);
    const m = before.match(/\{\{(\w*)$/);
    if (!m) { setPopup(null); return; }
    const query = m[1].toLowerCase();
    const start = m.index;
    const list = TEMPLATE_VARIABLES.filter((v) =>
      !query || v.key.includes(query) || v.label.toLowerCase().includes(query)
    ).slice(0, 8);
    setPopup(list.length ? { start, list, active: 0 } : null);
  }, []);

  const handleChange = (e) => {
    onChange?.(e.target.value);
    // Detect on the next frame so the DOM value is current.
    requestAnimationFrame(detect);
  };

  const close = () => setPopup(null);

  const insert = useCallback((varKey) => {
    const el = internalRef.current;
    if (!el) return;
    const cur = el.value;
    const caret = el.selectionStart ?? cur.length;
    const before = cur.slice(0, popup.start);
    const after = cur.slice(caret);
    const insertion = '{{' + varKey + '}}';
    onChange?.(before + insertion + after);
    setPopup(null);
    requestAnimationFrame(() => {
      const e = internalRef.current;
      if (!e) return;
      e.focus();
      const pos = before.length + insertion.length;
      e.setSelectionRange(pos, pos);
    });
  }, [onChange, popup]);

  const handleKeyDown = (e) => {
    if (popup && popup.list.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPopup((p) => ({ ...p, active: Math.min(p.list.length - 1, p.active + 1) }));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPopup((p) => ({ ...p, active: Math.max(0, p.active - 1) }));
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        insert(popup.list[popup.active].key);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
    }
    onKeyDown?.(e);
  };

  // Close popup when clicking outside or when the field loses focus.
  useEffect(() => {
    if (!popup) return;
    const onDown = (ev) => {
      if (internalRef.current && !internalRef.current.contains(ev.target)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [popup]);

  const Element = multiline ? 'textarea' : 'input';

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <Element
        ref={internalRef}
        value={value ?? ''}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={style}
        className={className}
        rows={multiline ? rows : undefined}
        autoFocus={autoFocus}
        {...rest}
      />
      {popup && (
        <div
          style={{
            position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
            zIndex: 50, minWidth: 220, maxWidth: 300,
            background: '#1a2235', border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', padding: '5px 9px 3px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            Insert variable
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {popup.list.map((v, i) => {
              const on = i === popup.active;
              return (
                <button
                  key={v.key}
                  type="button"
                  onMouseEnter={() => setPopup((p) => ({ ...p, active: i }))}
                  onMouseDown={(e) => { e.preventDefault(); insert(v.key); }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    width: '100%', padding: '6px 9px', textAlign: 'left', cursor: 'pointer',
                    background: on ? 'rgba(38,92,250,0.18)' : 'transparent',
                    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 600, color: on ? '#93c5fd' : 'rgba(255,255,255,0.85)', fontFamily: "'Inter',sans-serif" }}>
                    {v.label}
                  </span>
                  <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', marginTop: 1 }}>
                    {'{{' + v.key + '}}'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}