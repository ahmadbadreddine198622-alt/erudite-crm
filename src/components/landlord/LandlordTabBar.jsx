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
import { Pause, Play, X, Loader2, Volume2 } from 'lucide-react';
import { useReadAloud } from '@/lib/ReadAloudContext';

const TABS = [
  { key: 'Activity',    label: 'Activity' },
  { key: 'Note',        label: 'Notes' },
  { key: 'Follow-up',   label: 'Follow Up' },
  { key: 'Email',       label: 'Emails' },
  { key: 'iMessage',    label: 'iMessage' },
  { key: 'Chat',        label: 'WhatsApp' },
  { key: 'Telegram',    label: 'Telegram' },
  { key: 'Calls',       label: 'Calls' },
  { key: 'SMS',         label: 'SMS' },
  { key: 'Appointment', label: 'Appointments' },
  { key: 'Documents',   label: 'Documents' },
];

function TTSControl() {
  const { isPlaying, isPaused, isLoading, pause, resume, stop, currentTrack } = useReadAloud();
  if (!isPlaying || !currentTrack) return null;
  const showPause = !isPaused && !isLoading;
  const showResume = isPaused && !isLoading;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 'none', marginLeft: 8 }}>
      <button
        type="button"
        onClick={() => (isPaused ? resume() : pause())}
        aria-label={isPaused ? 'Resume' : 'Pause'}
        title={isPaused ? 'Resume TTS' : 'Pause TTS'}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.18)',
          color: 'rgba(255,255,255,0.9)',
        }}
      >
        {isLoading ? <Loader2 size={14} className="animate-spin" /> : showPause ? <Pause size={14} style={{ fill: 'currentColor' }} strokeWidth={0} /> : showResume ? <Play size={14} style={{ fill: 'currentColor' }} strokeWidth={0} /> : <Volume2 size={14} />}
      </button>
      <button
        type="button"
        onClick={stop}
        aria-label="Stop"
        title="Stop TTS"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 26, borderRadius: 7, cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.6)',
        }}
      >
        <X size={13} />
      </button>
    </div>
  );
}

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
                borderBottom: active ? '2px solid rgba(255,255,255,0.9)' : '2px solid transparent',
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
      {/* TTS pause/play control — visible on every tab while audio is playing */}
      <TTSControl />
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
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.16)',
            color: 'rgba(255,255,255,0.85)',
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