// FounderMemoriesPanel — a "memories" section shown at the top of the All Activity tab.
// Displays ALL founder directives (active + resolved) and ALL coaching comments (across
// every activity) as a single chronological memory log. This gives the agent a quick
// reference of everything the founder has said about this landlord — so the founder's
// guidance is never lost.
//
// Props:
//   directives — array of LandlordDirective records
//   comments   — array of ActivityComment records
//   canCoach   — bool, whether the user can add comments

import React, { useState } from 'react';
import { Crown, ChevronDown, Brain } from 'lucide-react';
import SpeechifyPlayer from '@/components/academy/SpeechifyPlayer';

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

function fmtDate(d) {
  if (!d) return '?';
  const x = new Date(d);
  if (isNaN(x)) return String(d);
  return x.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}

const DIR_PRIO = {
  critical: { label: 'CRITICAL', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)' },
  high: { label: 'HIGH', color: '#C9A24B', bg: 'rgba(201,162,75,0.08)', border: 'rgba(201,162,75,0.3)' },
  normal: { label: 'NORMAL', color: '#93c5fd', bg: 'rgba(147,197,253,0.08)', border: 'rgba(147,197,253,0.25)' },
};

const CMT_PRIO = {
  urgent:    { label: 'URGENT',    color: '#ff3b5c', bg: 'linear-gradient(135deg, rgba(255,59,92,0.14), rgba(255,59,92,0.03))', border: 'rgba(255,59,92,0.5)', glow: '0 0 12px rgba(255,59,92,0.3)' },
  important: { label: 'IMPORTANT', color: '#a855f7', bg: 'linear-gradient(135deg, rgba(168,85,247,0.14), rgba(168,85,247,0.03))', border: 'rgba(168,85,247,0.5)', glow: '0 0 12px rgba(168,85,247,0.3)' },
  normal:    { label: 'NOTE',      color: '#22d3ee', bg: 'linear-gradient(135deg, rgba(34,211,238,0.12), rgba(34,211,238,0.02))', border: 'rgba(34,211,238,0.4)', glow: '0 0 10px rgba(34,211,238,0.2)' },
};

export default function FounderMemoriesPanel({ directives = [], comments = [], canCoach }) {
  const [open, setOpen] = useState(true);

  // Build a unified memory log: each entry has { type, text, priority, author, date, status }
  const memories = [];

  for (const d of directives) {
    memories.push({
      type: 'directive',
      text: d.directive_text || '',
      priority: d.priority || 'normal',
      author: d.created_by_name || d.created_by_email || 'Founder',
      date: d.created_date,
      status: d.status,
      agentResponse: d.agent_response || '',
      acknowledgedBy: d.acknowledged_by_name || '',
    });
  }

  for (const c of comments) {
    memories.push({
      type: 'comment',
      text: c.comment_text || '',
      priority: c.priority || 'normal',
      author: c.author_name || c.author_email || 'Founder',
      date: c.created_date,
      status: null,
      onActivity: `${c.activity_type || 'activity'}`,
    });
  }

  memories.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

  if (!memories.length) return null;

  return (
    <div style={css("border-radius:12px; border:1px solid rgba(201,162,75,0.2); background:linear-gradient(135deg, rgba(201,162,75,0.04), rgba(255,255,255,0.01)); margin-bottom:8px; overflow:hidden;")}>
      {/* Header */}
      <button onClick={() => setOpen(!open)}
        style={css("width:100%; display:flex; align-items:center; gap:8px; padding:9px 13px; background:none; border:none; cursor:pointer; text-align:left; font-family:'Inter',sans-serif;")}>
        <Brain size={14} style={{ color: '#C9A24B', flex: 'none' }} />
        <span style={css("font-size:10px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:#C9A24B;")}>Founder Memories</span>
        <span style={css("font-size:9px; color:rgba(255,255,255,0.35);")}>{memories.length} {memories.length === 1 ? 'entry' : 'entries'}</span>
        <ChevronDown size={13} style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div style={css("padding:2px 10px 10px; display:flex; flex-direction:column; gap:5px; max-height:280px; overflow-y:auto;")}>
          {memories.map((m, i) => {
            const isDir = m.type === 'directive';
            const meta = isDir ? (DIR_PRIO[m.priority] || DIR_PRIO.normal) : (CMT_PRIO[m.priority] || CMT_PRIO.normal);
            return (
              <div key={i} style={css(
                "padding:8px 11px; border-radius:9px; background:"+meta.bg+"; border:1px solid "+meta.border+"; "+
                "border-left:4px solid "+meta.color+"; box-shadow:"+meta.glow+";"
              )}>
                <div style={css("display:flex; align-items:center; gap:5px; margin-bottom:4px; flex-wrap:wrap;")}>
                  {isDir ? <Crown size={11} style={{ color: meta.color, flex: 'none', filter: 'drop-shadow(0 0 3px '+meta.color+')' }} /> : null}
                  <span style={css("font-size:8.5px; font-weight:800; letter-spacing:0.05em; text-transform:uppercase; color:"+meta.color+";")}>
                    {isDir ? 'Directive' : 'Coaching'}
                  </span>
                  <span style={css("font-size:8px; font-weight:700; padding:1px 6px; border-radius:99px; color:"+meta.color+"; background:"+meta.bg+"; border:1px solid "+meta.border+";")}>{meta.label}</span>
                  {isDir && m.status && (
                    <span style={css("font-size:8px; color:rgba(255,255,255,0.3); text-transform:capitalize;")}>{m.status}</span>
                  )}
                  {!isDir && m.onActivity && (
                    <span style={css("font-size:8px; color:rgba(255,255,255,0.3);")}>on {m.onActivity}</span>
                  )}
                  <span style={css("font-size:8.5px; color:rgba(255,255,255,0.3); margin-left:auto;")}>{fmtDate(m.date)}</span>
                </div>
                <div style={css("display:flex; align-items:flex-start; gap:5px;")}>
                  <p style={css("flex:1; font-size:11.5px; line-height:1.5; color:rgba(255,255,255,0.9); margin:0; white-space:pre-wrap;")}>{m.text}</p>
                  <SpeechifyPlayer text={m.text} size={11} color={meta.color} style={{ flex: 'none', marginTop: 0 }} />
                </div>
                <div style={css("font-size:9px; color:rgba(255,255,255,0.35); margin-top:4px;")}>by {m.author}</div>
                {isDir && m.agentResponse && (
                  <p style={css("font-size:10px; color:rgba(255,255,255,0.5); margin:3px 0 0; font-style:italic;")}>↳ {m.acknowledgedBy}: “{m.agentResponse}”</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}