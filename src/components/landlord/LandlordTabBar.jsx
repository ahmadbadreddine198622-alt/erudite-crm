// LandlordTabBar — single-row navigation bar, HubSpot CRM style.
// Flat text tabs with an active underline. Horizontally scrollable.
//
// Tabs: Activity | Emails | Calls | Appointments | Tasks | Notes |
//       WhatsApp | iMessage | Telegram | SMS | Follow Up
//
// Props:
//   activeTab  (string) — current composerType / active tab key
//   onSelect   (fn)     — called with the tab key when a tab is clicked
//   onAnalyse  (fn)     — called when "Analyse" is clicked
//   analyzing  (bool)   — disables Analyse button while true

import React from 'react';

const TABS = [
  { key: 'Activity',    label: 'Activity' },
  { key: 'Email',       label: 'Emails' },
  { key: 'Calls',       label: 'Calls' },
  { key: 'Appointment', label: 'Appointments' },
  { key: 'Task',        label: 'Tasks' },
  { key: 'Note',        label: 'Notes' },
  { key: 'Chat',        label: 'WhatsApp' },
  { key: 'iMessage',    label: 'iMessage' },
  { key: 'Telegram',    label: 'Telegram' },
  { key: 'SMS',         label: 'SMS' },
  { key: 'Follow-up',   label: 'Follow Up' },
];

export default function LandlordTabBar({ activeTab, onSelect, onAnalyse, analyzing }) {
  return (
    <div style={{
      flex: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.015)',
    }}>
      {/* Tab row — horizontally scrollable */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        flex: 1,
        minHeight: 0,
      }}>
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onSelect(t.key)}
              style={{
                flex: 'none',
                padding: '10px 14px',
                background: 'none',
                border: 'none',
                borderBottom: active ? '2px solid #d4af37' : '2px solid transparent',
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
              {t.label}
            </button>
          );
        })}
      </div>
      {/* Analyse button — right-aligned */}
      {onAnalyse && (
        <button
          onClick={onAnalyse}
          disabled={analyzing}
          style={{
            flex: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 12px',
            borderRadius: 7,
            fontSize: 11,
            fontWeight: 600,
            cursor: analyzing ? 'not-allowed' : 'pointer',
            fontFamily: "'Inter',sans-serif",
            background: 'rgba(212,175,55,0.12)',
            border: '1px solid rgba(212,175,55,0.35)',
            color: '#d4af37',
            opacity: analyzing ? 0.5 : 1,
            marginLeft: 8,
          }}
        >
          {analyzing ? 'Analysing…' : '↻ Analyse'}
        </button>
      )}
    </div>
  );
}