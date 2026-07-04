// getUserCalendarEvents — fetches Google Calendar events + CRM appointments,
// viewings, and meetings, merged into a single timeline.
//
// Input:
//   time_min   (ISO string, optional) — range start; defaults to now
//   time_max   (ISO string, optional) — range end; defaults to now + 30 days
//   days_ahead (number, optional)     — legacy: if no time_max, used as range

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const now = new Date();
    const timeMin = body.time_min ? new Date(body.time_min).toISOString() : now.toISOString();
    const daysAhead = Number(body.days_ahead) > 0 ? Number(body.days_ahead) : 30;
    const timeMax = body.time_max
      ? new Date(body.time_max).toISOString()
      : new Date(now.getTime() + daysAhead * 86400000).toISOString();

    // ── 1. Fetch Google Calendar events ────────────────────────────
    let gcalEvents = [];
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=250`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
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
          type: 'google',
          source: 'google',
        }));
      }
    } catch (_) { /* calendar is best-effort */ }

    // ── Helper: enrich with landlord name ──────────────────────────
    async function enrichLandlord(landlordId) {
      if (!landlordId) return null;
      try {
        const ll = await base44.entities.Landlord.get(landlordId);
        return ll?.full_name_en || ll?.full_name_ar || ll?.name || null;
      } catch (_) { return null; }
    }

    // ── 2. Fetch LandlordAppointment records ───────────────────────
    let crmAppts = [];
    try {
      const appts = await base44.entities.LandlordAppointment.filter(
        { agent_email: user.email }, 'datetime', 200
      );
      for (const a of (appts || [])) {
        const landlordName = await enrichLandlord(a.landlord_id);
        crmAppts.push({
          id: a.id,
          title: a.notes ? a.notes.slice(0, 60) : `${a.type || 'meeting'} — ${landlordName || 'Landlord'}`,
          start: a.datetime,
          end: a.datetime ? new Date(new Date(a.datetime).getTime() + (a.duration_minutes || 30) * 60000).toISOString() : null,
          location: a.location || '',
          description: a.notes || '',
          status: a.status || 'scheduled',
          type: a.type || 'meeting',
          landlord_id: a.landlord_id,
          landlord_name: landlordName,
          source: 'crm',
          google_event_id: a.google_event_id || null,
        });
      }
    } catch (_) { /* best-effort */ }

    // ── 3. Fetch Viewing records ───────────────────────────────────
    let crmViewings = [];
    try {
      const viewings = await base44.entities.Viewing.filter(
        { agent_email: user.email }, 'scheduled_at', 200
      );
      for (const v of (viewings || [])) {
        const landlordName = await enrichLandlord(v.landlord_id);
        crmViewings.push({
          id: v.id,
          title: v.title || `Viewing — ${landlordName || 'Property'}`,
          start: v.scheduled_at,
          end: v.scheduled_at ? new Date(new Date(v.scheduled_at).getTime() + (v.duration_minutes || 30) * 60000).toISOString() : null,
          location: v.location || '',
          description: v.notes || '',
          status: v.status || 'pending',
          type: 'viewing',
          landlord_id: v.landlord_id,
          landlord_name: landlordName,
          source: 'viewing',
          google_event_id: v.google_event_id || null,
        });
      }
    } catch (_) { /* best-effort */ }

    // ── 4. Fetch Meeting records ───────────────────────────────────
    let crmMeetings = [];
    try {
      const meetings = await base44.entities.Meeting.filter(
        { agent_email: user.email }, 'scheduled_at', 200
      );
      for (const m of (meetings || [])) {
        const landlordName = await enrichLandlord(m.landlord_id);
        crmMeetings.push({
          id: m.id,
          title: m.title || `Meeting — ${landlordName || 'Client'}`,
          start: m.scheduled_at,
          end: m.scheduled_at ? new Date(new Date(m.scheduled_at).getTime() + (m.duration_minutes || 30) * 60000).toISOString() : null,
          location: m.location || '',
          description: m.notes || '',
          status: m.status || 'pending',
          type: 'meeting',
          landlord_id: m.landlord_id,
          landlord_name: landlordName,
          source: 'meeting',
          google_event_id: m.google_event_id || null,
        });
      }
    } catch (_) { /* best-effort */ }

    // ── 5. Merge & dedupe by google_event_id ───────────────────────
    const gcalIds = new Set(gcalEvents.map((e) => e.id));
    const crmAll = [...crmAppts, ...crmViewings, ...crmMeetings];
    const merged = [
      ...gcalEvents,
      ...crmAll.filter((a) => !a.google_event_id || !gcalIds.has(a.google_event_id)),
    ].sort((a, b) => new Date(a.start || 0).getTime() - new Date(b.start || 0).getTime());

    return Response.json({
      ok: true,
      events: merged,
      google_count: gcalEvents.length,
      crm_count: crmAll.length,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});