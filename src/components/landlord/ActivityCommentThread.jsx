// ActivityCommentThread — renders founder coaching comments attached to a specific
// activity item (email, WhatsApp, iMessage, note, task, etc.) and provides an inline
// comment input. Comments are visually distinct (gold/red) so agents instantly spot
// founder feedback teaching them what they're doing right/wrong.
//
// Props:
//   comments     — array of ActivityComment records for this activity
//   landlordId   — current landlord ID
//   activityType — the entity type of the parent activity (e.g. 'email', 'whatsapp')
//   activityId   — the entity record ID of the parent activity
//   isAdmin      — whether the current user can delete comments
//   currentUser  — the current user object ({ email, full_name })

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { MessageSquarePlus, X, Loader2, Trash2, Crown } from 'lucide-react';

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

const PRIORITY_META = {
  urgent:    { label: 'URGENT',    color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)' },
  important:{ label: 'IMPORTANT', color: '#C9A24B', bg: 'rgba(201,162,75,0.08)',  border: 'rgba(201,162,75,0.3)' },
  normal:   { label: 'NOTE',      color: 'rgba(255,255,255,0.6)', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.1)' },
};

export default function ActivityCommentThread({ comments, landlordId, activityType, activityId, isAdmin, currentUser }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [priority, setPriority] = useState('important');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['activity_comments', landlordId] });

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await base44.entities.ActivityComment.create({
        landlord_id: landlordId,
        activity_type: activityType,
        activity_id: activityId,
        comment_text: text.trim(),
        priority,
        author_email: currentUser?.email || null,
        author_name: currentUser?.full_name || currentUser?.email?.split('@')[0] || null,
      });
      toast.success('Comment added');
      setText('');
      setOpen(false);
      refresh();
    } catch (e) {
      toast.error('Failed to add comment: ' + (e?.message || 'unknown'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.ActivityComment.delete(id);
      refresh();
    } catch (e) {
      toast.error('Failed to delete: ' + (e?.message || 'unknown'));
    }
  };

  const sortedComments = [...(comments || [])].sort((a, b) => {
    const ta = new Date(a.created_date || 0).getTime();
    const tb = new Date(b.created_date || 0).getTime();
    return ta - tb; // oldest first (conversation order)
  });

  return (
    <div style={css("margin:0 8px 8px 52px; display:flex; flex-direction:column; gap:4px;")}>
      {/* Existing comments — gold/red cards with crown icon */}
      {sortedComments.map(c => {
        const meta = PRIORITY_META[c.priority] || PRIORITY_META.normal;
        return (
          <div key={c.id} style={css(
            "padding:7px 10px; border-radius:8px; background:"+meta.bg+"; border:1px solid "+meta.border+"; "+
            "border-left:3px solid "+meta.color+"; position:relative;"
          )}>
            <div style={css("display:flex; align-items:center; gap:5px; margin-bottom:3px;")}>
              <Crown size={10} style={{ color: meta.color, flex: 'none' }} />
              <span style={css("font-size:8px; font-weight:800; letter-spacing:0.05em; text-transform:uppercase; color:"+meta.color+"; font-family:'Inter',sans-serif;")}>
                {meta.label}
              </span>
              <span style={css("font-size:9px; color:rgba(255,255,255,0.4); font-family:'Inter',sans-serif;")}>
                {c.author_name || c.author_email || 'Founder'}
              </span>
              {isAdmin && (
                <button onClick={() => handleDelete(c.id)} title="Delete comment"
                  style={css("margin-left:auto; cursor:pointer; background:none; border:none; color:rgba(255,255,255,0.25); padding:0; display:flex;")}>
                  <Trash2 size={10} />
                </button>
              )}
            </div>
            <p style={css("font-size:11.5px; line-height:1.45; color:rgba(255,255,255,0.88); margin:0; font-family:'Inter',sans-serif; white-space:pre-wrap;")}>
              {c.comment_text}
            </p>
          </div>
        );
      })}

      {/* Add comment button / input */}
      {open ? (
        <div style={css("padding:7px 10px; border-radius:8px; background:rgba(201,162,75,0.06); border:1px solid rgba(201,162,75,0.25);")}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add coaching comment — what should they do differently?"
            rows={2}
            autoFocus
            style={css("width:100%; padding:5px 8px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.9); font-size:11px; font-family:'Inter',sans-serif; resize:vertical; min-height:36px; outline:none;")}
          />
          <div style={css("display:flex; align-items:center; gap:5px; margin-top:5px;")}>
            {Object.entries(PRIORITY_META).map(([key, meta]) => (
              <button key={key} onClick={() => setPriority(key)}
                style={css(
                  "padding:2px 7px; border-radius:99px; font-size:8px; font-weight:700; text-transform:uppercase; cursor:pointer; font-family:'Inter',sans-serif; "+
                  (priority === key
                    ? "color:"+meta.color+"; background:"+meta.bg+"; border:1px solid "+meta.border+";"
                    : "color:rgba(255,255,255,0.3); background:transparent; border:1px solid rgba(255,255,255,0.08);")
                )}>
                {meta.label}
              </button>
            ))}
            <button onClick={handleSave} disabled={saving || !text.trim()}
              style={css("margin-left:auto; display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:7px; font-size:10px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%)); color:#1a1205; border:1px solid hsl(38 92% 50% / 0.5); opacity:"+(saving || !text.trim() ? 0.4 : 1)+";")}>
              {saving ? <Loader2 size={10} className="animate-spin" /> : null}
              Post
            </button>
            <button onClick={() => { setOpen(false); setText(''); }}
              style={css("cursor:pointer; background:none; border:none; color:rgba(255,255,255,0.4); padding:2px; display:flex;")}>
              <X size={12} />
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)}
          style={css("display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(201,162,75,0.06); color:rgba(201,162,75,0.6); border:1px solid rgba(201,162,75,0.15); align-self:flex-start;")}>
          <MessageSquarePlus size={11} />
          {sortedComments.length > 0 ? 'Add comment' : 'Comment'}
        </button>
      )}
    </div>
  );
}