// getUserCalendarEvents — fetches Google Calendar events + CRM appointments,
// viewings, and meetings, merged into a single timeline.
//
// Returns organizer (booker) + guest emails for each event.
//
// Input:
//   time_min            (ISO string, optional)
//   time_max            (ISO string, optional)
//   filter_agent_email  (string, optional) — admin-only

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const isAdmin = user.role === 'admin';
    const body = await req.json().catch(() => ({}));
    const agentEmailFilter = isAdmin ? (body.filter_agent_email || null) : user.email;

    const now = new Date();
    const timeMin = body.time_min ? new Date(body.time_min).toISOString() : now.toISOString();
    const daysAhead = Number(body.days_ahead) > 0 ? Number(body.days_ahead) : 30;
    const timeMax = body.time_max
      ? new Date(body.time_max).toISOString()
      : new Date(now.getTime() + daysAhead * 86400000).toISOString();

    // ── Build agent name lookup ────────────────────────────────────
    const agentNames = {};
    try {
      const allUsers = await base44.asServiceRole.entities.User.list();
      for (const u of (allUsers || [])) {
        if (u.email) agentNames[u.email.toLowerCase()] = u.full_name || u.email;
      }
    } catch (_) { /* best-effort */ }

    function resolveAgentName(email) {
      if (!email) return null;
      return agentNames[email.toLowerCase()] || email;
    }

    // ── 1. Fetch Google Calendar events (shared connector) ────────
    let gcalEvents = [];
    let googleConnected = false;
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=250`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (resp.ok) {
        googleConnected = true;
        const data = await resp.json();
        gcalEvents = (data.items || []).map((e) => {
          const organizerEmail = e.organizer?.email || null;
          const attendeeEmails = (e.attendees || []).map((a) => a.email).filter((em) => em !== organizerEmail);
          return {
            id: e.id,
            title: e.summary || '(No title)',
            start: e.start?.dateTime || e.start?.date || null,
            end: e.end?.dateTime || e.end?.date || null,
            location: e.location || '',
            description: e.description || '',
            type: 'google',
            source: 'google',
            agent_email: organizerEmail || user.email,
            agent_name: resolveAgentName(organizerEmail) || resolveAgentName(user.email),
            organizer_email: organizerEmail,
            organizer_name: resolveAgentName(organizerEmail),
            guest_emails: attendeeEmails,
          };
        });
      }
    } catch (_) { /* calendar is best-effort */ }

    // ── Helper: enrich with landlord name + email ──────────────────
    async function enrichLandlord(landlordId) {
      if (!landlordId) return { name: null, email: null };
      try {
        const ll = await base44.entities.Landlord.get(landlordId);
        return {
          name: ll?.full_name_en || ll?.full_name_ar || ll?.name || null,
          email: ll?.email || null,
        };
      } catch (_) { return { name: null, email: null }; }
    }

    const apptQuery = agentEmailFilter ? { agent_email: agentEmailFilter } : {};

    // ── 2. Fetch LandlordAppointment records ───────────────────────
    let crmAppts = [];
    try {
      const appts = await base44.entities.LandlordAppointment.filter(apptQuery, 'datetime', 200);
      for (const a of (appts || [])) {
        const ll = await enrichLandlord(a.landlord_id);
        const guestEmails = [];
        if (ll.email) guestEmails.push(ll.email);
        crmAppts.push({
          id: a.id,
          title: a.notes ? a.notes.slice(0, 60) : `${a.type || 'meeting'} — ${ll.name || 'Landlord'}`,
          start: a.datetime,
          end: a.datetime ? new Date(new Date(a.datetime).getTime() + (a.duration_minutes || 30) * 60000).toISOString() : null,
          location: a.location || '',
          description: a.notes || '',
          status: a.status || 'scheduled',
          type: a.type || 'meeting',
          landlord_id: a.landlord_id,
          landlord_name: ll.name,
          source: 'crm',
          google_event_id: a.google_event_id || null,
          agent_email: a.agent_email || null,
          agent_name: resolveAgentName(a.agent_email),
          organizer_email: a.agent_email || null,
          organizer_name: resolveAgentName(a.agent_email),
          guest_emails: guestEmails,
        });
      }
    } catch (_) { /* best-effort */ }

    // ── 3. Fetch Viewing records ───────────────────────────────────
    let crmViewings = [];
    try {
      const viewings = await base44.entities.Viewing.filter(apptQuery, 'scheduled_at', 200);
      for (const v of (viewings || [])) {
        const ll = await enrichLandlord(v.landlord_id);
        const guestEmails = [];
        if (ll.email) guestEmails.push(ll.email);
        crmViewings.push({
          id: v.id,
          title: v.title || `Viewing — ${ll.name || 'Property'}`,
          start: v.scheduled_at,
          end: v.scheduled_at ? new Date(new Date(v.scheduled_at).getTime() + (v.duration_minutes || 30) * 60000).toISOString() : null,
          location: v.location || '',
          description: v.notes || '',
          status: v.status || 'pending',
          type: 'viewing',
          landlord_id: v.landlord_id,
          landlord_name: ll.name,
          source: 'viewing',
          google_event_id: v.google_event_id || null,
          agent_email: v.agent_email || null,
          agent_name: resolveAgentName(v.agent_email),
          organizer_email: v.agent_email || null,
          organizer_name: resolveAgentName(v.agent_email),
          guest_emails: guestEmails,
        });
      }
    } catch (_) { /* best-effort */ }

    // ── 4. Fetch Meeting records ───────────────────────────────────
    let crmMeetings = [];
    try {
      const meetings = await base44.entities.Meeting.filter(apptQuery, 'scheduled_at', 200);
      for (const m of (meetings || [])) {
        const ll = await enrichLandlord(m.landlord_id);
        const guestEmails = [];
        if (ll.email) guestEmails.push(ll.email);
        crmMeetings.push({
          id: m.id,
          title: m.title || `Meeting — ${ll.name || 'Client'}`,
          start: m.scheduled_at,
          end: m.scheduled_at ? new Date(new Date(m.scheduled_at).getTime() + (m.duration_minutes || 30) * 60000).toISOString() : null,
          location: m.location || '',
          description: m.notes || '',
          status: m.status || 'pending',
          type: 'meeting',
          landlord_id: m.landlord_id,
          landlord_name: ll.name,
          source: 'meeting',
          google_event_id: m.google_event_id || null,
          agent_email: m.agent_email || null,
          agent_name: resolveAgentName(m.agent_email),
          organizer_email: m.agent_email || null,
          organizer_name: resolveAgentName(m.agent_email),
          guest_emails: guestEmails,
        });
      }
    } catch (_) { /* best-effort */ }

    // ── 5. Filter Google events by selected agent, then merge ─────
    const filteredGcal = agentEmailFilter
      ? gcalEvents.filter((e) => {
          const em = agentEmailFilter.toLowerCase();
          return (e.organizer_email || '').toLowerCase() === em ||
                 (e.guest_emails || []).some((g) => g.toLowerCase() === em);
        })
      : gcalEvents;

    const gcalIds = new Set(filteredGcal.map((e) => e.id));
    const crmAll = [...crmAppts, ...crmViewings, ...crmMeetings];
    const merged = [
      ...filteredGcal,
      ...crmAll.filter((a) => !a.google_event_id || !gcalIds.has(a.google_event_id)),
    ].sort((a, b) => new Date(a.start || 0).getTime() - new Date(b.start || 0).getTime());

    return Response.json({
      ok: true,
      events: merged,
      google_count: filteredGcal.length,
      crm_count: crmAll.length,
      is_admin: isAdmin,
      google_connected: googleConnected,
      filtered_agent_email: agentEmailFilter,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});