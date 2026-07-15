// PersistentNotesPanel — always-visible compact notes panel for the landlord
// sidebar. Shows the most recent notes + a quick-add input, so the agent can
// jot down a note without leaving the current tab (WhatsApp, Email, Calls, etc.).
//
// Props:
//   landlordId  (string)
//   notes       (array) — stream items with t:'act' && kind:'note'
//   onSaveNote  (fn)    — called with the note body text
//   saving      (bool)  — disables the input while a save is in flight

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, StickyNote, ChevronDown, ChevronUp } from 'lucide-react';
import WritingField from '@/components/shared/WritingField';

const GOLD = '#d4af37';

export default function PersistentNotesPanel({ landlordId, notes = [], onSaveNote, saving = false }) {
  const [text, setText] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const inputRef = useRef(null);

  // Auto-grow the textarea
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(100, Math.max(32, ta.scrollHeight)) + 'px';
  }, [text]);

  const handleSend = () => {
    const body = text.trim();
    if (!body || !onSaveNote || saving) return;
    onSaveNote(body);
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const recentNotes = notes.slice(-5).reverse();

  return (
    <div style={{
      marginTop: 14,
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.02)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 13px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: "'Inter',sans-serif",
        }}
      >
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: GOLD,
        }}>
          <StickyNote size={12} />
          Quick Notes
          {recentNotes.length > 0 && (
            <span style={{
              fontSize: 8.5, fontWeight: 600, color: 'rgba(255,255,255,0.35)',
              background: 'rgba(255,255,255,0.06)', borderRadius: 99, padding: '1px 6px',
            }}>{recentNotes.length}</span>
          )}
        </span>
        {collapsed
          ? <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.35)' }} />
          : <ChevronUp size={13} style={{ color: 'rgba(255,255,255,0.35)' }} />}
      </button>

      {!collapsed && (
        <div style={{ padding: '0 10px 10px' }}>
          {/* Recent notes — compact list */}
          {recentNotes.length > 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 4,
              marginBottom: 8, maxHeight: 160, overflowY: 'auto',
            }}>
              {recentNotes.map((n, i) => (
                <div key={i} style={{
                  padding: '6px 9px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{
                    fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.35)',
                    marginBottom: 2, fontFamily: "'Inter',sans-serif",
                  }}>{n.time || ''}</div>
                  <div style={{
                    fontSize: 11.5, lineHeight: 1.4, color: 'rgba(255,255,255,0.75)',
                    fontFamily: "'Inter',sans-serif",
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                  }}>{n.body || n.text || ''}</div>
                </div>
              ))}
            </div>
          )}

          {/* Quick-add input */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 6,
            borderRadius: 9, padding: '5px 6px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <WritingField
                inputRef={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Quick note… (Enter to save)"
                rows={1}
                minHeight={28}
                style={{
                  resize: 'none', maxHeight: 100,
                  border: 'none', outline: 'none', background: 'transparent',
                  color: 'rgba(255,255,255,0.9)', fontSize: 12,
                  fontFamily: "'Inter',sans-serif", lineHeight: 1.4,
                }}
                landlordId={landlordId}
                channel="note"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!text.trim() || saving}
              title="Save note"
              style={{
                flex: 'none', width: 28, height: 28, borderRadius: 7,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: (!text.trim() || saving) ? 'not-allowed' : 'pointer',
                background: text.trim() ? 'linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%))' : 'rgba(255,255,255,0.06)',
                color: text.trim() ? '#1a1205' : 'rgba(255,255,255,0.3)',
                border: '1px solid ' + (text.trim() ? 'hsl(38 92% 50% / 0.5)' : 'rgba(255,255,255,0.08)'),
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={12} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}