import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { follow_up_id, action } = await req.json();
    
    if (!follow_up_id) {
      return Response.json({ error: 'follow_up_id required' }, { status: 400 });
    }

    // Fetch the follow-up
    const followUp = await base44.entities.FollowUp.get(follow_up_id);
    if (!followUp) {
      return Response.json({ error: 'Follow-up not found' }, { status: 404 });
    }

    // Get Google Calendar connection
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    
    // Get landlord name for event title
    const landlord = await base44.entities.Landlord.get(followUp.data.landlord_id);
    const landlordName = landlord?.data?.full_name_en || landlord?.data?.full_name || 'Unknown';
    
    const eventType = followUp.data.type;
    const eventTitle = `${eventType.charAt(0).toUpperCase() + eventType.slice(1)}: ${landlordName}`;
    
    const calendarId = 'primary';
    
    if (action === 'create' || action === 'update') {
      // Create or update Google Calendar event
      const event = {
        summary: eventTitle,
        description: `Follow-up type: ${eventType}\nStatus: ${followUp.data.status}\nNotes: ${followUp.data.notes || 'N/A'}`,
        start: {
          dateTime: followUp.data.scheduled_at,
          timeZone: 'UTC',
        },
        end: {
          dateTime: new Date(new Date(followUp.data.scheduled_at).getTime() + 30 * 60 * 1000).toISOString(),
          timeZone: 'UTC',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 30 },
          ],
        },
      };

      let eventId = followUp.data.google_event_id;
      
      if (eventId && action === 'update') {
        // Update existing event
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });
      } else {
        // Create new event
        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });
        
        const eventData = await response.json();
        eventId = eventData.id;
        
        // Save event ID to follow-up
        await base44.entities.FollowUp.update(follow_up_id, { google_event_id: eventId });
      }
    } else if (action === 'delete') {
      // Delete Google Calendar event
      if (followUp.data.google_event_id) {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${followUp.data.google_event_id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        
        // Clear event ID from follow-up
        await base44.entities.FollowUp.update(follow_up_id, { google_event_id: null });
      }
    }

    return Response.json({ success: true, event_id: followUp.data.google_event_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});