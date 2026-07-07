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
  { key: 'iMessage',    label: 'iMessage' },
  { key: 'Chat',        label: 'WhatsApp' },
  { key: 'Telegram',    label: 'Telegram' },
  { key: 'Calls',       label: 'Calls' },
  { key: 'SMS',         label: 'SMS' },
  { key: 'Appointment', label: 'Appointments' },
  { key: 'Note',        label: 'Notes' },
  { key: 'Documents',   label: 'Documents' },
  { key: 'Follow-up',   label: 'Follow Up' },
];

export default function LandlordTabBar({ activeTab, onSelect, onAnalyse, analyzing }) {
  return (
    <div style={{
      flex: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      padding: '0 16px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.015)',
      minWidth: 0,
      overflow: 'hidden',
    }}>
      <style>{`
        .landlord-tab-scroll::-webkit-scrollbar { height: 7px; display: block; -webkit-appearance: none; }
        .landlord-tab-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 99px; margin: 0 2px; }
        .landlord-tab-scroll::-webkit-scrollbar-thumb { background: rgba(170,176,190,0.55); border-radius: 99px; border: 1px solid transparent; background-clip: padding-box; }
        .landlord-tab-scroll::-webkit-scrollbar-thumb:hover { background: rgba(200,206,220,0.75); background-clip: padding-box; }
        .landlord-tab-scroll { scrollbar-width: thin; scrollbar-color: rgba(170,176,190,0.55) rgba(255,255,255,0.05); overflow-x: scroll !important; }
      `}</style>
      {/* Tab row — horizontally scrollable */}
      <div className="landlord-tab-scroll" style={{
        display: 'flex',
        alignItems: 'center',
        overflowX: 'auto',
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        paddingBottom: 2,
        WebkitOverflowScrolling: 'touch',
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
                borderBottom: active ? '2px solid #EAB308' : '2px solid transparent',
                color: active ? '#FFFFFF' : '#858992',
                fontSize: 12.5,
                fontWeight: active ? 700 : 500,
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