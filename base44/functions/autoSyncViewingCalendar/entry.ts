/**
 * Entity automation handler — fires when a Lead is updated with stage = 'viewing'
 * and next_appointment_at is set. Auto-creates or updates calendar event + sends WA confirmation.
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
    const endTime = new Date(startTime.getTime() + 60 * 60000); // 1 hour
    const lead_name = lead.full_name || 'Lead';
    const property_title = lead.preferred_locations?.[0] || 'Property Viewing';
    const location = lead.preferred_locations?.[0] || '';
    const virtual_tour_link = lead.notes?.match(/https?:\/\/[^\s]+/)?.[0] || null;

    // Create or update Google Calendar event
    let calendarEventId = null;
    let calendarAction = 'created';
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

      // Look for existing calendar event ID from a previous viewing activity
      const existingActivities = await base44.asServiceRole.entities.LeadActivity.filter(
        { lead_id: event.entity_id, activity_type: 'booking' }, '-created_date', 10
      ).catch(() => []);
      const existingCalId = existingActivities.find(a => a.meta?.calendar_event_id)?.meta?.calendar_event_id || null;

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
        start: { dateTime: startTime.toISOString(), timeZone: UAE_TZ },
        end:   { dateTime: endTime.toISOString(),   timeZone: UAE_TZ },
      };

      const isUpdate = !!existingCalId;
      const calUrl = isUpdate
        ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingCalId}`
        : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

      const res = await fetch(calUrl, {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(calEvent),
      });

      if (res.ok) {
        const saved = await res.json();
        calendarEventId = saved.id;
        calendarAction = isUpdate ? 'updated' : 'created';
      } else if (isUpdate && res.status === 404) {
        // Event deleted externally — recreate
        const retry = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(calEvent),
        });
        if (retry.ok) {
          const c = await retry.json();
          calendarEventId = c.id;
          calendarAction = 'recreated';
        }
      }
    } catch (calErr) {
      console.warn('Calendar sync failed:', calErr.message);
    }

    // WhatsApp confirmation (only on first creation, not reschedule updates)
    const phone = lead.whatsapp || lead.phone;
    if (phone && calendarAction === 'created') {
      const dateFormatted = formatUAEDate(lead.next_appointment_at);
      let waMsg = `Hi ${lead_name.split(' ')[0]}! ✅ Your property viewing is confirmed.\n\n🏠 *${property_title}*\n📅 ${dateFormatted}`;
      if (location) waMsg += `\n📍 ${location}`;
      if (virtual_tour_link) waMsg += `\n\n🎥 Can't make it? Take a virtual tour:\n${virtual_tour_link}`;
      waMsg += `\n\nLooking forward to seeing you! 😊`;

      await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
        phone_number: phone,
        message: waMsg,
      }).catch(() => null);
    } else if (phone && calendarAction === 'updated') {
      const dateFormatted = formatUAEDate(lead.next_appointment_at);
      const rescheduleMsg = `Hi ${lead_name.split(' ')[0]}! 📅 Your viewing has been rescheduled.\n\n🏠 *${property_title}*\n📅 ${dateFormatted}${location ? `\n📍 ${location}` : ''}\n\nSee you then! 😊`;
      await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
        phone_number: phone,
        message: rescheduleMsg,
      }).catch(() => null);
    }

    // Log activity
    await base44.asServiceRole.entities.LeadActivity.create({
      lead_id: event.entity_id,
      activity_type: 'booking',
      title: `Viewing ${calendarAction} in calendar`,
      body: `Appointment: ${formatUAEDate(lead.next_appointment_at)}${calendarEventId ? ` | Calendar ID: ${calendarEventId}` : ''}`,
      created_by: 'system',
      meta: { calendar_event_id: calendarEventId, wa_sent: !!phone, calendar_action: calendarAction },
    }).catch(() => null);

    return Response.json({
      status: 'success',
      calendar_action: calendarAction,
      calendar_event_id: calendarEventId,
      wa_sent: !!phone,
    });

  } catch (error) {
    console.error('autoSyncViewingCalendar error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});