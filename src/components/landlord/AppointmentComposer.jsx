// AppointmentComposer — landlord-native "connect v1": parse → confirm → book.
//
// Flow:
//   1. Agent types natural language ("owner meeting Thursday 4pm for 30 min").
//   2. We parse it with the appointment brain (BRAIN_FN) → parsed date/time + suggested slots.
//   3. A confirm chip shows the parsed slot + clickable alternative slots.
//   4. On Confirm → create a LandlordAppointment. The syncLandlordAppointmentToCalendar
//      automation (fires on LandlordAppointment create) pushes it to Google Calendar — we
//      do NOT book the calendar here.
//
// Props:
//   landlordId   (string)  — current landlord id
//   propertyId   (string)  — optional, passed to the brain for address composition
//   agentEmail   (string)  — assigned agent (fallback for the appointment's agent_email)
//   onBooked     (fn)      — called after the appointment is created (push a timeline card)

import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { playSentSound, SendFlash } from '@/components/landlord/sendFeedback';

// Single point of truth for which brain parses the text. Repoint to a v3 brain in one line.
const BRAIN_FN = 'scribeBrain';

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

// Map the brain's appointment type onto the LandlordAppointment.type enum (call|viewing|meeting).
function toApptType(brainType) {
  if (brainType === 'viewing') return 'viewing';
  if (brainType === 'followup') return 'call';
  return 'meeting'; // owner_meeting + anything else
}

// "2026-06-26" + "16:00" → "2026-06-26T16:00:00+04:00" (Asia/Dubai is a fixed +04:00 offset).
function toDubaiDatetime(date, time) {
  const hh = String(time || '00:00').slice(0, 5);
  return `${date}T${hh}:00+04:00`;
}

function prettySlot(date, time) {
  try {
    const d = new Date(toDubaiDatetime(date, time));
    return d.toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' });
  } catch (_) {
    return `${date} ${time}`;
  }
}

const fieldStyle = css("padding:9px 12px; border-radius:9px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.9); font-size:12.5px; font-family:'Inter',sans-serif; width:100%; line-height:1.45;");

