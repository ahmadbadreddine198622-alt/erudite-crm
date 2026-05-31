// scheduleVirtualViewing — Creates a Google Calendar event with an auto-generated
// Google Meet link and invites both the landlord (seller/lessor) and the
// buyer/tenant as attendees. Optionally logs activity and sends WhatsApp
// confirmation to both parties if phone numbers are supplied.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const UAE_TZ = 'Asia/Dubai';

function formatUAEDate(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: UAE_TZ,
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user   = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      property_title,
      property_address,
      landlord_name,
      landlord_email,
      landlord_phone,
      buyer_name,
      buyer_email,
      buyer_phone,
      viewing_date,    // YYYY-MM-DD
      viewing_time,    // HH:MM (Dubai local)
      duration_minutes = 30,
      lead_id,
      landlord_id,
    } = await req.json();

    if (!viewing_date || !viewing_time) {
      return Response.json({ error: 'viewing_date and viewing_time are required' }, { status: 400 });
    }

    // ── Build start/end in Dubai local time ──────────────────────────────
    // Construct ISO string as local Dubai time, then shift to UTC
    const [y, m, d] = viewing_date.split('-').map(Number);
    const [h, min]  = viewing_time.split(':').map(Number);
    // Create a Date using UTC values that represent Dubai local time,
    // then apply the +04:00 offset
    const dubaiOffset = 4 * 60; // minutes
    const startLocal  = new Date(Date.UTC(y, m - 1, d, h, min));
    const startUTC    = new Date(startLocal.getTime() - dubaiOffset * 60_000);
    const endUTC      = new Date(startUTC.getTime() + (Number(duration_minutes) || 30) * 60_000);

    // ── Build attendees list (omit blanks) ────────────────────────────────
    const attendees = [];
    if (landlord_email) attendees.push({ email: landlord_email, displayName: landlord_name || 'Owner' });
    if (buyer_email)    attendees.push({ email: buyer_email,    displayName: buyer_name    || 'Buyer'  });
    // Always include the agent
    attendees.push({ email: user.email, displayName: user.full_name, responseStatus: 'accepted' });

    // ── Build Calendar event payload with Meet conferencing ──────────────
    const calEvent = {
      summary:     `🏠 Virtual Viewing: ${property_title || 'Property'}`,
      description: [
        `📍 Property: ${property_title || ''}${property_address ? ` — ${property_address}` : ''}`,
        landlord_name  ? `👤 Owner: ${landlord_name}`  : '',
        buyer_name     ? `👥 Buyer: ${buyer_name}`     : '',
        `🕐 Duration: ${duration_minutes} minutes`,
        '',
        'Join via Google Meet link below.',
        '',
        `Scheduled by ${user.full_name} (Erudite Real Estate)`,
      ].filter(Boolean).join('\n'),
      location: property_address || property_title || 'Virtual',
      start: { dateTime: startUTC.toISOString(), timeZone: 'UTC' },
      end:   { dateTime: endUTC.toISOString(),   timeZone: 'UTC' },
      attendees,
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email',  minutes: 60  },
          { method: 'popup',  minutes: 15  },
        ],
      },
    };

    // ── Call Google Calendar API ─────────────────────────────────────────
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

    const gcResp = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(calEvent),
      },
    );

    if (!gcResp.ok) {
      const errText = await gcResp.text();
      return Response.json({ error: 'Google Calendar API error', details: errText }, { status: 500 });
    }

    const created = await gcResp.json();
    const meetLink = created.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri
      || created.conferenceData?.entryPoints?.[0]?.uri
      || null;
    const calendarLink = created.htmlLink || null;

    // ── WhatsApp confirmations (best-effort) ─────────────────────────────
    const dateLabel = formatUAEDate(startUTC.toISOString());

    async function sendWa(phone, name, role) {
      if (!phone) return;
      const msg = [
        `Hi ${name}! 📅 Your virtual property viewing has been confirmed.`,
        '',
        `🏠 *${property_title || 'Property'}*`,
        property_address ? `📍 ${property_address}` : '',
        `📅 ${dateLabel}`,
        `⏱ ${duration_minutes} minutes`,
        meetLink ? `\n🎥 Join Google Meet: ${meetLink}` : '',
        '',
        `A calendar invite has been sent to your email. — Erudite Real Estate`,
      ].filter(l => l !== undefined).join('\n');

      await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
        phone_number: phone,
        message: msg,
      }).catch(() => null);
    }

    await Promise.all([
      sendWa(landlord_phone, landlord_name || 'Owner', 'Owner'),
      sendWa(buyer_phone,    buyer_name    || 'Buyer',  'Buyer'),
    ]);

    // ── Log activity (best-effort) ────────────────────────────────────────
    const activityBase = {
      type:        'virtual_viewing',
      title:       `Virtual Viewing Scheduled: ${property_title || ''}`,
      description: `Meet: ${meetLink || 'N/A'} | ${dateLabel}`,
      agent_email: user.email,
      agent_name:  user.full_name,
      outcome:     'viewing_scheduled',
      metadata: {
        calendar_event_id: created.id,
        meet_link:         meetLink,
        calendar_link:     calendarLink,
        landlord_email,
        buyer_email,
        property_title,
        property_address,
      },
    };

    if (lead_id)     await base44.asServiceRole.entities.Activity.create({ ...activityBase, lead_id     }).catch(() => null);
    if (landlord_id) await base44.asServiceRole.entities.Activity.create({ ...activityBase, landlord_id }).catch(() => null);

    return Response.json({
      success:      true,
      event_id:     created.id,
      meet_link:    meetLink,
      calendar_link: calendarLink,
      start_time:   startUTC.toISOString(),
    });
  } catch (err) {
    console.error('scheduleVirtualViewing:', err);
    return Response.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
});