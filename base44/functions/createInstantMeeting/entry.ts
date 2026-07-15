import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// createInstantMeeting — creates an instant Google Meet right now on the
// connected Google Calendar, invites the meeting creator (current agent) and
// the landlord, and sends an in-app Notification to both parties.
//
// Payload: { landlord_id, email }  (email = the specific address to invite)
// Returns: { ok, meet_link, event_id, calendar_link }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const landlordId = body.landlord_id;
    const inviteEmail = String(body.email || '').trim();

    if (!inviteEmail) return Response.json({ error: 'An email is required to invite the landlord' }, { status: 400 });

    // Resolve landlord context for a meaningful event title + their email.
    let landlordName = 'Landlord';
    let landlordEmail = inviteEmail;
    if (landlordId) {
      try {
        const ll = await base44.asServiceRole.entities.Landlord.get(landlordId);
        landlordName = ll?.full_name_en || ll?.full_name || landlordName;
        if (!inviteEmail && ll?.email) landlordEmail = ll.email;
      } catch (_) { /* best-effort */ }
    }

    const agentName = user.full_name || user.email?.split('@')[0] || 'Agent';
    const agentEmail = user.email;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    if (!accessToken) return Response.json({ error: 'Google Calendar is not connected' }, { status: 503 });

    // Build a naive Asia/Dubai wall-clock window starting now, 30 min long
    // (mirrors the drift-free approach used by syncLandlordAppointmentToCalendar).
    const pad = (n) => String(n).padStart(2, '0');
    const toDubaiWall = (ms) => {
      const d = new Date(ms + 4 * 60 * 60000);
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
    };
    const startMs = Date.now();
    const startWall = toDubaiWall(startMs);
    const endWall = toDubaiWall(startMs + 30 * 60000);

    const attendees = [{ email: landlordEmail }];
    if (agentEmail && agentEmail.toLowerCase() !== landlordEmail.toLowerCase()) {
      attendees.push({ email: agentEmail });
    }

    const requestId = `instant-${landlordId || 'x'}-${Date.now()}`;
    const eventBody = {
      summary: `Instant Meeting — ${landlordName} × ${agentName}`,
      description: `Instant meeting created from the Erudite CRM landlord card.\nLandlord: ${landlordName}\nAgent: ${agentName}${agentEmail ? ` (${agentEmail})` : ''}\nInvited: ${landlordEmail}`,
      start: { dateTime: startWall, timeZone: 'Asia/Dubai' },
      end: { dateTime: endWall, timeZone: 'Asia/Dubai' },
      attendees,
      conferenceData: {
        createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } },
      },
    };

    const baseUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    const res = await fetch(`${baseUrl}?conferenceDataVersion=1&sendUpdates=all`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: `Failed to create calendar event: ${err}` }, { status: 502 });
    }

    const created = await res.json();
    const meetLink = created.hangoutLink || created.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video')?.uri || null;
    const eventId = created.id || null;

    // In-app Notification to the creator (agent).
    try {
      await base44.asServiceRole.entities.Notification.create({
        recipient_email: agentEmail,
        type: 'meeting',
        title: `Instant Meeting created — ${landlordName}`,
        body: `A Google Meet was just created.${meetLink ? ` Join: ${meetLink}` : ''}`,
        link: meetLink || undefined,
      });
    } catch (_) { /* best-effort */ }

    // In-app Notification to the landlord too (they may be a registered app user in some setups).
    // Google Calendar already emails both attendees via sendUpdates=all; this is a best-effort
    // in-app echo for any registered landlord account sharing that email.
    try {
      await base44.asServiceRole.entities.Notification.create({
        recipient_email: landlordEmail,
        type: 'meeting',
        title: `Instant Meeting invite — ${agentName}`,
        body: `${agentName} just created an instant meeting.${meetLink ? ` Join: ${meetLink}` : ''}`,
        link: meetLink || undefined,
      });
    } catch (_) { /* best-effort — landlord is usually external; Google invite email is the real channel */ }

    return Response.json({
      ok: true,
      meet_link: meetLink,
      event_id: eventId,
      calendar_link: created.htmlLink || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});