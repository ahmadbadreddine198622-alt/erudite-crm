// NoteCard — a single note card matching the Erudite note-feed design.
// Layout: [icon] Note            [timestamp]
//         [NOTE badge] by [author]
//         [dark body container with note text]
//         [💬 Comment button (gold)]  → toggles ActivityCommentThread
//
// Props:
//   note        — stream item { actTitle, actBody, time, order, _entityType, _entityId, _author }
//   landlordId  — current landlord id (for comment creation)
//   comments    — array of ActivityComment records for this landlord
//   isAdmin, canCoach, currentUser — permission context for coaching

import React, { useState, useMemo } from 'react';
import { FilePen, MessageSquare } from 'lucide-react';
import ReadAloudButton from '@/components/shared/ReadAloudButton';
import HighlightedText from '@/components/shared/HighlightedText';
import ActivityCommentThread from './ActivityCommentThread';

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

// Format a timestamp as "Mon, 06 Jul 2026 at 04:08" (Asia/Dubai locale).
function fmtNoteTime(order, timeStr) {
  const ts = order && order > 0 ? new Date(order) : (timeStr ? new Date(timeStr) : null);
  if (!ts || isNaN(ts)) return timeStr || '';
  const weekday = ts.toLocaleString('en-GB', { weekday: 'short' });
  const day = ts.toLocaleString('en-GB', { day: '2-digit' });
  const month = ts.toLocaleString('en-GB', { month: 'short' });
  const year = ts.getFullYear();
  const hh = String(ts.getHours()).padStart(2, '0');
  const mm = String(ts.getMinutes()).padStart(2, '0');
  return `${weekday}, ${day} ${month} ${year} at ${hh}:${mm}`;
}

export default function NoteCard({ note, landlordId, comments, isAdmin, canCoach, currentUser }) {
  const [showComments, setShowComments] = useState(false);

  const noteComments = useMemo(() => {
    if (!comments || !note?._entityId) return [];
    return comments.filter(c => c.activity_type === note._entityType && c.activity_id === note._entityId);
  }, [comments, note]);

  const body = note?.actBody || note?.body || '';
  const author = note?._author || note?.author || '';
  const timeLabel = fmtNoteTime(note?.order, note?.time);

  return (
    <div style={css("border-radius:12px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.025); overflow:hidden;")}>
      {/* Header row: icon + "Note" title + timestamp */}
      <div style={css("display:flex; align-items:center; gap:8px; padding:10px 14px 0;")}>
        <span style={{ flex: 'none', width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', color: GOLD, border: '1px solid rgba(255,255,255,0.1)' }}>
          <FilePen size={13} />
        </span>
        <span style={css("font-size:13px; font-weight:700; color:rgba(255,255,255,0.92); font-family:'Inter',sans-serif;")}>Note</span>
        <span style={css("flex:1;")} />
        <span style={css("font-size:10px; color:rgba(255,255,255,0.4); white-space:nowrap; font-family:'Inter',sans-serif;")}>{timeLabel}</span>
      </div>

      {/* Sub-header: NOTE badge + author */}
      <div style={css("display:flex; align-items:center; gap:6px; padding:4px 14px 0 48px;")}>
        <span style={css("font-size:8px; font-weight:700; letter-spacing:0.05em; padding:1px 6px; border-radius:4px; color:rgba(255,255,255,0.7); background:rgba(255,255,255,0.1); font-family:'Inter',sans-serif;")}>NOTE</span>
        {author && <span style={css("font-size:10px; color:rgba(255,255,255,0.45); font-family:'Inter',sans-serif;")}>by {author}</span>}
      </div>

      {/* Body container */}
      <div style={css("margin:6px 14px 0; padding:9px 12px; border-radius:9px; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.05);")}>
        <div style={css("display:flex; align-items:flex-start; gap:5px;")}>
          <HighlightedText text={body} title={`Note · ${author || 'Unknown'} · ${timeLabel}`} style={css("flex:1; margin:0; font-size:12px; line-height:1.5; color:rgba(255,255,255,0.82); white-space:pre-wrap; word-break:break-word; font-family:'Inter',sans-serif;")} />
          <div style={{ flex: 'none', display: 'flex', marginTop: 1 }}>
            <ReadAloudButton text={body} title={`Note · ${author || 'Unknown'} · ${timeLabel}`} size={22} />
          </div>
        </div>
      </div>

      {/* Footer: Comment button */}
      <div style={css("display:flex; align-items:center; gap:6px; padding:7px 14px 9px 48px;")}>
        <button
          type="button"
          onClick={() => setShowComments(s => !s)}
          style={css("display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:7px; font-size:10.5px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(212,180,131,0.08); color:" + GOLD + "; border:1px solid rgba(212,180,131,0.25);")}>
          <MessageSquare size={11} />
          Comment{noteComments.length > 0 ? ` (${noteComments.length})` : ''}
        </button>
      </div>

      {/* Comment thread — toggled by the Comment button */}
      {showComments && note?._entityType && note?._entityId && (
        <div style={css("margin:0 14px 9px 48px;")}>
          <ActivityCommentThread
            comments={noteComments}
            landlordId={landlordId}
            activityType={note._entityType}
            activityId={note._entityId}
            isAdmin={isAdmin}
            canCoach={canCoach}
            currentUser={currentUser}
          />
        </div>
      )}
    </div>
  );
}