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

    // Check if event already exists to avoid duplicates
    if (lead.calendar_event_id) {
      console.log('Event already created for this lead:', lead.calendar_event_id);
      return Response.json({ status: 'skipped', reason: 'event_already_exists' });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

    // Parse date and time
    const [year, month, day] = lead.preferred_date.split('-');
    const [hours, minutes] = lead.preferred_time.split(':');
    const startTime = new Date(year, parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
    const endTime = new Date(startTime.getTime() + 30 * 60000); // 30 min duration

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
        dateTime: startTime.toISOString(),
        timeZone: 'UTC'
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'UTC'
      }
    };

    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event_data)
    });

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: 'Failed to create calendar event', details: error }, { status: 500 });
    }

    const createdEvent = await response.json();

    // Store calendar event ID in lead to avoid duplicates
    await base44.entities.Leads.update(leadId, {
      calendar_event_id: createdEvent.id
    });

    return Response.json({ 
      status: 'success', 
      event_id: createdEvent.id,
      message: 'Calendar event created and synced'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});