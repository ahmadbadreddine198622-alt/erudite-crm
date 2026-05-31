/**
 * Entity automation handler — fires when a LeadActivity is created or updated.
 * Syncs 'booking' (Property Viewing) and 'task' (Follow-up) activities to Google Calendar.
 * - CREATE: new event when due_at is set and no calendar_event_id exists in meta
 * - UPDATE: patches existing event when meta.calendar_event_id is present and due_at changes
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const UAE_TZ = 'Asia/Dubai';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data: activity, old_data } = await req.json();

    const activityId = event.entity_id;
    const syncTypes = ['booking', 'task'];

    // Only sync relevant activity types with a due date
    if (!syncTypes.includes(activity?.activity_type)) {
      return Response.json({ status: 'skipped', reason: 'not_a_syncable_type' });
    }
    if (!activity?.due_at) {
      return Response.json({ status: 'skipped', reason: 'no_due_date' });
    }

    // For updates: skip if neither due_at nor title changed
    if (event.type === 'update' && old_data) {
      const dueDateChanged = old_data.due_at !== activity.due_at;
      const titleChanged = old_data.title !== activity.title;
      if (!dueDateChanged && !titleChanged) {
        return Response.json({ status: 'skipped', reason: 'no_relevant_changes' });
      }
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

    const startTime = new Date(activity.due_at);
    const endTime = new Date(startTime.getTime() + 60 * 60000); // 1 hour

    // Fetch lead details for richer event description
    let leadDetails = null;
    if (activity.lead_id) {
      leadDetails = await base44.asServiceRole.entities.Lead.get(activity.lead_id).catch(() => null);
    }

    const isViewing = activity.activity_type === 'booking';
    const emoji = isViewing ? '🏠' : '📞';
    const summary = `${emoji} ${activity.title}${leadDetails ? ` — ${leadDetails.full_name}` : ''}`;

    const descLines = [
      activity.body || '',
      leadDetails ? `Lead: ${leadDetails.full_name}` : '',
      leadDetails?.phone ? `Phone: ${leadDetails.phone}` : '',
      leadDetails?.email ? `Email: ${leadDetails.email}` : '',
      leadDetails?.preferred_locations?.length ? `Location Interest: ${leadDetails.preferred_locations.join(', ')}` : '',
      activity.assigned_to ? `Assigned to: ${activity.assigned_to}` : '',
    ].filter(Boolean).join('\n');

    const calEvent = {
      summary,
      description: descLines,
      start: { dateTime: startTime.toISOString(), timeZone: UAE_TZ },
      end:   { dateTime: endTime.toISOString(),   timeZone: UAE_TZ },
    };

    const existingCalId = activity.meta?.calendar_event_id;
    let calendarEventId = existingCalId;
    let method = 'POST';
    let url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

    if (existingCalId) {
      // PATCH existing event
      method = 'PATCH';
      url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingCalId}`;
    }

    const calRes = await fetch(url, {
      method,
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(calEvent),
    });

    if (!calRes.ok) {
      const errText = await calRes.text();
      // If event not found on update, fall back to create
      if (method === 'PATCH' && calRes.status === 404) {
        const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(calEvent),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          calendarEventId = created.id;
        }
      } else {
        console.error('Calendar API error:', errText);
        return Response.json({ error: 'Calendar API failed', details: errText }, { status: 500 });
      }
    } else {
      const saved = await calRes.json();
      calendarEventId = saved.id;
    }

    // Persist calendar_event_id back into activity meta
    if (calendarEventId && calendarEventId !== existingCalId) {
      await base44.asServiceRole.entities.LeadActivity.update(activityId, {
        meta: { ...(activity.meta || {}), calendar_event_id: calendarEventId },
      }).catch(() => null);
    }

    console.log(`Calendar ${method === 'PATCH' ? 'updated' : 'created'}: ${calendarEventId}`);
    return Response.json({
      status: 'success',
      action: method === 'PATCH' ? 'updated' : 'created',
      calendar_event_id: calendarEventId,
    });

  } catch (error) {
    console.error('syncActivityToCalendar error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});