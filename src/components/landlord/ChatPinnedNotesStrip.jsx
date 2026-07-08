// ChatPinnedNotesStrip — pinned notes panel shown at the TOP of the WhatsApp tab,
// above the message thread (outside the scroll, so it's always the first thing
// visible when the chat opens).
//
// Shows the landlord's latest notes (pinned notes first), lets the agent add a
// quick update note without leaving the chat, and has a button that jumps focus
// straight down to the WhatsApp composer ready to type.
//
// Props:
//   landlordId        (string) — Landlord entity id
//   onJumpToComposer  (fn)     — focus the WhatsApp composer textarea
//   onNoteAdded       (fn)     — optional; called with ({ body }) after a note
//                                is saved so the parent can push it into the
//                                local activity stream optimistically.

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Pin, ChevronDown, Loader2, CornerRightDown } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentUser } from '@/lib/useCurrentUser';

const GOLD = 'hsl(38 92% 55%)';
const MAX_VISIBLE = 3; // show up to 3 latest notes expanded; the rest behind "show all"

export default function ChatPinnedNotesStrip({ landlordId, onJumpToComposer, onNoteAdded }) {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [update, setUpdate] = useState('');

  const { data: notes = [] } = useQuery({
    queryKey: ['chat-pinned-notes', landlordId],
    queryFn: async () => {
      const all = await base44.entities.LandlordNote.filter({ landlord_id: landlordId }, '-created_date', 50);
      // pinned first, then newest first — same ordering rule as the Notes panel
      return [...all.filter(n => n.pinned), ...all.filter(n => !n.pinned)];
    },
    enabled: !!landlordId,
  });

  const createMutation = useMutation({
    mutationFn: (body) => base44.entities.LandlordNote.create({
      landlord_id: landlordId,
      body,
      author_email: user?.email || null,
      author_name: user?.full_name || user?.email?.split('@')[0] || null,
      pinned: false,
    }),
    onSuccess: (_res, body) => {
      qc.invalidateQueries({ queryKey: ['chat-pinned-notes', landlordId] });
      qc.invalidateQueries({ queryKey: ['landlord-notes', landlordId] });
      setUpdate('');
      toast.success('Update saved');
      if (onNoteAdded) onNoteAdded({ body });
    },
    onError: (e) => toast.error('Failed to save update: ' + (e?.message || 'unknown error')),
  });

  const saveUpdate = () => {
    const t = update.trim();
    if (t && !createMutation.isPending) createMutation.mutate(t);
  };

  if (!notes.length) return null; // no notes → no strip; chat looks exactly as before

  const latest = notes[0];
  const visible = showAll ? notes : notes.slice(0, MAX_VISIBLE);
  const hiddenCount = notes.length - visible.length;

  return (
    <div style={{
      flex: 'none',
      margin: '6px 16px 2px',
      borderRadius: 12,
      border: '1px solid rgba(245,158,11,0.28)',
      background: 'rgba(245,158,11,0.06)',
      overflow: 'hidden',
      fontFamily: "'Inter',sans-serif",
    }}>
      {/* Header row — always visible; click to collapse/expand */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', userSelect: 'none' }}
      >
        <Pin size={12} style={{ color: GOLD, flex: 'none' }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: GOLD, flex: 'none' }}>
          Notes {notes.length > 1 ? '· ' + notes.length : ''}
        </span>
        {collapsed && (
          <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: 'hsl(38 92% 70%)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {latest.body}
          </span>
        )}
        {!collapsed && <span style={{ flex: 1 }} />}
        {/* Jump to composer — stops propagation so it doesn't toggle collapse */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onJumpToComposer && onJumpToComposer(); }}
          title="Jump down to the WhatsApp composer"
          style={{
            flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
            fontSize: 10.5, fontWeight: 700, fontFamily: "'Inter',sans-serif",
            background: 'rgba(37,211,102,0.14)', border: '1px solid rgba(37,211,102,0.4)', color: '#4ade80',
          }}
        >
          <CornerRightDown size={12} /> Write message
        </button>
        <ChevronDown size={13} style={{ flex: 'none', color: 'rgba(255,255,255,0.45)', transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s ease' }} />
      </div>

      {/* Expanded body — note cards + quick update input */}
      {!collapsed && (
        <div style={{ padding: '0 12px 9px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 170, overflowY: 'auto' }}>
            {visible.map(n => (
              <div key={n.id} style={{
                borderRadius: 9,
                padding: '7px 10px',
                background: n.pinned ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
                border: n.pinned ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  {n.pinned && <Pin size={10} style={{ color: GOLD, flex: 'none' }} />}
                  <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.45)' }}>
                    {(n.author_name || n.author_email?.split('@')[0] || 'Agent')}
                    {n.created_date ? ' · ' + format(new Date(n.created_date), 'd MMM HH:mm') : ''}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.45, color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {n.body}
                </p>
              </div>
            ))}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.5)', padding: '1px 2px', fontFamily: "'Inter',sans-serif" }}
              >
                Show {hiddenCount} more…
              </button>
            )}
          </div>

          {/* Quick update input — saves a new LandlordNote without leaving the chat */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              value={update}
              onChange={e => setUpdate(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveUpdate(); } }}
              placeholder="＋ Add update… (Enter to save)"
              style={{
                flex: 1, minWidth: 0, padding: '6px 10px', borderRadius: 8, fontSize: 11.5,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(245,158,11,0.22)',
                color: 'rgba(255,255,255,0.9)', outline: 'none', fontFamily: "'Inter',sans-serif",
              }}
            />
            {createMutation.isPending && <Loader2 size={14} style={{ flex: 'none', color: GOLD }} className="animate-spin" />}
          </div>
        </div>
      )}
    </div>
  );
}
