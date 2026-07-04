// bookAppointment — creates a Google Calendar event + LandlordAppointment record,
// sends a WhatsApp notification to the creator, and schedules one or more reminders.
//
// Input:
//   title              (string, required)
//   guest_emails       (string[], optional) — guest email addresses (attendees)
//   datetime           (ISO string, required)
//   timezone           (string, optional) — IANA timezone e.g. Asia/Dubai (default Asia/Dubai)
//   duration_minutes   (number, default 30)
//   landlord_id        (string, optional) — links to a Landlord record
//   type               (enum: call|viewing|meeting, default meeting)
//   location           (string)
//   notes              (string)
//   reminders          (array of { when_hours, text }, optional) — multiple reminders

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const pad = (n) => String(n).padStart(2, '0');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { landlord_id, title, datetime, timezone, duration_minutes, type, location, notes, guest_emails, reminders } = body;

    if (!datetime) {
      return Response.json({ ok: false, error: 'datetime is required' }, { status: 400 });
    }
    if (!title || !String(title).trim()) {
      return Response.json({ ok: false, error: 'title is required' }, { status: 400 });
    }

    const tz = timezone || 'Asia/Dubai';
    const guestEmails = Array.isArray(guest_emails) ? guest_emails.filter((e) => e && String(e).trim()) : [];
    const reminderList = Array.isArray(reminders) ? reminders.filter((r) => r && r.when_hours != null) : [];

    // ── 1. Fetch landlord (optional) ──────────────────────────────────
    let landlordName = null;
    let landlordEmail = null;
    let landlordPhone = null;
    if (landlord_id) {
      try {
        const landlord = await base44.entities.Landlord.get(landlord_id);
        landlordName = landlord?.full_name_en || landlord?.full_name_ar || 'Landlord';
        landlordEmail = landlord?.email || null;
        landlordPhone = landlord?.phone || landlord?.whatsapp || null;
      } catch (_) { /* landlord not found — proceed without */ }
    }

    const durMin = Number(duration_minutes) > 0 ? Number(duration_minutes) : 30;
    const apptType = type || 'meeting';
    const startMs = new Date(datetime).getTime();
    const startISO = new Date(startMs).toISOString();
    const endISO = new Date(startMs + durMin * 60000).toISOString();

    const displayTitle = landlordName ? `${title} — ${landlordName}` : title;

    // ── 2. Create Google Calendar event ────────────────────────────────
    let googleEventId = null;
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
      const attendees = [];
      if (user.email) attendees.push({ email: user.email });
      if (landlordEmail) attendees.push({ email: landlordEmail });
      for (const ge of guestEmails) {
        if (ge !== user.email && ge !== landlordEmail) attendees.push({ email: ge });
      }

      const eventData = {
        summary: displayTitle,
        description: [
          `Type: ${apptType}`,
          `Organized by: ${user.full_name || user.email}`,
          `Location: ${location || 'N/A'}`,
          notes ? `Notes: ${notes}` : null,
        ].filter(Boolean).join('\n'),
        start: { dateTime: startISO, timeZone: tz },
        end: { dateTime: endISO, timeZone: tz },
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

    // ── 3. Save LandlordAppointment record (only if linked to a landlord) ─
    let apptId = null;
    if (landlord_id) {
      try {
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
        apptId = appt.id;
      } catch (_) { /* best-effort */ }
    }

    // ── 4. WhatsApp notification to the creator ────────────────────────
    const creatorPhone = user.phone || null;
    if (creatorPhone) {
      try {
        const evoUrl = Deno.env.get('EVOLUTION_API_URL');
        const evoKey = Deno.env.get('EVOLUTION_API_KEY');
        const instance = Deno.env.get('EVOLUTION_INSTANCE');
        const dateFormatted = new Date(datetime).toLocaleString('en-GB', {
          timeZone: tz, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        });
        const waText = `📅 *Appointment Booked*\n\n*${title}*\n${landlordName ? `Owner: ${landlordName}\n` : ''}When: ${dateFormatted}\nDuration: ${durMin} min${location ? `\nLocation: ${location}` : ''}`;
        const digits = creatorPhone.replace(/[^0-9]/g, '');
        await fetch(`${evoUrl}/message/sendText/${instance}`, {
          method: 'POST',
          headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: digits, text: waText }),
        });
      } catch (_) { /* WhatsApp is best-effort */ }
    }

    // ── 5. Schedule reminders (multiple) ───────────────────────────────
    for (const r of reminderList) {
      try {
        const reminderAt = new Date(startMs - Number(r.when_hours) * 3600000).toISOString();
        const reminderText = (r.text || '')
          .replace(/\{\{landlord_name\}\}/g, landlordName || 'the owner')
          .replace(/\{\{agent_name\}\}/g, user.full_name || 'your agent')
          .replace(/\{\{title\}\}/g, title);
        await base44.asServiceRole.entities.ScheduledMessage.create({
          recipient_phone: landlordPhone || null,
          recipient_name: landlordName || (guestEmails[0] || ''),
          message_body: reminderText,
          message_kind: 'freeform',
          scheduled_at: reminderAt,
          status: 'pending',
          created_by_email: user.email,
        });
      } catch (_) { /* each reminder is best-effort */ }
    }

    return Response.json({
      ok: true,
      appointment_id: apptId,
      google_event_id: googleEventId,
      landlord_name: landlordName,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});