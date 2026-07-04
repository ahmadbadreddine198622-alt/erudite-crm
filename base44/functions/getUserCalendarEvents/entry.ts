// getUserCalendarEvents — fetches upcoming Google Calendar events for the
// Appointments page. Also merges LandlordAppointment records so the user
// sees both Google Calendar events and CRM-tracked appointments.
//
// Input:
//   days_ahead  (number, default 30) — how many days forward to fetch

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const daysAhead = Number(body.days_ahead) > 0 ? Number(body.days_ahead) : 30;

    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + daysAhead * 86400000).toISOString();

    // ── 1. Fetch Google Calendar events ────────────────────────────────
    let gcalEvents = [];
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=100`;
      const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
      if (resp.ok) {
        const data = await resp.json();
        gcalEvents = (data.items || []).map((e) => ({
          id: e.id,
          title: e.summary || '(No title)',
          start: e.start?.dateTime || e.start?.date || null,
          end: e.end?.dateTime || e.end?.date || null,
          location: e.location || '',
          description: e.description || '',
          attendees: (e.attendees || []).map((a) => a.email),
          source: 'google',
        }));
      }
    } catch (_) { /* calendar is best-effort */ }

    // ── 2. Fetch LandlordAppointment records ───────────────────────────
    let crmAppts = [];
    try {
      const appts = await base44.entities.LandlordAppointment.filter(
        { agent_email: user.email },
        'datetime',
        100
      );
      // Enrich with landlord name
      for (const a of (appts || [])) {
        let landlordName = null;
        if (a.landlord_id) {
          try {
            const ll = await base44.entities.Landlord.get(a.landlord_id);
            landlordName = ll?.full_name_en || ll?.full_name_ar || null;
          } catch (_) { /* best-effort */ }
        }
        crmAppts.push({
          id: a.id,
          title: `${a.type || 'meeting'} — ${landlordName || 'Landlord'}`,
          start: a.datetime,
          end: a.datetime ? new Date(new Date(a.datetime).getTime() + (a.duration_minutes || 30) * 60000).toISOString() : null,
          location: a.location || '',
          description: a.notes || '',
          status: a.status || 'scheduled',
          landlord_id: a.landlord_id,
          landlord_name: landlordName,
          source: 'crm',
        });
      }
    } catch (_) { /* best-effort */ }

    // ── 3. Merge & dedupe by google_event_id ───────────────────────────
    const gcalIds = new Set(gcalEvents.map((e) => e.id));
    const merged = [
      ...gcalEvents,
      ...crmAppts.filter((a) => !gcalIds.has(a.google_event_id)),
    ].sort((a, b) => new Date(a.start || 0).getTime() - new Date(b.start || 0).getTime());

    return Response.json({
      ok: true,
      events: merged,
      google_count: gcalEvents.length,
      crm_count: crmAppts.length,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});