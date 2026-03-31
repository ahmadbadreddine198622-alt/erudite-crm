import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lead_id, lead_name, property_title, viewing_date, viewing_time, duration_minutes } = await req.json();

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    
    // Parse viewing date and time
    const [year, month, day] = viewing_date.split('-');
    const [hours, minutes] = viewing_time.split(':');
    const startTime = new Date(year, parseInt(month) - 1, day, hours, minutes);
    const endTime = new Date(startTime.getTime() + (duration_minutes || 30) * 60000);

    const event = {
      summary: `Property Viewing: ${property_title}`,
      description: `Lead: ${lead_name}\nLead ID: ${lead_id}`,
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
      body: JSON.stringify(event)
    });

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: 'Failed to create calendar event', details: error }, { status: 500 });
    }

    const createdEvent = await response.json();

    // Create an activity record for the scheduled viewing
    await base44.entities.Activity.create({
      lead_id,
      type: 'viewing',
      title: `Viewing Scheduled: ${property_title}`,
      description: `Viewing scheduled for ${viewing_date} at ${viewing_time}`,
      agent_email: user.email,
      agent_name: user.full_name,
      outcome: 'viewing_scheduled',
      metadata: {
        calendar_event_id: createdEvent.id,
        property_title
      }
    });

    return Response.json({ 
      success: true, 
      event_id: createdEvent.id,
      message: 'Viewing scheduled on Google Calendar'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});