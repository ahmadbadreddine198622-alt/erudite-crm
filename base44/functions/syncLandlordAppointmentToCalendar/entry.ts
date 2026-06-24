import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// syncLandlordAppointmentToCalendar — pushes a LandlordAppointment to Google Calendar.
//
// Mirrors the working syncLeadToCalendar: builds a naive Asia/Dubai wall-clock window so
// there is no +4h drift, and is idempotent via google_event_id (update in place, never
// duplicate). Fired by an entity automation on LandlordAppointment create/update.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    const appt = data;
    const apptId = event.entity_id;

    if (!appt || !appt.datetime) {
      return Response.json({ status: 'skipped', reason: 'missing_datetime' });
    }
    // Don't put cancelled appointments on the calendar.
    if (appt.status === 'cancelled') {
      return Response.json({ status: 'skipped', reason: 'cancelled' });
    }

    // Pull the parent landlord for a meaningful event title.
    let landlordName = 'Landlord';
    if (appt.landlord_id) {
      try {
        const ll = await base44.asServiceRole.entities.Landlord.get(appt.landlord_id);
        landlordName = ll?.full_name_en || ll?.full_name_ar || landlordName;
      } catch (_) { /* best-effort */ }
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

    // Convert the stored instant to a naive Asia/Dubai wall-clock string (UTC+4, no DST),
    // then attach timeZone: 'Asia/Dubai' — same drift-free approach as the Leads sync.
    const startMs = new Date(appt.datetime).getTime();
    const durationMin = Number(appt.duration_minutes) > 0 ? Number(appt.duration_minutes) : 30;
    const pad = (n) => String(n).padStart(2, '0');
    const toDubaiWall = (ms) => {
      const d = new Date(ms + 4 * 60 * 60000); // shift into UTC+4, then read UTC fields as wall-clock
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
    };
    const startWall = toDubaiWall(startMs);
    const endWall = toDubaiWall(startMs + durationMin * 60000);

    const description = [
      `Type: ${appt.type || 'N/A'}`,
      `Channel: ${appt.channel || 'N/A'}`,
      `Agent: ${appt.agent_email || 'N/A'}`,
      `Location: ${appt.location || 'N/A'}`,
      `Notes: ${appt.notes || 'N/A'}`,
      `Status: ${appt.status || 'scheduled'}`,
    ].join('\n');

    // Add the acting agent as an attendee so the event also lands on their personal calendar.
    const event_data = {
      summary: `${(appt.type || 'meeting')} — ${landlordName}`,
      description,
      start: { dateTime: startWall, timeZone: 'Asia/Dubai' },
      end: { dateTime: endWall, timeZone: 'Asia/Dubai' },
      ...(appt.agent_email ? { attendees: [{ email: appt.agent_email }] } : {}),
    };

    const authHeaders = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
    const baseUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

    const createEvent = async () => {
      const response = await fetch(`${baseUrl}?sendUpdates=all`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(event_data),
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Failed to create calendar event: ${err}`);
      }
      const created = await response.json();
      await base44.asServiceRole.entities.LandlordAppointment.update(apptId, { google_event_id: created.id });
      return created.id;
    };

    const existingEventId = appt.google_event_id || null;

    if (existingEventId) {
      const patchRes = await fetch(`${baseUrl}/${encodeURIComponent(existingEventId)}?sendUpdates=all`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify(event_data),
      });
      if (patchRes.ok) {
        const updated = await patchRes.json();
        return Response.json({ status: 'updated', event_id: updated.id });
      }
      // Stored event was deleted in Google — create a fresh one.
      if (patchRes.status === 404 || patchRes.status === 410) {
        const newId = await createEvent();
        return Response.json({ status: 'created', event_id: newId });
      }
      const err = await patchRes.text();
      return Response.json({ error: 'Failed to update calendar event', details: err }, { status: 500 });
    }

    const newId = await createEvent();
    return Response.json({ status: 'created', event_id: newId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});