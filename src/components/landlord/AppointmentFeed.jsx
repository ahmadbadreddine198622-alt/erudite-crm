// AppointmentFeed — date-grouped feed of appointments, viewings, and meetings.
// Replaces the conversation stream when the Appointment tab is active.
// Fetches LandlordAppointment + Viewing + Meeting, merges into one timeline,
// groups by "Upcoming" then by month, renders expandable cards.
//
// Props:
//   landlordId   (string)  — current landlord id
//   onNewClick   (fn)      — optional: reveal the appointment composer below

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Calendar, Phone, Video, MapPin, ChevronDown, Plus, Clock, Users, UserCircle2 } from 'lucide-react';

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

// Normalize each entity type into a common shape.
function normalizeAppt(item) {
  const dt = item.datetime || item.scheduled_at;
  const type = item.type || (item.title ? 'meeting' : 'meeting');
  const title = item.title || item.notes?.slice(0, 50) || (type === 'viewing' ? 'Property Viewing' : type === 'call' ? 'Call' : 'Meeting');
  return {
    id: item.id,
    kind: type, // 'call' | 'viewing' | 'meeting'
    datetime: dt,
    title,
    notes: item.notes || '',
    location: item.location || '',
    duration: item.duration_minutes || 30,
    status: item.status || 'scheduled',
    source: 'appointment',
    created_from_ai: item.created_from_ai || false,
    created_date: item.created_date,
    agent_email: item.agent_email || '',
  };
}

function normalizeViewing(item) {
  return {
    id: item.id,
    kind: 'viewing',
    datetime: item.scheduled_at,
    title: item.title || 'Property Viewing',
    notes: item.notes || '',
    location: item.location || '',
    duration: item.duration_minutes || 30,
    status: item.status === 'done' ? 'completed' : item.status === 'cancelled' ? 'cancelled' : 'scheduled',
    source: 'viewing',
    created_from_ai: item.created_from_ai || false,
    created_date: item.created_date,
    agent_email: item.agent_email || '',
  };
}

function normalizeMeeting(item) {
  return {
    id: item.id,
    kind: 'meeting',
    datetime: item.scheduled_at,
    title: item.title || 'Meeting',
    notes: item.notes || '',
    location: item.location || '',
    duration: item.duration_minutes || 30,
    status: item.status === 'done' ? 'completed' : item.status === 'cancelled' ? 'cancelled' : 'scheduled',
    source: 'meeting',
    created_from_ai: item.created_from_ai || false,
    created_date: item.created_date,
    agent_email: item.agent_email || '',
  };
}

const KIND_META = {
  meeting:  { icon: Users,    color: '#8b5cf6', bg: 'rgba(139,92,246,0.14)', border: 'rgba(139,92,246,0.35)', label: 'Meeting' },
  viewing:  { icon: Video,    color: '#3b82f6', bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.35)', label: 'Viewing' },
  call:     { icon: Phone,    color: '#10b981', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.35)', label: 'Call' },
};

const STATUS_META = {
  scheduled: { label: 'Scheduled', color: 'rgba(255,255,255,0.6)', bg: 'rgba(255,255,255,0.06)' },
  completed: { label: 'Completed', color: '#34d399', bg: 'rgba(16,185,129,0.12)' },
  cancelled: { label: 'Cancelled', color: '#f87171', bg: 'rgba(239,68,68,0.12)' },
  no_show:   { label: 'No Show',   color: '#fbbf24', bg: 'rgba(245,158,11,0.12)' },
  pending:   { label: 'Pending',   color: 'rgba(255,255,255,0.6)', bg: 'rgba(255,255,255,0.06)' },
};

function fmtDateTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' });
  } catch (_) { return iso; }
}

function fmtDateHeader(iso) {
  if (!iso) return 'Undated';
  try {
    const d = new Date(iso);
    if (isNaN(d)) return 'Undated';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch (_) { return iso; }
}

function monthKey(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  } catch (_) { return 'Earlier'; }
}

// Group items: upcoming (future) first, then past by month descending.
function groupItems(items) {
  const now = Date.now();
  const upcoming = items.filter((i) => new Date(i.datetime).getTime() >= now).sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  const past = items.filter((i) => new Date(i.datetime).getTime() < now).sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

  const groups = [];
  if (upcoming.length) groups.push({ header: 'Upcoming', items: upcoming });
  const byMonth = {};
  past.forEach((i) => {
    const k = monthKey(i.datetime);
    if (!byMonth[k]) byMonth[k] = [];
    byMonth[k].push(i);
  });
  Object.entries(byMonth).forEach(([header, items]) => groups.push({ header, items }));
  return groups;
}

function AppointmentCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const meta = KIND_META[item.kind] || KIND_META.meeting;
  const status = STATUS_META[item.status] || STATUS_META.scheduled;
  const Icon = meta.icon;
  const dt = fmtDateTime(item.datetime);

  return (
    <div style={{ ...css("border-radius:11px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03); margin-bottom:8px; overflow:hidden; transition:border-color 0.15s ease;"), borderColor: expanded ? meta.border : undefined }}>
      <button onClick={() => setExpanded(!expanded)} style={css("width:100%; display:flex; align-items:flex-start; gap:10px; padding:11px 12px; background:transparent; border:none; cursor:pointer; text-align:left; font-family:'Inter',sans-serif;")}>
        {/* Type icon */}
        <div style={{ flex: 'none', width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: meta.bg, border: '1px solid ' + meta.border }}>
          <Icon size={15} style={{ color: meta.color }} />
        </div>
        {/* Title + datetime */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={css("display:flex; align-items:center; gap:6px; margin-bottom:2px;")}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.95)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta.label}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>— {item.title}</span>
            {item.created_from_ai && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 99, background: 'rgba(139,92,246,0.18)', color: '#c4b5fd', flex: 'none' }}>AI</span>}
          </div>
          <div style={css("display:flex; align-items:center; gap:6px;")}>
            <Clock size={10} style={{ color: 'rgba(255,255,255,0.4)', flex: 'none' }} />
            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)' }}>{dt}</span>
          </div>
        </div>
        {/* Status badge */}
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9.5, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: status.bg, color: status.color, whiteSpace: 'nowrap' }}>{status.label}</span>
          <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.4)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
        </div>
      </button>
      {expanded && (item.notes || item.location) && (
        <div style={css("padding:0 12px 10px 56px;")}>
          {item.location && (
            <div style={css("display:flex; align-items:center; gap:5px; margin-bottom:5px;")}>
              <MapPin size={11} style={{ color: meta.color }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{item.location}</span>
            </div>
          )}
          {item.notes && (
            <div style={css("font-size:11.5px; line-height:1.5; color:rgba(255,255,255,0.6); white-space:pre-wrap; padding:7px 10px; border-radius:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06);")}>{item.notes}</div>
          )}
        </div>
      )}
      {/* Footer strip — channel/duration info + Add comment link (matches mock-up) */}
      <div style={css("display:flex; align-items:center; justify-content:space-between; padding:5px 12px 6px 56px; border-top:1px solid rgba(255,255,255,0.04);")}>
        <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.4)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {item.agent_email ? (
            <>
              <span style={css("display:inline-flex; align-items:center; gap:4px;")}>
                <UserCircle2 size={11} style={{ color: meta.color }} />
                <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{item.agent_email.split('@')[0]}</span>
              </span>
              <span style={{ color: 'rgba(255,255,255,0.18)' }}>·</span>
            </>
          ) : null}
          {item.kind === 'call' ? 'Outbound' : item.location ? 'In-person' : 'Scheduled'} · {item.duration} min{item.source === 'appointment' && item.kind === 'call' ? ' · Twilio' : ''}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.35)', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Add comment
        </span>
      </div>
    </div>
  );
}

export default function AppointmentFeed({ landlordId, onNewClick }) {
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['appointmentFeed', landlordId],
    queryFn: async () => {
      const [appts, viewings, meetings] = await Promise.all([
        base44.entities.LandlordAppointment.filter({ landlord_id: landlordId }, '-datetime', 50).catch(() => []),
        base44.entities.Viewing.filter({ landlord_id: landlordId }, '-scheduled_at', 50).catch(() => []),
        base44.entities.Meeting.filter({ landlord_id: landlordId }, '-scheduled_at', 50).catch(() => []),
      ]);
      const all = [
        ...(appts || []).map(normalizeAppt),
        ...(viewings || []).map(normalizeViewing),
        ...(meetings || []).map(normalizeMeeting),
      ];
      return groupItems(all);
    },
    enabled: !!landlordId,
  });

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div style={css("padding:4px 0 8px;")}>
      {/* Header row */}
      <div style={css("display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;")}>
        <div style={css("display:flex; align-items:center; gap:7px;")}>
          <Calendar size={14} style={{ color: '#c4b5fd' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>Appointments</span>
          {total > 0 && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>{total}</span>}
        </div>
        {onNewClick && (
          <button onClick={onNewClick} style={css("display:inline-flex; align-items:center; gap:4px; padding:5px 10px; border-radius:8px; font-size:10.5px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(139,92,246,0.16); border:1px solid rgba(139,92,246,0.4); color:#c4b5fd;")}>
            <Plus size={12} /> New
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={css("text-align:center; padding:40px 0;")}>
          <div style={{ width: 24, height: 24, border: '2px solid rgba(139,92,246,0.3)', borderTopColor: '#c4b5fd', borderRadius: '50%', margin: '0 auto 10px', animation: 'af-spin 0.7s linear infinite' }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Loading appointments…</span>
          <style>{`@keyframes af-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : total === 0 ? (
        <div style={css("text-align:center; padding:36px 20px; border-radius:12px; border:1px dashed rgba(255,255,255,0.1);")}>
          <Calendar size={28} style={{ color: 'rgba(255,255,255,0.2)', margin: '0 auto 10px' }} />
          <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 4px' }}>No appointments yet</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0 }}>Book a viewing, call, or meeting below.</p>
        </div>
      ) : (
        groups.map((g, gi) => (
          <div key={gi} style={css("margin-bottom:14px;")}>
            <div style={css("display:flex; align-items:center; gap:8px; margin-bottom:8px;")}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: g.header === 'Upcoming' ? '#34d399' : 'rgba(255,255,255,0.4)' }}>{g.header}</span>
              <span style={{ fontSize: 9.5, fontWeight: 500, color: 'rgba(255,255,255,0.3)' }}>{g.items.length}</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            </div>
            {g.items.map((item) => <AppointmentCard key={item.source + item.id} item={item} />)}
          </div>
        ))
      )}
    </div>
  );
}