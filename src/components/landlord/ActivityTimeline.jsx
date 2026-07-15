// Chronological timeline renderer for the Landlord Activity tab — groups items by day
// (Today / Yesterday / date) with a connecting vertical line through each entry's icon,
// like a classic CRM activity timeline.
import React from 'react';
import { Phone, Mail, MessageCircle, Upload, CheckSquare, Calendar, FileText, RefreshCw } from 'lucide-react';
import SpeechifyPlayer from '@/components/academy/SpeechifyPlayer';

const GOLD = '#C9A24B';

const ACTIVITY_META = {
  call: { icon: Phone, color: '#93c5fd', bg: 'rgba(59,130,246,0.14)' },
  email: { icon: Mail, color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.14)' },
  message: { icon: MessageCircle, color: '#4ade80', bg: 'rgba(37,211,102,0.14)' },
  upload: { icon: Upload, color: '#c4b5fd', bg: 'rgba(139,92,246,0.14)' },
  task: { icon: CheckSquare, color: '#34d399', bg: 'rgba(16,185,129,0.14)' },
  appointment: { icon: Calendar, color: '#c4b5fd', bg: 'rgba(139,92,246,0.14)' },
  note: { icon: FileText, color: 'rgba(255,255,255,0.7)', bg: 'rgba(255,255,255,0.06)' },
  followup: { icon: RefreshCw, color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.14)' },
};

const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const dayLabel = (ts) => {
  const d = new Date(ts);
  const now = new Date();
  const today = dayKey(now.getTime());
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  const k = dayKey(ts);
  if (k === today) return 'Today';
  if (k === dayKey(yest.getTime())) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

const fmtHour = (ts) => {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

function TimelineRow({ item, isLast }) {
  const meta = ACTIVITY_META[item.type] || ACTIVITY_META.note;
  const Icon = meta.icon;
  return (
    <div style={{ display: 'flex', gap: 11, position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
        <span style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: meta.bg, color: meta.color, zIndex: 1 }}>
          <Icon size={15} />
        </span>
        {!isLast && <span style={{ flex: 1, width: 1, background: 'rgba(255,255,255,0.08)', marginTop: 2 }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontFamily: "'Inter',sans-serif" }}>
            <span>{item.title}</span>
            {!item.subtitle && <SpeechifyPlayer text={item.title} size={10} color="rgba(255,255,255,0.4)" style={{ flex: 'none' }} />}
          </div>
          <span style={{ flex: 'none', fontSize: 10.5, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>{fmtHour(item.ts)}</span>
        </div>
        {item.subtitle && <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, fontSize: 11.5, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}><span style={{ flex: 1 }}>{item.subtitle}</span><SpeechifyPlayer text={`${item.title}. ${item.subtitle}`} size={10} color="rgba(255,255,255,0.4)" style={{ flex: 'none' }} /></div>}
        {item.by && (
          <span style={{ display: 'inline-flex', alignItems: 'center', marginTop: 4, padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, color: GOLD, background: 'rgba(201,162,75,0.12)', border: '1px solid rgba(201,162,75,0.25)' }}>
            by {item.by}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ActivityTimeline({ activity }) {
  // Group the already-sorted (newest-first) items by calendar day, preserving order.
  const groups = [];
  activity.forEach((item) => {
    const key = dayKey(item.ts);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: dayLabel(item.ts), items: [] };
      groups.push(g);
    }
    g.items.push(item);
  });

  return (
    <div>
      {groups.map((g) => (
        <div key={g.key} style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', padding: '10px 0 8px' }}>
            {g.label}
          </div>
          {g.items.map((item, i) => (
            <TimelineRow key={i} item={item} isLast={i === g.items.length - 1} />
          ))}
        </div>
      ))}
    </div>
  );
}