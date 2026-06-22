import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const UAE_TZ = 'Asia/Dubai';

function formatUAEDate(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: UAE_TZ, weekday: 'short', day: '2-digit',
    month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      lead_id, lead_name, lead_phone,
      property_title, property_address, virtual_tour_link,
      viewing_date, viewing_time, duration_minutes,
      agent_email: agentEmail,
    } = await req.json();

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    
    // Parse viewing date/time as Asia/Dubai wall-clock.
    // Dubai is UTC+4 year-round (the UAE observes no DST), so the intended instant is
    // Date.UTC(...) shifted back 4h. Using new Date(y, m, d, ...) instead would build the
    // time in the server's local zone (UTC on Base44), booking every viewing 4h late.
    const [year, month, day] = viewing_date.split('-').map(Number);
    const [hours, minutes] = viewing_time.split(':').map(Number);
    const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;
    const startTime = new Date(Date.UTC(year, month - 1, day, hours, minutes) - DUBAI_OFFSET_MS);
    const endTime = new Date(startTime.getTime() + (duration_minutes || 30) * 60000);

    const location = property_address || property_title;
    const tourLine = virtual_tour_link ? `\n🎥 Virtual Tour: ${virtual_tour_link}` : '';

    const event = {
      summary: `🏠 Viewing: ${property_title} — ${lead_name}`,
      description: `Lead: ${lead_name}\nLead ID: ${lead_id}\nPhone: ${lead_phone || 'N/A'}\nLocation: ${location}${tourLine}`,
      location,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: UAE_TZ
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: UAE_TZ
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
    const startIso = startTime.toISOString();

    // Update lead: stage → viewing, save appointment & calendar event id
    await base44.entities.Lead.update(lead_id, {
      stage: 'viewing',
      next_appointment_at: startIso,
      last_touch_at: new Date().toISOString(),
    }).catch(() => null);

    // WhatsApp confirmation to the lead
    if (lead_phone) {
      const dateFormatted = formatUAEDate(startIso);
      let waMsg = `Hi ${lead_name}! ✅ Your property viewing has been confirmed.\n\n🏠 *${property_title}*\n📍 ${location}\n📅 ${dateFormatted}`;
      if (virtual_tour_link) waMsg += `\n\n🎥 Virtual Tour: ${virtual_tour_link}`;
      waMsg += `\n\nSee you then! Feel free to reply with any questions. 😊`;

      await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
        phone_number: lead_phone,
        message: waMsg,
      }).catch(() => null);
    }

    // Log activity record
    await base44.entities.Activity.create({
      lead_id,
      type: 'viewing',
      title: `Viewing Scheduled: ${property_title}`,
      description: `Viewing on ${viewing_date} at ${viewing_time} — ${location}`,
      agent_email: user?.email || agentEmail,
      agent_name: user?.full_name,
      outcome: 'viewing_scheduled',
      metadata: {
        calendar_event_id: createdEvent.id,
        property_title,
        property_address: location,
        virtual_tour_link: virtual_tour_link || null,
        wa_confirmation_sent: !!lead_phone,
      }
    }).catch(() => null);

    return Response.json({
      success: true,
      event_id: createdEvent.id,
      calendar_link: createdEvent.htmlLink || null,
      wa_confirmation_sent: !!lead_phone,
      message: 'Viewing scheduled on Google Calendar and WhatsApp confirmation sent',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});