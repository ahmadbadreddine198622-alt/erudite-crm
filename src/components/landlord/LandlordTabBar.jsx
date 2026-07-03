// LandlordTabBar — two-row navigation bar for the landlord detail left panel.
// Primary row:   Appointment | WhatsApp | iMessage | Telegram | Email  (+ Analyse Now)
// Secondary row: Follow Up | Task (badge) | Note | Documents | Calls
//
// Matches the v9 mock-up: text-only tabs, active = white underline, dark slate bg.
//
// Props:
//   activeTab  (string)  — current composerType / active tab key
//   onSelect   (fn)      — called with the tab key when a tab is clicked
//   onAnalyse  (fn)      — called when "Analyse Now" is clicked
//   analyzing  (bool)    — disables Analyse button while true
//   taskCount  (number)  — optional badge count for the Task tab

import React from 'react';

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

const PRIMARY = [
  { key: 'Appointment', label: 'Appointment' },
  { key: 'Chat',        label: 'WhatsApp' },
  { key: 'iMessage',    label: 'iMessage' },
  { key: 'Telegram',    label: 'Telegram' },
  { key: 'Email',       label: 'Email' },
];

const SECONDARY = [
  { key: 'Follow-up',  label: 'Follow Up' },
  { key: 'Task',       label: 'Task', badge: true },
  { key: 'Note',       label: 'Note' },
  { key: 'Documents',  label: 'Documents' },
  { key: 'Calls',      label: 'Calls' },
];

function TabButton({ label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '7px 12px 7px 0',
        marginRight: 18,
        background: 'none',
        border: 'none',
        borderBottom: active ? '2px solid #ffffff' : '2px solid transparent',
        color: active ? '#ffffff' : 'rgba(255,255,255,0.5)',
        fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        fontFamily: "'Inter',sans-serif",
        whiteSpace: 'nowrap',
        transition: 'color 0.12s ease, border-color 0.12s ease',
        lineHeight: 1.2,
      }}
    >
      {label}
      {badge != null && badge > 0 && (
        <span style={{
          fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
          background: active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
          color: active ? '#ffffff' : 'rgba(255,255,255,0.55)',
          marginLeft: 2,
        }}>{badge}</span>
      )}
    </button>
  );
}

export default function LandlordTabBar({ activeTab, onSelect, onAnalyse, analyzing, taskCount }) {
  return (
    <div style={css("flex:none; padding:0 16px; border-bottom:1px solid rgba(255,255,255,0.06); background:rgba(255,255,255,0.015);")}>
      {/* Primary row */}
      <div style={css("display:flex; align-items:center; justify-content:space-between; padding-top:2px;")}>
        <div style={css("display:flex; align-items:center; overflow-x:auto;")}>
          {PRIMARY.map((t) => (
            <TabButton key={t.key} label={t.label} active={activeTab === t.key} onClick={() => onSelect(t.key)} />
          ))}
        </div>
        {onAnalyse && (
          <button
            onClick={onAnalyse}
            disabled={analyzing}
            style={css(
              "flex:none; display:inline-flex; align-items:center; gap:5px; padding:5px 12px; border-radius:8px; " +
              "font-size:10.5px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; " +
              "background:hsl(38 92% 50% / 0.14); border:1px solid hsl(38 92% 50% / 0.4); color:hsl(38 92% 62%); " +
              "opacity:" + (analyzing ? 0.5 : 1) + ";"
            )}
          >
            <span style={{ display: 'inline-block', width: 11, height: 11, border: analyzing ? '2px solid rgba(245,214,141,0.3)' : 'none', borderTopColor: 'hsl(38 92% 62%)', borderRadius: '50%', ...(analyzing ? { animation: 'ltb-spin 0.7s linear infinite' } : {}) }}>↻</span>
            {analyzing ? 'Analysing…' : 'Analyse Now'}
            <style>{`@keyframes ltb-spin { to { transform: rotate(360deg); } }`}</style>
          </button>
        )}
      </div>
      {/* Secondary row */}
      <div style={css("display:flex; align-items:center; padding-bottom:2px; overflow-x:auto;")}>
        {SECONDARY.map((t) => (
          <TabButton
            key={t.key}
            label={t.label}
            active={activeTab === t.key}
            onClick={() => onSelect(t.key)}
            badge={t.badge ? taskCount : undefined}
          />
        ))}
      </div>
    </div>
  );
}