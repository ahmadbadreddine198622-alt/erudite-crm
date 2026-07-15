import React, { useState } from 'react';
import { Zap, RefreshCw, CornerDownLeft, ChevronDown, ChevronUp } from 'lucide-react';

// ApproachDraftStrip — the per-channel draft slot of the Approach Forge.
//
// Rendered inside every telecommunication composer's draft section (WhatsApp, Telegram,
// SMS, Email, iMessage). Shows the auto-forged approach draft for THAT channel with:
//   [Load ↵] — one tap loads it into the composer (agent reviews, edits, sends — never auto-sent)
//   [↻]      — force-regenerates a fresh, different draft for all channels
// While the forge is running it shows a shimmer so the agent knows a fresh approach is coming.
//
// Props:
//   channel      — 'whatsapp' | 'telegram' | 'sms' | 'email' | 'imessage' (which slot to show)
//   drafts       — landlord.ai_approach_drafts (whole object) | null
//   forging      — boolean, forge in flight
//   onLoad(d)    — load this channel's draft into the composer ({ subject?, body_native, body_english_gloss })
//   onRegenerate — force a fresh forge
//   accent       — channel accent color (defaults to Erudite gold)

const GOLD = '#d4af37';
const CHANNEL_LABEL = { whatsapp: 'WhatsApp', telegram: 'Telegram', sms: 'SMS', email: 'Email', imessage: 'iMessage' };

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

function relativeTime(iso) {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return '';
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ApproachDraftStrip({ channel, drafts, forging, onLoad, onRegenerate, accent }) {
  const [expanded, setExpanded] = useState(false);
  const ac = accent || GOLD;
  const d = drafts && typeof drafts === 'object' ? drafts[channel] : null;
  const hasDraft = !!(d && d.body_native && String(d.body_native).trim());
  const isFollowup = drafts && drafts.mode === 'followup';
  const SITUATION_CHIP = { owner_replied_last: 'reply due', awaiting_first_reply: 'no reply yet', active_thread_pending: 're-engage', after_call: 'after call' };
  const situationChip = isFollowup ? (SITUATION_CHIP[drafts.situation] || null) : null;

  if (!hasDraft && !forging) return null;

  const body = hasDraft ? String(d.body_native).trim() : '';
  const gloss = hasDraft && d.body_english_gloss && d.body_english_gloss.trim() && d.body_english_gloss.trim() !== body
    ? String(d.body_english_gloss).trim() : '';
  const preview = (channel === 'email' && d?.subject ? d.subject + ' — ' : '') + body;

  return (
    <div style={{
      ...css('margin-bottom:8px; border-radius:11px; padding:8px 10px; position:relative; overflow:hidden;'),
      background: 'linear-gradient(135deg, rgba(212,175,55,0.10), rgba(212,175,55,0.035))',
      border: '1px solid rgba(212,175,55,0.38)',
      boxShadow: '0 0 18px rgba(212,175,55,0.07), inset 0 1px 0 rgba(255,255,255,0.05)',
    }}>
      {/* Header row */}
      <div style={css('display:flex; align-items:center; gap:6px;')}>
        <Zap size={12} style={{ color: GOLD, flex: 'none' }} />
        <span style={css('font-size:9px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:' + GOLD + "; font-family:'Inter',sans-serif;")}>
          {isFollowup ? 'Follow-Up Draft' : 'Approach Draft'} · {CHANNEL_LABEL[channel] || channel}
        </span>
        {forging ? (
          <span style={css('font-size:9px; color:rgba(212,175,55,0.85); display:inline-flex; align-items:center; gap:5px;')}>
            <RefreshCw size={10} className="animate-spin" /> forging a fresh approach…
          </span>
        ) : (
          <>
            {situationChip && (
              <span style={css('flex:none; padding:1px 6px; border-radius:99px; font-size:8px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; background:rgba(96,165,250,0.14); color:#93c5fd;')}>
                {situationChip}
              </span>
            )}
            {drafts?.angle_used && (
              <span style={css('flex:none; padding:1px 6px; border-radius:99px; font-size:8px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; background:rgba(212,175,55,0.14); color:rgba(212,175,55,0.9);')}>
                {String(drafts.angle_used).replace(/_/g, ' ')}
              </span>
            )}
            {drafts?.forged_for?.name && (
              <span title={`Written in ${drafts.forged_for.name}'s voice${drafts.forged_for.position ? ` (${drafts.forged_for.position})` : ''}`}
                style={css('flex:none; padding:1px 6px; border-radius:99px; font-size:8px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.55);')}>
                {String(drafts.forged_for.name).split(' ')[0]}'s voice
              </span>
            )}
            <span style={css('font-size:8.5px; color:rgba(255,255,255,0.35);')}>{relativeTime(drafts?.forged_at)}</span>
          </>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          {hasDraft && (
            <button type="button" onClick={() => onLoad && onLoad(d)} title="Load this draft into the composer — review, edit, then send"
              style={css('display:inline-flex; align-items:center; gap:4px; padding:4px 9px; border-radius:8px; font-size:9.5px; font-weight:800; letter-spacing:0.03em; cursor:pointer; border:1px solid rgba(212,175,55,0.55); background:rgba(212,175,55,0.16); color:#f4d97a; font-family:Inter,sans-serif;')}>
              <CornerDownLeft size={11} /> LOAD
            </button>
          )}
          <button type="button" onClick={() => onRegenerate && onRegenerate()} disabled={!!forging} title="Forge a fresh, different approach (all channels)"
            style={{ ...css('display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:8px; cursor:pointer; border:1px solid rgba(212,175,55,0.35); background:rgba(212,175,55,0.07); color:rgba(212,175,55,0.85);'), opacity: forging ? 0.5 : 1 }}>
            <RefreshCw size={11} className={forging ? 'animate-spin' : undefined} />
          </button>
        </span>
      </div>

      {/* Draft preview */}
      {hasDraft && (
        <div onClick={() => setExpanded((v) => !v)} style={css('margin-top:6px; cursor:pointer;')} title={expanded ? 'Collapse' : 'Expand full draft'}>
          <div style={{
            ...css("font-size:11.5px; line-height:1.5; color:rgba(255,255,255,0.85); font-family:'Inter',sans-serif; white-space:pre-wrap;"),
            ...(expanded ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }),
          }}>
            {preview}
          </div>
          {gloss && expanded && (
            <div style={css('margin-top:5px; padding-top:5px; border-top:1px dashed rgba(212,175,55,0.25); font-size:10.5px; line-height:1.5; color:rgba(255,255,255,0.5); font-style:italic;')}>
              EN: {gloss}
            </div>
          )}
          <span style={css('display:inline-flex; align-items:center; gap:3px; margin-top:3px; font-size:8.5px; color:rgba(212,175,55,0.6);')}>
            {expanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />} {expanded ? 'collapse' : 'expand'}
          </span>
        </div>
      )}
    </div>
  );
}
