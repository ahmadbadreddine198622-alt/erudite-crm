import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { month } = await req.json();
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

    const [year, monthNum] = month.split('-');
    const startDate = new Date(year, parseInt(monthNum) - 1, 1).toISOString();
    const endDate = new Date(year, parseInt(monthNum), 0, 23, 59, 59).toISOString();

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${startDate}&timeMax=${endDate}&maxResults=100&orderBy=startTime&singleEvents=true`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to fetch calendar events' }, { status: 500 });
    }

    const data = await response.json();
    const events = (data.items || []).filter(event => 
      event.summary && event.summary.includes('Property Viewing')
    );

    return Response.json({ events });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});