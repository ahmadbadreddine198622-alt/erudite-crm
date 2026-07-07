// AllActivityTab — unified chronological timeline of EVERY landlord activity across
// ALL channels and ALL CRM users. Combines WhatsApp, iMessage, Telegram, SMS, Email,
// Calls (Aircall/Twilio/VAPI), Appointments/Follow-ups, Notes, Tasks, Documents, and
// pipeline stage changes — each row shows the channel icon, direction/title, sender
// username, and full date+time.
//
// Activity is never deleted — this is a read-only audit timeline.
//
// Props:
//   items (array) — raw stream items from LandlordDetailPage (already merged + sorted newest-first)
//                  each item: { t, dir, channel, text/subject/emailBody, senderName, time,
//                               kind, actTitle, actBody, _author, order }

import React, { useState, useMemo } from 'react';
import { ChevronDown, Sparkles, Loader2, CornerUpLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

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

// Channel visual metadata: icon, color, background, label.
const CHANNEL_META = {
  whatsapp_personal: { icon: '💬', color: '#93c5fd', bg: 'rgba(59,130,246,0.14)', label: 'WhatsApp' },
  whatsapp_business: { icon: '💬', color: '#4ade80', bg: 'rgba(37,211,102,0.14)', label: 'WA Business' },
  imessage:          { icon: '', color: '#60a5fa', bg: 'rgba(10,132,255,0.14)', label: 'iMessage' },
  telegram:          { icon: '✈', color: '#29b6f6', bg: 'rgba(41,182,246,0.14)', label: 'Telegram' },
  sms:               { icon: '✉', color: '#c4b5fd', bg: 'rgba(139,92,246,0.14)', label: 'SMS' },
  email:             { icon: '✉', color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.12)', label: 'Email' },
};

// Activity-kind visual metadata: icon, color, background, label.
const KIND_META = {
  call:        { icon: '📞', color: '#93c5fd', bg: 'rgba(59,130,246,0.14)', label: 'Call' },
  note:        { icon: '📝', color: 'rgba(255,255,255,0.7)', bg: 'rgba(148,163,184,0.14)', label: 'Note' },
  task:        { icon: '✓', color: '#34d399', bg: 'rgba(16,185,129,0.14)', label: 'Task' },
  followup:    { icon: '↻', color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.14)', label: 'Follow-up' },
  appointment: { icon: '📅', color: '#c4b5fd', bg: 'rgba(139,92,246,0.14)', label: 'Appointment' },
  stage:       { icon: '⇪', color: '#34d399', bg: 'rgba(16,185,129,0.14)', label: 'Stage' },
};

// Format a timestamp string into a full date+time label (Asia/Dubai locale).
function fmtFullTime(ts) {
  if (!ts) return '';
  // "Just now" / relative labels are passed through as-is.
  if (/just now|ago|^\d/i.test(String(ts))) return String(ts);
  const d = new Date(ts);
  if (isNaN(d)) return String(ts);
  return d.toLocaleString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export default function AllActivityTab({ items, landlordId, landlordName, onReplyGenerated }) {
  const [expandedKeys, setExpandedKeys] = useState(null); // null = all-with-body expanded by default
  const [channelFilter, setChannelFilter] = useState('all');
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [replyGenerating, setReplyGenerating] = useState(false);

  // Build a unified normalized activity list from the raw stream items.
  const activities = useMemo(() => {
    if (!items || !items.length) return [];
    const out = [];
    for (const s of items) {
      if (s.t === 'msg') {
        // Determine channel key for visual styling.
        let chKey = s.channel || '';
        if (chKey === 'WA Personal') chKey = 'whatsapp_personal';
        else if (chKey === 'WA Business') chKey = 'whatsapp_business';
        else if (chKey === 'iMessage') chKey = 'imessage';
        else if (chKey === 'Telegram') chKey = 'telegram';
        else if (chKey === 'Email') chKey = 'email';
        const meta = CHANNEL_META[chKey] || { icon: '💬', color: 'rgba(255,255,255,0.7)', bg: 'rgba(255,255,255,0.06)', label: chKey || 'Message' };
        const isOut = s.dir === 'out';
        out.push({
          key: 'msg-' + s.key,
          type: 'message',
          icon: meta.icon,
          iconColor: meta.color,
          iconBg: meta.bg,
          channelLabel: meta.label,
          direction: isOut ? 'Outbound' : 'Inbound',
          title: s.subject ? `📧 ${s.subject}` : (isOut ? 'Sent message' : 'Received message'),
          body: s.emailBody || s.text || '',
          sender: s.senderName || (isOut ? 'Agent' : 'Owner'),
          time: fmtFullTime(s.time),
          rawTime: s.time,
          order: s.order || 0,
          channelKey: chKey,
        });
      } else if (s.t === 'act') {
        const meta = KIND_META[s.kind] || KIND_META.note;
        out.push({
          key: 'act-' + s.key,
          type: 'activity',
          icon: meta.icon,
          iconColor: meta.color,
          iconBg: meta.bg,
          channelLabel: meta.label,
          direction: '',
          title: s.actTitle || meta.label,
          body: s.actBody || '',
          sender: s._author || (s.author || ''),
          time: fmtFullTime(s.time),
          rawTime: s.time,
          order: s.order || 0,
          channelKey: s.kind,
        });
      }
    }
    // Sort newest-first by order (already sorted upstream, but enforce here).
    out.sort((a, b) => (b.order || 0) - (a.order || 0));
    return out;
  }, [items]);

  // Unique channel keys for the filter pills.
  const channelKeys = useMemo(() => {
    const seen = new Set();
    for (const a of activities) if (a.channelKey) seen.add(a.channelKey);
    return [...seen];
  }, [activities]);

  const filtered = channelFilter === 'all'
    ? activities
    : activities.filter(a => a.channelKey === channelFilter);

  // Expand state: null means "all items with a body are open by default".
  // Once the user toggles any item, we switch to an explicit Set so they can
  // collapse/expand individual rows. Clicking never re-collapses everything.
  const isItemOpen = (key, hasBody) => {
    if (!hasBody) return false;
    if (expandedKeys === null) return true;
    return expandedKeys.has(key);
  };
  const toggleItem = (key, hasBody) => {
    if (!hasBody) return;
    setExpandedKeys((prev) => {
      const set = prev === null
        ? new Set(filtered.filter(a => a.body && String(a.body).trim()).map(a => a.key))
        : new Set(prev);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return set;
    });
  };

  // Generate an AI summary of the most recent activity.
  const handleSummarize = async () => {
    if (summarizing) return;
    const last = filtered[0];
    if (!last) return;
    setSummarizing(true);
    setSummary(null);
    try {
      const context = `Activity: ${last.title}\nChannel: ${last.channelLabel}\nSender: ${last.sender}\nContent: ${last.body || '(no text)'}`;
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Summarize this CRM activity in 2-3 concise sentences. Focus on key information and any action items.\n\n${context}`,
        response_json_schema: { type: 'object', properties: { summary: { type: 'string' } } },
      });
      const data = res?.data ?? res;
      const text = data?.summary || (typeof data === 'string' ? data : '');
      if (!text) throw new Error('No summary returned');
      setSummary(text);
    } catch (e) {
      toast.error(e?.message || 'Failed to summarize');
    } finally {
      setSummarizing(false);
    }
  };

  // Generate a WhatsApp reply based on the summary, load it into the composer.
  const handleReply = async () => {
    if (replyGenerating || !summary) return;
    setReplyGenerating(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Based on this activity summary, draft a professional, concise WhatsApp reply to ${landlordName || 'the landlord'}. Keep it warm, actionable, and natural. Output ONLY the reply text — no quotes, no commentary.\n\nSummary:\n${summary}`,
        response_json_schema: { type: 'object', properties: { reply: { type: 'string' } } },
      });
      const data = res?.data ?? res;
      const text = data?.reply || (typeof data === 'string' ? data : '');
      if (!text) throw new Error('No reply returned');
      if (onReplyGenerated) onReplyGenerated(text);
      toast.success('Reply drafted in WhatsApp composer below');
    } catch (e) {
      toast.error(e?.message || 'Failed to generate reply');
    } finally {
      setReplyGenerating(false);
    }
  };

  if (!filtered.length) {
    return (
      <div style={css("display:flex; align-items:center; justify-content:center; flex:1; color:rgba(255,255,255,0.35); font-size:13px; padding:40px 0;")}>
        No activity yet — all channels and users will appear here in real time.
      </div>
    );
  }

  return (
    <div style={css("display:flex; flex-direction:column; gap:6px; padding:2px 0 8px;")}>
      {/* Channel filter pills */}
      {channelKeys.length > 1 && (
        <div style={css("display:flex; align-items:center; gap:5px; flex-wrap:wrap; margin-bottom:6px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.06);")}>
          <button type="button" onClick={() => setChannelFilter('all')}
            style={{ ...css("padding:3px 10px; border-radius:99px; font-size:10px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; white-space:nowrap;"),
              background: channelFilter === 'all' ? 'hsl(38 92% 50% / 0.2)' : 'rgba(255,255,255,0.05)',
              color: channelFilter === 'all' ? 'hsl(38 92% 62%)' : 'rgba(255,255,255,0.5)',
              border: '1px solid ' + (channelFilter === 'all' ? 'hsl(38 92% 50% / 0.5)' : 'rgba(255,255,255,0.12)') }}>
            All ({activities.length})
          </button>
          {channelKeys.map((ck) => {
            const meta = CHANNEL_META[ck] || KIND_META[ck] || { label: ck, color: 'rgba(255,255,255,0.6)', bg: 'rgba(255,255,255,0.06)' };
            const count = activities.filter(a => a.channelKey === ck).length;
            const on = channelFilter === ck;
            return (
              <button key={ck} type="button" onClick={() => setChannelFilter(on ? 'all' : ck)} title={`Filter to ${meta.label}`}
                style={{ ...css("padding:3px 10px; border-radius:99px; font-size:10px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; white-space:nowrap;"),
                  background: on ? meta.bg : 'rgba(255,255,255,0.05)',
                  color: on ? meta.color : 'rgba(255,255,255,0.5)',
                  border: '1px solid ' + (on ? meta.color + '50' : 'rgba(255,255,255,0.12)') }}>
                {meta.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Activity rows — collapsible, newest-first */}
      {filtered.map((item, idx) => {
        const hasBody = item.body && String(item.body).trim();
        const isOpen = isItemOpen(item.key, hasBody);
        const isLast = idx === 0;
        return (
          <React.Fragment key={item.key}>
            <div style={css("border-radius:10px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03); overflow:hidden; transition:border-color 0.12s ease;")}>
              <button
                onClick={() => toggleItem(item.key, hasBody)}
                style={css("width:100%; display:flex; align-items:flex-start; gap:10px; padding:10px 12px; background:none; border:none; cursor:" + (hasBody ? 'pointer' : 'default') + "; text-align:left; font-family:'Inter',sans-serif;")}
              >
                {/* Channel/kind icon */}
                <span style={{
                  flex: 'none', width: '30px', height: '30px', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', background: item.iconBg, color: item.iconColor, marginTop: '1px',
                }}>
                  {item.icon}
                </span>
                {/* Title + sender + channel */}
                <span style={css("flex:1; min-width:0; display:flex; flex-direction:column; gap:3px;")}>
                  <span style={css("font-size:12.5px; font-weight:600; color:rgba(255,255,255,0.92); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;")}>
                    {item.title}
                  </span>
                  <span style={css("display:flex; align-items:center; gap:6px; flex-wrap:wrap;")}>
                    {/* Channel badge */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: 99, fontSize: 9, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', background: item.iconBg, color: item.iconColor, whiteSpace: 'nowrap' }}>
                      {item.channelLabel}
                    </span>
                    {/* Direction for messages */}
                    {item.direction && (
                      <span style={{ fontSize: 9.5, fontWeight: 600, color: item.direction === 'Outbound' ? 'hsl(38 92% 62%)' : 'rgba(96,165,250,0.8)', whiteSpace: 'nowrap' }}>
                        {item.direction === 'Outbound' ? '↗ Out' : '↙ In'}
                      </span>
                    )}
                    {/* Sender username */}
                    {item.sender && (
                      <span style={css("font-size:10.5px; color:rgba(255,255,255,0.5); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;")}>
                        by {item.sender}
                      </span>
                    )}
                  </span>
                </span>
                {/* Full date+time */}
                <span style={css("flex:none; font-size:10px; color:rgba(255,255,255,0.42); white-space:nowrap; text-align:right; max-width:180px; line-height:1.3; margin-top:2px;")}>
                  {item.time}
                </span>
                {/* Chevron */}
                {hasBody && (
                  <ChevronDown size={14} style={{ flex: 'none', color: 'rgba(255,255,255,0.4)', marginTop: '8px', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                )}
              </button>
              {/* Expanded body */}
              {isOpen && hasBody && (
                <div style={css("padding:0 12px 11px 52px; font-size:12px; line-height:1.55; color:rgba(255,255,255,0.72); white-space:pre-wrap; max-height:280px; overflow:auto;")}>
                  {item.body}
                </div>
              )}
              {/* Summarize button — only on the most recent activity */}
              {isLast && (
                <div style={css("padding:0 12px 10px 52px; display:flex; align-items:center; gap:7px;")}>
                  <button type="button" onClick={handleSummarize} disabled={summarizing}
                    style={css("display:inline-flex; align-items:center; gap:5px; padding:5px 11px; border-radius:8px; font-size:11px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(139,92,246,0.14); color:#c4b5fd; border:1px solid rgba(139,92,246,0.32); opacity:"+(summarizing?0.6:1)+";")}>
                    {summarizing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {summarizing ? 'Summarizing…' : 'Summarize'}
                  </button>
                </div>
              )}
            </div>
            {/* Summary box with Reply button — appears below the most recent activity */}
            {isLast && summary && (
              <div style={css("border-radius:10px; border:1px solid rgba(139,92,246,0.28); background:rgba(139,92,246,0.06); padding:10px 13px; margin-bottom:4px;")}>
                <div style={css("display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px;")}>
                  <span style={css("font-size:9px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:#c4b5fd;")}>AI Summary</span>
                  <button type="button" onClick={() => setSummary(null)} style={css("background:none; border:none; cursor:pointer; color:rgba(255,255,255,0.4); font-size:14px; padding:0;")} title="Dismiss">✕</button>
                </div>
                <div style={css("font-size:12px; line-height:1.5; color:rgba(255,255,255,0.82); margin-bottom:8px; white-space:pre-wrap;")}>{summary}</div>
                <button type="button" onClick={handleReply} disabled={replyGenerating}
                  style={css("display:inline-flex; align-items:center; gap:5px; padding:6px 14px; border-radius:8px; font-size:11.5px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(37,211,102,0.18); color:#4ade80; border:1px solid rgba(37,211,102,0.4); opacity:"+(replyGenerating?0.6:1)+";")}>
                  {replyGenerating ? <Loader2 size={13} className="animate-spin" /> : <CornerUpLeft size={13} />}
                  {replyGenerating ? 'Generating reply…' : 'Reply on WhatsApp'}
                </button>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}