// CalendarMonthView — month grid calendar showing all events (Google + CRM).
// Each day cell shows up to 3 event chips; clicking a day selects it.
//
// Props:
//   events       (array) — normalized events { start, end, title, type, source, ... }
//   monthDate    (Date)  — any date within the month to display
//   selectedDate (Date)  — currently selected day
//   onPrevMonth  (fn)    — navigate to previous month
//   onNextMonth  (fn)    — navigate to next month
//   onSelectDate (fn)    — called with a Date when a day is clicked

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const TYPE_META = {
  google:  { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)' },
  meeting: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.4)' },
  viewing: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)' },
  call:    { color: '#22c55e', bg: 'rgba(34,197,94,0.15)',  border: 'rgba(34,197,94,0.4)' },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getGridDays(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startOffset = first.getDay(); // 0 = Sunday
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startOffset);
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatChipTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch { return ''; }
}

export default function CalendarMonthView({ events, monthDate, selectedDate, onPrevMonth, onNextMonth, onSelectDate }) {
  const days = getGridDays(monthDate);
  const today = new Date();
  const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Index events by date string for quick lookup
  const eventsByDay = {};
  (events || []).forEach((e) => {
    if (!e.start) return;
    try {
      const d = new Date(e.start);
      const key = d.toDateString();
      if (!eventsByDay[key]) eventsByDay[key] = [];
      eventsByDay[key].push(e);
    } catch {}
  });

  return (
    <div style={{
      borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.02)',
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Month navigation header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'rgba(255,255,255,0.95)' }}>{monthLabel}</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onPrevMonth} style={{
            width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><ChevronLeft size={16} /></button>
          <button onClick={onNextMonth} style={{
            width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Day name headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        {DAY_NAMES.map((d) => (
          <div key={d} style={{
            padding: '8px 4px', textAlign: 'center',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.35)',
          }}>{d}</div>
        ))}
      </div>

      {/* Day cells grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map((day, i) => {
          const isToday = sameDay(day, today);
          const isSelected = selectedDate && sameDay(day, selectedDate);
          const isCurrentMonth = day.getMonth() === monthDate.getMonth();
          const dayEvents = eventsByDay[day.toDateString()] || [];
          const visibleEvents = dayEvents.slice(0, 3);
          const moreCount = dayEvents.length - visibleEvents.length;

          return (
            <button
              key={i}
              onClick={() => onSelectDate(day)}
              style={{
                minHeight: 88, padding: '5px 5px 4px', textAlign: 'left', cursor: 'pointer',
                background: isSelected ? 'hsl(38 92% 50% / 0.06)' : 'transparent',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                borderRight: i % 7 !== 6 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                border: 'none',
                borderTop: i < 7 ? 'none' : undefined,
                position: 'relative',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {/* Day number */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 22, height: 22, borderRadius: 99, fontSize: 11, fontWeight: 600,
                color: isToday ? '#1a1205' : (isCurrentMonth ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)'),
                background: isToday ? 'hsl(38 92% 50%)' : 'transparent',
                marginBottom: 3,
              }}>{day.getDate()}</div>

              {/* Event chips */}
              {visibleEvents.map((e, ei) => {
                const meta = TYPE_META[e.type] || TYPE_META.meeting;
                return (
                  <div key={ei} style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    padding: '2px 5px', borderRadius: 4, marginBottom: 2,
                    background: meta.bg, borderLeft: `2px solid ${meta.color}`,
                    fontSize: 9.5, fontWeight: 500, color: 'rgba(255,255,255,0.85)',
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                  }}>
                    <span style={{ color: meta.color, fontWeight: 700, flexShrink: 0 }}>{formatChipTime(e.start)}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</span>
                  </div>
                );
              })}
              {moreCount > 0 && (
                <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.4)', padding: '1px 5px' }}>
                  +{moreCount} more
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}