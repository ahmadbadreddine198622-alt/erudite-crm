// Mockup only — 3-tab underline nav (Info / Activity / Pipeline) shown below the identity header.
// Activity tab shows a sample timeline of everything that can happen on a contact (calls, emails,
// messages, uploads/downloads, tasks, appointments). All data below is placeholder — the user will
// tell us when to wire this to real records.
import React, { useState } from 'react';
import { Phone, Mail, MessageCircle, Upload, Download, CheckSquare, Calendar, FileText, RefreshCw } from 'lucide-react';

const GOLD = '#C9A24B';
const TABS = ['Info', 'Activity', 'Pipeline'];

const ACTIVITY_META = {
  call: { icon: Phone, color: '#93c5fd', bg: 'rgba(59,130,246,0.14)' },
  email: { icon: Mail, color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.14)' },
  message: { icon: MessageCircle, color: '#4ade80', bg: 'rgba(37,211,102,0.14)' },
  upload: { icon: Upload, color: '#c4b5fd', bg: 'rgba(139,92,246,0.14)' },
  download: { icon: Download, color: '#34d399', bg: 'rgba(16,185,129,0.14)' },
  task: { icon: CheckSquare, color: '#34d399', bg: 'rgba(16,185,129,0.14)' },
  appointment: { icon: Calendar, color: '#c4b5fd', bg: 'rgba(139,92,246,0.14)' },
  document: { icon: FileText, color: 'rgba(255,255,255,0.7)', bg: 'rgba(255,255,255,0.06)' },
  followup: { icon: RefreshCw, color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.14)' },
};

// Placeholder sample rows only — not wired to any entity yet. `by` = agent who did it,
// `source` (follow-up only) = where the lead originally came from.
const MOCK_ACTIVITY = [
  { type: 'call', title: 'Outbound call · 4m 12s', subtitle: 'Twilio', by: 'Ahmad Al Farsi', time: 'Today 12:40 PM' },
  { type: 'followup', title: 'Follow-up scheduled', subtitle: 'Lead source: Property Finder', by: 'Ahmad Al Farsi', time: 'Today 11:45 AM' },
  { type: 'email', title: 'Email sent · Listing update', subtitle: 'To landlord@example.com', by: 'Sara Khoury', time: 'Today 11:15 AM' },
  { type: 'message', title: 'WhatsApp message sent', subtitle: '"Sharing the updated floor plan..."', by: 'Ahmad Al Farsi', time: 'Today 10:02 AM' },
  { type: 'upload', title: 'Document uploaded · Title Deed', subtitle: '', by: 'Ahmad Al Farsi', time: 'Yesterday 4:20 PM' },
  { type: 'download', title: 'Contact card downloaded', subtitle: 'CSV export', by: 'Sara Khoury', time: 'Yesterday 2:05 PM' },
  { type: 'task', title: 'Task created · Send Form A', subtitle: 'Due in 2 days', by: 'Ahmad Al Farsi', time: 'Yesterday 9:30 AM' },
  { type: 'appointment', title: 'Appointment booked · Viewing', subtitle: 'Mon 14 Jul · 3:00 PM', by: 'Ahmad Al Farsi', time: '2 days ago' },
  { type: 'followup', title: 'Lead created', subtitle: 'Lead source: Bayut inquiry', by: 'System', time: '5 days ago' },
];

function ActivityRow({ item }) {
  const meta = ACTIVITY_META[item.type] || ACTIVITY_META.document;
  const Icon = meta.icon;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '10px 2px' }}>
      <span style={{ flex: 'none', width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: meta.bg, color: meta.color }}>
        <Icon size={15} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontFamily: "'Inter',sans-serif" }}>{item.title}</div>
        {item.subtitle && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{item.subtitle}</div>}
        {item.by && (
          <span style={{ display: 'inline-flex', alignItems: 'center', marginTop: 4, padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, color: GOLD, background: 'rgba(201,162,75,0.12)', border: '1px solid rgba(201,162,75,0.25)' }}>
            by {item.by}
          </span>
        )}
      </div>
      <span style={{ flex: 'none', fontSize: 10.5, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>{item.time}</span>
    </div>
  );
}

export default function LandlordMockTabs() {
  const [active, setActive] = useState('Info');

  return (
    <div style={{ marginTop: 14 }}>
      {/* Underline tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {TABS.map((t) => {
          const on = active === t;
          return (
            <button
              key={t}
              onClick={() => setActive(t)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '10px 2px 12px',
                fontFamily: "'Inter',sans-serif",
                fontSize: 13.5,
                fontWeight: 700,
                color: on ? '#ffffff' : 'rgba(255,255,255,0.4)',
                borderBottom: on ? `2px solid ${GOLD}` : '2px solid transparent',
                transition: 'color 0.15s ease, border-color 0.15s ease',
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      {active === 'Activity' ? (
        <div
          style={{
            marginTop: 14,
            borderRadius: 14,
            border: '1px solid rgba(201,162,75,0.18)',
            background: 'rgba(255,255,255,0.03)',
            padding: '8px 14px',
          }}
        >
          {MOCK_ACTIVITY.map((item, i) => (
            <React.Fragment key={i}>
              <ActivityRow item={item} />
              {i < MOCK_ACTIVITY.length - 1 && <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div
          style={{
            marginTop: 14,
            borderRadius: 14,
            border: '1px solid rgba(201,162,75,0.18)',
            background: 'rgba(255,255,255,0.03)',
            padding: '24px 18px',
            minHeight: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 12.5, color: 'rgba(255,255,255,0.4)' }}>
            {active} content — coming soon
          </span>
        </div>
      )}
    </div>
  );
}