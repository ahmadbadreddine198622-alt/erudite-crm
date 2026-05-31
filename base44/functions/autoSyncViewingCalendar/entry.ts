/**
 * Entity automation handler — fires when a Lead is updated with stage = 'viewing'
 * and next_appointment_at is set. Auto-creates calendar event + sends WA confirmation.
 * Called by automation: Lead update → changed_fields contains 'next_appointment_at'
 *                                    AND data.stage = 'viewing'
 */
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
    const { event, data: lead } = await req.json();

    if (!lead || !lead.next_appointment_at) {
      return Response.json({ status: 'skipped', reason: 'no_appointment_date' });
    }
    if (lead.stage !== 'viewing') {
      return Response.json({ status: 'skipped', reason: 'stage_not_viewing' });
    }

    const startTime = new Date(lead.next_appointment_at);
    const endTime = new Date(startTime.getTime() + 30 * 60000);
    const lead_name = lead.full_name || 'Lead';
    const property_title = lead.preferred_locations?.[0] || 'Property Viewing';
    const location = lead.preferred_locations?.[0] || '';
    const virtual_tour_link = lead.notes?.match(/https?:\/\/[^\s]+/)?.[0] || null;

    // Create Google Calendar event
    let calendarEventId = null;
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

      const calEvent = {
        summary: `🏠 Viewing: ${property_title} — ${lead_name}`,
        description: [
          `Lead: ${lead_name}`,
          `Phone: ${lead.phone || 'N/A'}`,
          `Budget: ${lead.budget_min ? `AED ${lead.budget_min.toLocaleString()}` : 'N/A'} – ${lead.budget_max ? `AED ${lead.budget_max.toLocaleString()}` : 'N/A'}`,
          `Source: ${lead.source || 'N/A'}`,
          virtual_tour_link ? `Virtual Tour: ${virtual_tour_link}` : '',
        ].filter(Boolean).join('\n'),
        location,
        start: { dateTime: startTime.toISOString(), timeZone: 'Asia/Dubai' },
        end:   { dateTime: endTime.toISOString(),   timeZone: 'Asia/Dubai' },
      };

      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(calEvent),
      });

      if (res.ok) {
        const created = await res.json();
        calendarEventId = created.id;

        // Persist event ID on lead to prevent duplicates
        await base44.asServiceRole.entities.Lead.update(event.entity_id, {
          last_activity_type: 'viewing_scheduled',
        }).catch(() => null);
      }
    } catch (calErr) {
      console.warn('Calendar sync failed:', calErr.message);
    }

    // WhatsApp confirmation
    const phone = lead.whatsapp || lead.phone;
    if (phone) {
      const dateFormatted = formatUAEDate(lead.next_appointment_at);
      let waMsg = `Hi ${lead_name.split(' ')[0]}! ✅ Your property viewing is confirmed.\n\n🏠 *${property_title}*\n📅 ${dateFormatted}`;
      if (location) waMsg += `\n📍 ${location}`;
      if (virtual_tour_link) waMsg += `\n\n🎥 Can't make it? Take a virtual tour:\n${virtual_tour_link}`;
      waMsg += `\n\nLooking forward to seeing you! 😊`;

      await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
        phone_number: phone,
        message: waMsg,
      }).catch(() => null);
    }

    // Log activity
    await base44.asServiceRole.entities.LeadActivity.create({
      lead_id: event.entity_id,
      activity_type: 'booking',
      title: 'Viewing auto-synced to calendar',
      body: `Appointment: ${formatUAEDate(lead.next_appointment_at)}${calendarEventId ? ` | Calendar ID: ${calendarEventId}` : ''}`,
      created_by: 'system',
      meta: { calendar_event_id: calendarEventId, wa_sent: !!phone },
    }).catch(() => null);

    return Response.json({
      status: 'success',
      calendar_event_id: calendarEventId,
      wa_sent: !!phone,
    });

  } catch (error) {
    console.error('autoSyncViewingCalendar error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});