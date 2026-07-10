import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Syncs a Meeting record to Google Calendar (agent as organizer, landlord as attendee so it
// lands on their calendar too and they get Google's own accept/decline invite), plus sends a
// branded confirmation email to the landlord asking them to confirm. Idempotent via google_event_id.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    const meeting = data;
    const meetingId = event.entity_id;

    if (!meeting || !meeting.scheduled_at) {
      return Response.json({ status: 'skipped', reason: 'missing_scheduled_at' });
    }
    if (meeting.status === 'cancelled') {
      return Response.json({ status: 'skipped', reason: 'cancelled' });
    }

    let landlord = null;
    if (meeting.landlord_id) {
      landlord = await base44.asServiceRole.entities.Landlord.get(meeting.landlord_id).catch(() => null);
    }
    const landlordName = landlord?.full_name_en || landlord?.full_name_ar || 'Client';
    const landlordEmail = landlord?.email || null;
    const agentEmail = meeting.agent_email || landlord?.assigned_agent_email || null;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

    const startMs = new Date(meeting.scheduled_at).getTime();
    const durationMin = Number(meeting.duration_minutes) > 0 ? Number(meeting.duration_minutes) : 30;
    const pad = (n) => String(n).padStart(2, '0');
    const toDubaiWall = (ms) => {
      const d = new Date(ms + 4 * 60 * 60000);
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
    };
    const startWall = toDubaiWall(startMs);
    const endWall = toDubaiWall(startMs + durationMin * 60000);

    const attendees = [];
    if (agentEmail) attendees.push({ email: agentEmail });
    if (landlordEmail) attendees.push({ email: landlordEmail });

    const event_data = {
      summary: meeting.title || `Meeting — ${landlordName}`,
      description: [
        `Client: ${landlordName}`,
        `Agent: ${agentEmail || 'N/A'}`,
        `Location: ${meeting.location || 'N/A'}`,
        `Notes: ${meeting.notes || 'N/A'}`,
      ].join('\n'),
      location: meeting.location || '',
      start: { dateTime: startWall, timeZone: 'Asia/Dubai' },
      end: { dateTime: endWall, timeZone: 'Asia/Dubai' },
      ...(attendees.length ? { attendees } : {}),
    };

    const authHeaders = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
    const baseUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    const existingEventId = meeting.google_event_id || null;

    let calendarEventId = null;
    let calendarAction = 'created';

    if (existingEventId) {
      const patchRes = await fetch(`${baseUrl}/${encodeURIComponent(existingEventId)}?sendUpdates=all`, {
        method: 'PATCH', headers: authHeaders, body: JSON.stringify(event_data),
      });
      if (patchRes.ok) {
        const updated = await patchRes.json();
        calendarEventId = updated.id;
        calendarAction = 'updated';
      } else if (patchRes.status === 404 || patchRes.status === 410) {
        const createRes = await fetch(`${baseUrl}?sendUpdates=all`, {
          method: 'POST', headers: authHeaders, body: JSON.stringify(event_data),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          calendarEventId = created.id;
          calendarAction = 'recreated';
        }
      }
    } else {
      const createRes = await fetch(`${baseUrl}?sendUpdates=all`, {
        method: 'POST', headers: authHeaders, body: JSON.stringify(event_data),
      });
      if (createRes.ok) {
        const created = await createRes.json();
        calendarEventId = created.id;
        calendarAction = 'created';
      }
    }

    if (calendarEventId && calendarEventId !== existingEventId) {
      await base44.asServiceRole.entities.Meeting.update(meetingId, { google_event_id: calendarEventId });
    }

    // Send a confirmation email to the landlord (once, on first creation)
    if (landlordEmail && calendarAction === 'created' && !meeting.confirmation_email_sent) {
      const dateFormatted = new Date(meeting.scheduled_at).toLocaleString('en-GB', {
        timeZone: 'Asia/Dubai', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: landlordEmail,
        subject: `Please confirm your meeting — ${dateFormatted}`,
        body: `Hi ${landlordName},\n\nWe've scheduled a meeting with you:\n\n📅 ${dateFormatted}\n📍 ${meeting.location || 'N/A'}\n\nPlease reply to confirm you're available, or let us know if you'd like to reschedule.\n\nLooking forward to speaking with you.`,
      }).catch(() => null);
      await base44.asServiceRole.entities.Meeting.update(meetingId, { confirmation_email_sent: true });
    }

    return Response.json({ status: calendarAction, event_id: calendarEventId, email_sent: !!landlordEmail });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});