export default function AppointmentComposer({ landlordId, propertyId, agentEmail, onBooked }) {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [booking, setBooking] = useState(false);
  // The pending confirmation: { date, time, type, duration } — null until parsed.
  const [pending, setPending] = useState(null);
  const [slots, setSlots] = useState([]);
  const [address, setAddress] = useState('');
  const [justBooked, setJustBooked] = useState(false);
  const flashTimer = useRef(null);

  const parse = async () => {
    const t = text.trim();
    if (!t) { toast.error('Type the appointment first'); return; }
    setParsing(true);
    try {
      const res = await base44.functions.invoke(BRAIN_FN, { text: t, property_id: propertyId || undefined });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      const p = data?.parsed || {};
      if (!p.viewing_date || !p.viewing_time) throw new Error("Couldn't read a date/time — try e.g. \"Thursday 4pm\"");
      setPending({ date: p.viewing_date, time: p.viewing_time, type: toApptType(p.type), duration: p.duration || 30 });
      setSlots(Array.isArray(data?.suggested_slots) ? data.suggested_slots : []);
      setAddress(data?.property_address || '');
    } catch (e) {
      toast.error(e?.message || 'Failed to parse appointment');
    } finally {
      setParsing(false);
    }
  };

  const pickSlot = (s) => setPending((prev) => ({ ...prev, date: s.viewing_date, time: s.viewing_time }));

  const book = async () => {
    if (!pending || booking) return;
    setBooking(true);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { user = null; }
    try {
      await base44.entities.LandlordAppointment.create({
        landlord_id: landlordId,
        agent_email: user?.email || agentEmail || undefined,
        datetime: toDubaiDatetime(pending.date, pending.time),
        type: pending.type,
        duration_minutes: pending.duration,
        notes: text.trim(),
        status: 'scheduled',
      });
      // Multi-sensory confirmation: sound + flash overlay + toast (matches iMessage).
      playSentSound();
      if (navigator.vibrate) { try { navigator.vibrate([18, 40, 18]); } catch (_) {} }
      setJustBooked(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setJustBooked(false), 1700);
      toast.success('Appointment booked · syncing to calendar');
      if (onBooked) onBooked({ when: prettySlot(pending.date, pending.time), type: pending.type, notes: text.trim() });
      setText(''); setPending(null); setSlots([]); setAddress('');
    } catch (e) {
      toast.error('Failed to book: ' + (e?.message || 'unknown error'));
    } finally {
      setBooking(false);
    }
  };

  return (
    <div style={{ ...css("margin-bottom:9px; border-radius:12px; border:1px solid rgba(139,92,246,0.28); background:rgba(139,92,246,0.05); padding:11px 12px;"), position: 'relative', overflow: 'hidden' }}>
      <style>{`@keyframes ap-spin { to { transform: rotate(360deg); } }`}</style>
      {justBooked && <SendFlash color="#8b5cf6" label="Booked!" glyph="📅" />}

      <div style={css("display:flex; align-items:center; gap:6px; margin-bottom:8px;")}>
        <span style={css("font-size:10.5px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:#c4b5fd;")}>Smart Appointment</span>
        <span style={css("font-size:8.5px; font-weight:600; padding:1px 6px; border-radius:99px; background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.45);")}>Type it in plain words</span>
      </div>

      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); if (pending) setPending(null); }}
        rows={2}
        placeholder='e.g. "Owner meeting Thursday 4pm for 30 min"'
        style={{ ...fieldStyle, resize: 'vertical', minHeight: 54, marginBottom: 8 }}
      />

      {!pending && (
        <button onClick={parse} disabled={parsing || !text.trim()}
          style={css(
            "width:100%; padding:9px; border-radius:9px; font-size:12px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; display:flex; align-items:center; justify-content:center; gap:7px; " +
            "background:rgba(139,92,246,0.16); color:#ddd6fe; border:1px solid rgba(139,92,246,0.5); opacity:" + (parsing || !text.trim() ? 0.6 : 1) + ";"
          )}>
          {parsing ? (<><span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(221,214,254,0.4)', borderTopColor: '#ddd6fe', borderRadius: '50%', animation: 'ap-spin 0.7s linear infinite' }} />Reading…</>) : '✦ Parse appointment'}
        </button>
      )}

      {pending && (
        <div style={css("display:flex; flex-direction:column; gap:9px;")}>
          {/* confirm chip */}
          <div style={css("border-radius:10px; background:rgba(139,92,246,0.12); border:1px solid rgba(139,92,246,0.4); padding:10px 12px;")}>
            <div style={css("font-size:9px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:#a78bfa; margin-bottom:4px;")}>Confirm this slot</div>
            <div style={css("font-size:14px; font-weight:700; color:#ede9fe;")}>📅 {prettySlot(pending.date, pending.time)}</div>
            <div style={css("font-size:10.5px; color:rgba(255,255,255,0.55); margin-top:3px; text-transform:capitalize;")}>{pending.type} · {pending.duration} min{address ? ' · ' + address : ''}</div>
          </div>

          {/* suggested alternative slots */}
          {slots.length > 0 && (
            <div>
              <div style={css("font-size:9px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:5px;")}>Or pick a free slot</div>
              <div style={css("display:flex; gap:5px; flex-wrap:wrap;")}>
                {slots.map((s, i) => {
                  const on = pending.date === s.viewing_date && pending.time === s.viewing_time;
                  return (
                    <button key={i} onClick={() => pickSlot(s)}
                      style={css(
                        "padding:5px 10px; border-radius:8px; font-size:10.5px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; " +
                        "background:" + (on ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.04)") + "; " +
                        "color:" + (on ? "#ddd6fe" : "rgba(255,255,255,0.7)") + "; " +
                        "border:1px solid " + (on ? "rgba(139,92,246,0.55)" : "rgba(255,255,255,0.1)") + ";"
                      )}>{s.label || prettySlot(s.viewing_date, s.viewing_time)}</button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={css("display:flex; gap:7px;")}>
            <button onClick={() => setPending(null)} disabled={booking}
              style={css("flex:none; padding:10px 14px; border-radius:9px; font-size:12px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.6);")}>← Edit</button>
            <button onClick={book} disabled={booking}
              style={css(
                "flex:1; padding:10px; border-radius:9px; font-size:12px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; display:flex; align-items:center; justify-content:center; gap:7px; " +
                "background:linear-gradient(180deg, #8b5cf6, #7c3aed); color:#fff; border:1px solid rgba(139,92,246,0.6); opacity:" + (booking ? 0.85 : 1) + ";"
              )}>
              {booking ? (<><span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'ap-spin 0.7s linear infinite' }} />Booking…</>) : '✓ Confirm & book'}
            </button>
          </div>
          <div style={css("font-size:9px; color:rgba(255,255,255,0.35); text-align:center;")}>Adds to Google Calendar automatically in Dubai time.</div>
        </div>
      )}
    </div>
  );
}