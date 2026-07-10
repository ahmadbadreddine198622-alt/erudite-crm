import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();
    
    const lead = data;
    const leadId = event.entity_id;

    // Check if all required fields are present
    if (!lead.preferred_date || !lead.preferred_time) {
      console.log('Skipping: missing preferred_date or preferred_time');
      return Response.json({ status: 'skipped', reason: 'missing_date_or_time' });
    }

    // Check if status is one of the trigger statuses
    if (!['Call Scheduled', 'Viewing Booked'].includes(lead.status)) {
      console.log('Skipping: status is not Call Scheduled or Viewing Booked');
      return Response.json({ status: 'skipped', reason: 'status_not_triggered' });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

    // Build a naive wall-clock datetime string directly from the stored fields — no
    // server-local Date round-trip, no "Z". Combined with timeZone "Asia/Dubai" this
    // fixes the +4h drift. Asia/Dubai is a fixed UTC+4 offset with no DST.
    const startWall = `${lead.preferred_date}T${lead.preferred_time}:00`;
    // Compute +30 minutes safely (handles hour/day rollover) via UTC arithmetic, then
    // format back to a wall-clock string (the absolute UTC instant is irrelevant here —
    // we only use it to advance the clock and re-read the calendar fields).
    const [y, mo, d] = lead.preferred_date.split('-').map((n) => parseInt(n, 10));
    const [h, mi] = lead.preferred_time.split(':').map((n) => parseInt(n, 10));
    const endMs = Date.UTC(y, mo - 1, d, h, mi) + 30 * 60000;
    const endDate = new Date(endMs);
    const pad = (n) => String(n).padStart(2, '0');
    const endWall = `${endDate.getUTCFullYear()}-${pad(endDate.getUTCMonth() + 1)}-${pad(endDate.getUTCDate())}T${pad(endDate.getUTCHours())}:${pad(endDate.getUTCMinutes())}:00`;

    // Build event description
    const description = [
      `Phone: ${lead.phone || 'N/A'}`,
      `Email: ${lead.email || 'N/A'}`,
      `Source: ${lead.source || 'N/A'}`,
      `Notes: ${lead.notes || 'N/A'}`,
      `Status: ${lead.status}`
    ].join('\n');

    const event_data = {
      summary: `Lead - ${lead.full_name} - ${lead.project || 'Project'}`,
      description,
      start: {
        dateTime: startWall,
        timeZone: 'Asia/Dubai'
      },
      end: {
        dateTime: endWall,
        timeZone: 'Asia/Dubai'
      }
    };

    const authHeaders = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
    const createUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

    // Idempotency: reuse an existing event if we already created one for this lead.
    // google_event_id is the source of truth; calendar_event_id is a legacy fallback.
    const existingEventId = lead.google_event_id || lead.calendar_event_id || null;

    const createEvent = async () => {
      const response = await fetch(createUrl, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(event_data)
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create calendar event: ${error}`);
      }
      const createdEvent = await response.json();
      await base44.entities.Leads.update(leadId, { google_event_id: createdEvent.id });
      return createdEvent.id;
    };

    if (existingEventId) {
      // Update the existing event in place.
      const patchRes = await fetch(`${createUrl}/${encodeURIComponent(existingEventId)}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify(event_data)
      });

      if (patchRes.ok) {
        const updatedEvent = await patchRes.json();
        // Backfill google_event_id for legacy records that only had calendar_event_id.
        if (!lead.google_event_id) {
          await base44.entities.Leads.update(leadId, { google_event_id: updatedEvent.id });
        }
        return Response.json({ status: 'updated', event_id: updatedEvent.id });
      }

      // Stored event was deleted in Google — create a fresh one.
      if (patchRes.status === 404 || patchRes.status === 410) {
        const newId = await createEvent();
        return Response.json({ status: 'created', event_id: newId });
      }

      const error = await patchRes.text();
      return Response.json({ error: 'Failed to update calendar event', details: error }, { status: 500 });
    }

    const newId = await createEvent();
    return Response.json({ status: 'created', event_id: newId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});