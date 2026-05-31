import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Google Calendar access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Get existing sync state
    const existing = await base44.asServiceRole.entities.SyncState.list();
    const syncRecord = existing.length > 0 ? existing[0] : null;

    // Build sync URL with syncToken or timeMin
    let url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=100';
    if (syncRecord?.sync_token) {
      url += `&syncToken=${syncRecord.sync_token}`;
    } else {
      // First sync - get events from last 7 days
      url += '&timeMin=' + new Date(Date.now() - 7*24*60*60*1000).toISOString();
    }

    let res = await fetch(url, { headers: authHeader });
    
    // Handle expired syncToken (410 Gone)
    if (res.status === 410) {
      url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=100'
        + '&timeMin=' + new Date(Date.now() - 7*24*60*60*1000).toISOString();
      res = await fetch(url, { headers: authHeader });
    }

    if (!res.ok) {
      return Response.json({ 
        status: 'api_error', 
        error: `Google API error: ${res.status}` 
      }, { status: 500 });
    }

    // Drain all pages to get nextSyncToken
    const allItems = [];
    let pageData = await res.json();
    let newSyncToken = null;

    while (true) {
      allItems.push(...(pageData.items || []));
      if (pageData.nextSyncToken) newSyncToken = pageData.nextSyncToken;
      if (!pageData.nextPageToken) break;
      
      const nextRes = await fetch(
        url + `&pageToken=${pageData.nextPageToken}`,
        { headers: authHeader }
      );
      if (!nextRes.ok) break;
      pageData = await nextRes.json();
    }

    // Process calendar events and create reminders
    let createdCount = 0;
    let updatedCount = 0;

    for (const event of allItems) {
      // Skip cancelled events
      if (event.status === 'cancelled') continue;

      // Skip events without end date (all-day events handled differently)
      const endDate = event.end?.dateTime || event.end?.date;
      if (!endDate) continue;

      const dueDate = new Date(endDate);
      
      // Check if reminder already exists (by Google event ID)
      const existingReminders = await base44.asServiceRole.entities.Reminder.filter({
        google_event_id: event.id
      });

      if (existingReminders.length > 0) {
        // Update existing reminder
        const reminder = existingReminders[0];
        await base44.asServiceRole.entities.Reminder.update(reminder.id, {
          title: event.summary,
          notes: event.description || '',
          due_date: dueDate.toISOString(),
          priority: 'medium',
          status: 'pending',
        });
        updatedCount++;
      } else {
        // Create new reminder
        await base44.asServiceRole.entities.Reminder.create({
          title: event.summary,
          notes: event.description || '',
          due_date: dueDate.toISOString(),
          priority: 'medium',
          status: 'pending',
          type: 'calendar_event',
          source: 'google_calendar',
          google_event_id: event.id,
          created_by_email: user.email,
        });
        createdCount++;
      }
    }

    // Update sync state
    if (newSyncToken) {
      if (syncRecord) {
        await base44.asServiceRole.entities.SyncState.update(syncRecord.id, {
          sync_token: newSyncToken,
          last_sync_at: new Date().toISOString(),
          events_synced_count: (syncRecord.events_synced_count || 0) + createdCount,
        });
      } else {
        await base44.asServiceRole.entities.SyncState.create({
          sync_token: newSyncToken,
          last_sync_at: new Date().toISOString(),
          events_synced_count: createdCount,
        });
      }
    }

    return Response.json({
      status: 'success',
      events_synced: allItems.length,
      reminders_created: createdCount,
      reminders_updated: updatedCount,
      sync_token: newSyncToken ? 'updated' : 'unchanged',
    });

  } catch (error) {
    return Response.json({ 
      status: 'error', 
      error: error.message 
    }, { status: 500 });
  }
});