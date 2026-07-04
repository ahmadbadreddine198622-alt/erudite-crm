// bookAppointment — creates a Google Calendar event + LandlordAppointment record,
// sends a WhatsApp notification to the creator, and optionally schedules a reminder
// to the landlord.
//
// Input:
//   landlord_id          (string, required)
//   title                (string, required)
//   datetime             (ISO string, required) — Asia/Dubai local
//   duration_minutes     (number, default 30)
//   type                 (enum: call|viewing|meeting, default meeting)
//   location             (string)
//   notes                (string)
//   reminder_delay_hours (number) — when to remind the landlord (e.g. 24 = 24h before)
//   reminder_text        (string) — custom reminder text for the landlord

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const pad = (n) => String(n).padStart(2, '0');
const toDubaiWall = (ms) => {
  const d = new Date(ms + 4 * 60 * 60000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { landlord_id, title, datetime, duration_minutes, type, location, notes, reminder_delay_hours, reminder_text } = body;

    if (!landlord_id || !datetime) {
      return Response.json({ ok: false, error: 'landlord_id and datetime are required' }, { status: 400 });
    }

    // ── 1. Fetch landlord ──────────────────────────────────────────────
    const landlord = await base44.entities.Landlord.get(landlord_id);
    const landlordName = landlord?.full_name_en || landlord?.full_name_ar || 'Landlord';
    const landlordEmail = landlord?.email || null;
    const landlordPhone = landlord?.phone || landlord?.whatsapp || null;

    const durMin = Number(duration_minutes) > 0 ? Number(duration_minutes) : 30;
    const apptType = type || 'meeting';
    const startMs = new Date(datetime).getTime();
    const startWall = toDubaiWall(startMs);
    const endWall = toDubaiWall(startMs + durMin * 60000);

    // ── 2. Create Google Calendar event ────────────────────────────────
    let googleEventId = null;
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
      const attendees = [];
      if (user.email) attendees.push({ email: user.email });
      if (landlordEmail) attendees.push({ email: landlordEmail });

      const eventData = {
        summary: `${title || apptType} — ${landlordName}`,
        description: [
          `Type: ${apptType}`,
          `Organized by: ${user.full_name || user.email}`,
          `Location: ${location || 'N/A'}`,
          notes ? `Notes: ${notes}` : null,
        ].filter(Boolean).join('\n'),
        start: { dateTime: startWall, timeZone: 'Asia/Dubai' },
        end: { dateTime: endWall, timeZone: 'Asia/Dubai' },
        ...(attendees.length ? { attendees } : {}),
      };

      const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });
      if (resp.ok) {
        const created = await resp.json();
        googleEventId = created.id;
      }
    } catch (_) { /* calendar is best-effort — appointment still saves */ }

    // ── 3. Save LandlordAppointment record ─────────────────────────────
    const appt = await base44.entities.LandlordAppointment.create({
      landlord_id,
      agent_email: user.email,
      datetime,
      duration_minutes: durMin,
      type: apptType,
      location: location || '',
      notes: notes || '',
      status: 'scheduled',
      google_event_id: googleEventId,
    });

    // ── 4. WhatsApp notification to the creator ────────────────────────
    const creatorPhone = user.phone || null;
    if (creatorPhone) {
      try {
        const evoUrl = Deno.env.get('EVOLUTION_API_URL');
        const evoKey = Deno.env.get('EVOLUTION_API_KEY');
        const instance = Deno.env.get('EVOLUTION_INSTANCE');
        const dateFormatted = new Date(datetime).toLocaleString('en-GB', {
          timeZone: 'Asia/Dubai', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        });
        const waText = `📅 *Appointment Booked*\n\n*${title || apptType}*\nOwner: ${landlordName}\nWhen: ${dateFormatted}\nDuration: ${durMin} min${location ? `\nLocation: ${location}` : ''}`;
        const digits = creatorPhone.replace(/[^0-9]/g, '');
        await fetch(`${evoUrl}/message/sendText/${instance}`, {
          method: 'POST',
          headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: digits, text: waText }),
        });
      } catch (_) { /* WhatsApp is best-effort */ }
    }

    // ── 5. Schedule landlord reminder ──────────────────────────────────
    if (reminder_delay_hours && landlordPhone && reminder_text) {
      try {
        const reminderAt = new Date(startMs - Number(reminder_delay_hours) * 3600000).toISOString();
        await base44.asServiceRole.entities.ScheduledMessage.create({
          recipient_phone: landlordPhone,
          recipient_name: landlordName,
          message_body: reminder_text
            .replace(/\{\{landlord_name\}\}/g, landlordName)
            .replace(/\{\{agent_name\}\}/g, user.full_name || 'your agent')
            .replace(/\{\{title\}\}/g, title || apptType),
          message_kind: 'freeform',
          scheduled_at: reminderAt,
          status: 'pending',
          created_by_email: user.email,
        });
      } catch (_) { /* reminder is best-effort */ }
    }

    return Response.json({
      ok: true,
      appointment_id: appt.id,
      google_event_id: googleEventId,
      landlord_name: landlordName,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});