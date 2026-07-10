// FollowupComposerFields — the Follow-up composer's AI suggested-chips + scheduling fields.
// Extracted from LandlordDetailPage to keep that file within the line limit.
// Pure presentational: chips + current field values + handlers come from the parent.
//
// Now includes: expanded channel options + agent assignment dropdown (HubSpot style).

import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';

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

const fieldStyle = css("padding:5px 8px; border-radius:8px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.9); font-size:11.5px; font-family:'Inter',sans-serif;");

const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'imessage', label: 'iMessage' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'sms', label: 'SMS' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'viewing', label: 'Viewing' },
];

export default function FollowupComposerFields({
  chips, followupAiSource, collapsed, onToggleCollapsed, onPickChip,
  channel, date, hour, minute, ampm, onChannel, onDate, onHour, onMinute, onAmPm, onClearDraft,
  assignee, onAssignee, creatorName,
}) {
  const HOURS = [1,2,3,4,5,6,7,8,9,10,11,12];
  const MINUTES = ['00','05','10','15','20','25','30','35','40','45','50','55'];
  const [agents, setAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setAgentsLoading(true);
    base44.functions.invoke('getAssignableAgents', {})
      .then((res) => {
        const data = res?.data ?? res;
        const list = Array.isArray(data?.agents) ? data.agents : Array.isArray(data) ? data : [];
        if (mounted) setAgents(list);
      })
      .catch(() => { /* graceful — manual entry still works */ })
      .finally(() => { if (mounted) setAgentsLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <div style={css("margin-bottom:9px;")}>
      {chips.length > 0 && (
        <div style={css("margin-bottom:9px; border-radius:12px; border:1px solid rgba(139,92,246,0.22); background:rgba(139,92,246,0.04); overflow:hidden;")}>
          <button onClick={onToggleCollapsed} style={css("width:100%; display:flex; align-items:center; justify-content:space-between; padding:9px 13px; background:none; border:none; cursor:pointer; font-family:'Inter',sans-serif;")}>
            <span style={css("display:inline-flex; align-items:center; gap:7px; font-size:10.5px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:#c4b5fd;")}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>
              AI Suggested Follow-ups
              <span style={css("font-size:9.5px; font-weight:600; color:rgba(255,255,255,0.4);")}>{chips.length}</span>
            </span>
            <span style={css("display:inline-flex; align-items:center; color:rgba(255,255,255,0.4);")}><ChevronDown size={14} style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s ease' }} /></span>
          </button>
          {!collapsed && (
            <div style={css("display:flex; flex-direction:column; gap:5px; padding:0 11px 10px; max-height:200px; overflow-y:auto;")}>
              {chips.map((chip, i) => {
                const isActive = followupAiSource === chip.template_key;
                const label = (typeof chip.template.label === 'string' && chip.template.label.trim()) ? chip.template.label : chip.template_key;
                const meta = `${chip.channel} · +${chip.when_offset_days}d · ${String(chip.suggested_hour).padStart(2, '0')}:00`;
                return (
                  <button key={chip.template_key + '-' + i} onClick={() => onPickChip(chip)} title={chip.reason || label}
                    style={css(
                      "display:flex; flex-direction:column; align-items:flex-start; gap:2px; text-align:left; width:100%; padding:7px 11px; border-radius:9px; cursor:pointer; font-family:'Inter',sans-serif; " +
                      "background:" + (isActive ? "rgba(139,92,246,0.2)" : "rgba(139,92,246,0.06)") + "; " +
                      "border:1px solid " + (isActive ? "rgba(139,92,246,0.55)" : "rgba(139,92,246,0.22)") + ";"
                    )}>
                    <span style={css("display:flex; align-items:center; gap:7px; width:100%;")}>
                      <span style={css("flex:none; font-size:9px; font-weight:800; color:#a78bfa;")}>{i + 1}</span>
                      <span style={css("font-size:12px; font-weight:600; color:" + (isActive ? "#ddd6fe" : "rgba(255,255,255,0.88)") + ";")}>{label}</span>
                      <span style={css("flex:none; margin-left:auto; font-size:9.5px; font-weight:600; color:rgba(255,255,255,0.45);")}>{meta}</span>
                    </span>
                    {chip.reason && (
                      <span style={css("font-size:10.5px; line-height:1.4; color:rgba(255,255,255,0.5); padding-left:16px;")}>{chip.reason}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      <div style={css("display:flex; align-items:center; gap:6px; flex-wrap:wrap;")}>
        <label style={css("display:inline-flex; align-items:center; gap:4px; font-size:9.5px; font-weight:600; color:rgba(255,255,255,0.5);")}>
          Creator
          <span style={css("padding:5px 8px; border-radius:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.12); display:inline-flex; align-items:center; gap:5px; min-width:110px; font-size:11.5px; font-family:Inter,sans-serif;")}>
            <span style={css("width:6px; height:6px; border-radius:50%; background:#34d399; flex:none;")} />
            <span style={css("white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:rgba(255,255,255,0.8);")}>{creatorName || 'You'}</span>
          </span>
        </label>
        <label style={css("display:inline-flex; align-items:center; gap:4px; font-size:9.5px; font-weight:600; color:rgba(255,255,255,0.5);")}>
          Channel
          <select value={channel} onChange={(e) => onChannel(e.target.value)} style={fieldStyle}>
            {CHANNELS.map((ch) => (
              <option key={ch.value} value={ch.value}>{ch.label}</option>
            ))}
          </select>
        </label>
        <label style={css("display:inline-flex; align-items:center; gap:4px; font-size:9.5px; font-weight:600; color:rgba(255,255,255,0.5);")}>
          Date
          <input type="date" value={date} onChange={(e) => onDate(e.target.value)} style={fieldStyle} />
        </label>
        <label style={css("display:inline-flex; align-items:center; gap:4px; font-size:9.5px; font-weight:600; color:rgba(255,255,255,0.5);")}>
          Hour
          <select value={hour} onChange={(e) => onHour(e.target.value)} style={fieldStyle}>
            {HOURS.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </label>
        <label style={css("display:inline-flex; align-items:center; gap:4px; font-size:9.5px; font-weight:600; color:rgba(255,255,255,0.5);")}>
          Min
          <select value={minute || '00'} onChange={(e) => onMinute(e.target.value)} style={fieldStyle}>
            {MINUTES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label style={css("display:inline-flex; align-items:center; gap:4px; font-size:9.5px; font-weight:600; color:rgba(255,255,255,0.5);")}>
          <select value={ampm || 'AM'} onChange={(e) => onAmPm(e.target.value)} style={fieldStyle}>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </label>
        <label style={css("display:inline-flex; align-items:center; gap:4px; flex:1; min-width:160px; font-size:9.5px; font-weight:600; color:rgba(255,255,255,0.5);")}>
          Assign to
          <select value={assignee} onChange={(e) => onAssignee(e.target.value)} style={{ ...fieldStyle, flex:1, minWidth:0 }}>
            <option value="">Select agent…</option>
            {agents.map((a) => (
              <option key={a.email || a.id} value={a.email || ''}>{a.full_name || a.email}</option>
            ))}
          </select>
          {agentsLoading && <span style={css("font-size:8.5px; color:rgba(255,255,255,0.3);")}>…</span>}
        </label>
        {followupAiSource && (
          <button onClick={onClearDraft} title="Clear AI draft — write from scratch" style={css("display:inline-flex; align-items:center; gap:3px; padding:4px 7px; border-radius:7px; font-size:9.5px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.55);")}>✕ Clear</button>
        )}
        {followupAiSource && (
          <span style={css("font-size:9px; color:rgba(255,255,255,0.4);")}>AI draft</span>
        )}
        {!followupAiSource && chips.length === 0 && (
          <span style={css("font-size:9px; color:rgba(255,255,255,0.4);")}>Run Analyse</span>
        )}
      </div>
    </div>
  );
}