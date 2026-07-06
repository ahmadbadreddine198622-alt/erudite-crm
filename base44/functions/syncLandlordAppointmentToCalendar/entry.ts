import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// agentSignatureHtml — builds the branded email signature (name + Erudite + CTA link grid)
// appended to every outgoing system email. Mirrors src/lib/agentSignature.js on the frontend.
function agentCtaHtml(u = {}) {
  const fullName = u.full_name || '';
  const firstName = fullName.split(' ').filter(Boolean)[0] || fullName || '';
  const hasOwnPf = !!u.pf_profile_url;
  const pfUrl = u.pf_profile_url || 'https://www.propertyfinder.ae/en/agent/ahmad-badreddine-206264';
  const pfRating = u.pf_rating != null ? u.pf_rating : 4.3;
  const pfDeals = u.pf_deals_count != null ? u.pf_deals_count : 56;
  const pfValue = u.pf_deals_value_label || 'AED 100M+';
  const statLabel = u.signature_stat_label || 'AED 100M+ closed in Peninsula';
  const linkedinUrl = u.linkedin_url || 'https://www.linkedin.com/in/ahmad-badreddine';
  const eruditeListingsUrl = u.erudite_listings_url || 'https://www.eruditeproperty.com';
  const meetTeamUrl = u.meet_team_url || 'https://www.eruditeproperty.com';
  const instagramUrl = u.instagram_url || (u.instagram_handle ? `https://instagram.com/${u.instagram_handle.replace(/^@/, '')}` : 'https://instagram.com/eruditeproperty7');
  const instagramHandle = u.instagram_handle || '@eruditeproperty7';
  const pfTitle = hasOwnPf ? `${firstName} on Property Finder` : 'Ahmad on Property Finder';
  const pfSubtitle = `SuperAgent · ${pfRating}⭐ · ${pfDeals} deals · ${pfValue}`;
  const linkedinSub = u.linkedin_url ? `${firstName}'s profile` : "Ahmad's profile";
  const stat = `<div style="font-family:Arial,Helvetica,sans-serif;color:#C5A059;font-size:13px;font-weight:700;margin:14px 0 10px;">🏆 ${statLabel}</div>`;
  const card = (bg, title, sub, href, darkText, right) => {
    const tc = darkText ? '#1a1205' : '#ffffff';
    const sc = darkText ? '#5a4a1a' : '#dbe6f5';
    const pad = right ? 'padding:0 0 10px 5px;' : 'padding:0 5px 10px 0;';
    return `<td width="50%" valign="top" style="${pad}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="${bg}" style="padding:14px 16px;border-radius:12px;"><a href="${href}" target="_blank" style="text-decoration:none;display:block;"><div style="font-family:Arial,Helvetica,sans-serif;color:${tc};font-size:14px;font-weight:700;">${title}</div><div style="font-family:Arial,Helvetica,sans-serif;color:${sc};font-size:11px;margin-top:3px;">${sub}</div></a></td></tr></table></td>`;
  };
  const linkedinCard = `<td colspan="2" valign="top" style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="#2D77E8" style="padding:14px 16px;border-radius:12px;"><a href="${linkedinUrl}" target="_blank" style="text-decoration:none;display:block;"><div style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:14px;font-weight:700;">💼 LinkedIn →</div><div style="font-family:Arial,Helvetica,sans-serif;color:#d4e6ff;font-size:11px;margin-top:3px;">${linkedinSub}</div></a></td></tr></table></td>`;
  const cta = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr>${card('#233552', `⭐ ${pfTitle} →`, pfSubtitle, pfUrl, false, false)}${card('#C5A059', '🏛 Erudite Listings →', 'All live listings for sale', eruditeListingsUrl, true, true)}</tr><tr>${card('#10A492', '👥 Meet the Team →', 'eruditeproperty.com', meetTeamUrl, false, false)}${card('#D7338C', '📷 Instagram →', instagramHandle, instagramUrl, false, true)}</tr><tr>${linkedinCard}</tr></table>`;
  return [stat, cta].filter(Boolean).join('');
}
function agentSignatureHtml(u = {}) {
  const fullName = u.full_name || '';
  const cta = agentCtaHtml(u);
  return `<div style="margin-top:18px;border-top:1px solid #eee;padding-top:14px;font-family:Arial,Helvetica,sans-serif;"><p style="margin:0 0 2px;color:#1e293b;font-size:14px;">Best regards,</p><p style="margin:0 0 2px;color:#1e293b;font-size:15px;font-weight:700;">${fullName || 'Erudite Real Estate'}</p><p style="margin:0 0 10px;color:#C5A059;font-size:13px;font-weight:600;">Erudite Real Estate</p>${cta}</div>`;
}

// syncLandlordAppointmentToCalendar — pushes a LandlordAppointment to Google Calendar.
//
// Mirrors the working syncLeadToCalendar: builds a naive Asia/Dubai wall-clock window so
// there is no +4h drift, and is idempotent via google_event_id (update in place, never
// duplicate). Fired by an entity automation on LandlordAppointment create/update.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    const appt = data;
    const apptId = event.entity_id;

    if (!appt || !appt.datetime) {
      return Response.json({ status: 'skipped', reason: 'missing_datetime' });
    }
    // Don't put cancelled appointments on the calendar.
    if (appt.status === 'cancelled') {
      return Response.json({ status: 'skipped', reason: 'cancelled' });
    }

    // Pull the parent landlord for a meaningful event title.
    let landlordName = 'Landlord';
    if (appt.landlord_id) {
      try {
        const ll = await base44.asServiceRole.entities.Landlord.get(appt.landlord_id);
        landlordName = ll?.full_name_en || ll?.full_name_ar || landlordName;
      } catch (_) { /* best-effort */ }
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

    // Convert the stored instant to a naive Asia/Dubai wall-clock string (UTC+4, no DST),
    // then attach timeZone: 'Asia/Dubai' — same drift-free approach as the Leads sync.
    const startMs = new Date(appt.datetime).getTime();
    const durationMin = Number(appt.duration_minutes) > 0 ? Number(appt.duration_minutes) : 30;
    const pad = (n) => String(n).padStart(2, '0');
    const toDubaiWall = (ms) => {
      const d = new Date(ms + 4 * 60 * 60000); // shift into UTC+4, then read UTC fields as wall-clock
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
    };
    const startWall = toDubaiWall(startMs);
    const endWall = toDubaiWall(startMs + durationMin * 60000);

    const description = [
      `Type: ${appt.type || 'N/A'}`,
      `Channel: ${appt.channel || 'N/A'}`,
      `Agent: ${appt.agent_email || 'N/A'}`,
      `Location: ${appt.location || 'N/A'}`,
      `Notes: ${appt.notes || 'N/A'}`,
      `Status: ${appt.status || 'scheduled'}`,
    ].join('\n');

    // Pull the landlord's email so they're invited too (lands on their calendar + Google invite).
    let landlordEmail = null;
    if (appt.landlord_id) {
      try {
        const ll2 = await base44.asServiceRole.entities.Landlord.get(appt.landlord_id);
        landlordEmail = ll2?.email || null;
      } catch (_) { /* best-effort */ }
    }
    const attendees = [];
    if (appt.agent_email) attendees.push({ email: appt.agent_email });
    if (landlordEmail) attendees.push({ email: landlordEmail });

    // Add the acting agent + landlord as attendees so the event lands on both calendars.
    const event_data = {
      summary: `${(appt.type || 'meeting')} — ${landlordName}`,
      description,
      start: { dateTime: startWall, timeZone: 'Asia/Dubai' },
      end: { dateTime: endWall, timeZone: 'Asia/Dubai' },
      ...(attendees.length ? { attendees } : {}),
    };

    const authHeaders = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
    const baseUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

    const createEvent = async () => {
      const response = await fetch(`${baseUrl}?sendUpdates=all`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(event_data),
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Failed to create calendar event: ${err}`);
      }
      const created = await response.json();
      await base44.asServiceRole.entities.LandlordAppointment.update(apptId, { google_event_id: created.id });
      return created.id;
    };

    const existingEventId = appt.google_event_id || null;

    if (existingEventId) {
      const patchRes = await fetch(`${baseUrl}/${encodeURIComponent(existingEventId)}?sendUpdates=all`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify(event_data),
      });
      if (patchRes.ok) {
        const updated = await patchRes.json();
        return Response.json({ status: 'updated', event_id: updated.id });
      }
      // Stored event was deleted in Google — create a fresh one.
      if (patchRes.status === 404 || patchRes.status === 410) {
        const newId = await createEvent();
        return Response.json({ status: 'created', event_id: newId });
      }
      const err = await patchRes.text();
      return Response.json({ error: 'Failed to update calendar event', details: err }, { status: 500 });
    }

    const newId = await createEvent();

    // Send a confirmation email to the landlord on first creation.
    if (landlordEmail && !appt.confirmation_email_sent) {
      const dateFormatted = new Date(appt.datetime).toLocaleString('en-GB', {
        timeZone: 'Asia/Dubai', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      let agentUser = null;
      if (appt.agent_email) {
        try {
          const ua = await base44.asServiceRole.entities.User.filter({ email: appt.agent_email });
          if (ua && ua.length) agentUser = ua[0];
        } catch (_) { /* best-effort */ }
      }
      const emailBody = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;font-size:14px;line-height:1.6;"><p style="margin:0 0 10px;">Hi ${landlordName},</p><p style="margin:0 0 10px;">We've scheduled a ${appt.type || 'meeting'} with you:</p><p style="margin:0 0 6px;">📅 ${dateFormatted}</p><p style="margin:0 0 10px;">📍 ${appt.location || 'N/A'}</p><p style="margin:0 0 10px;">Please reply to confirm you're available, or let us know if you'd like to reschedule.</p>${agentSignatureHtml(agentUser || {})}</div>`;
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: landlordEmail,
        subject: `Please confirm your appointment — ${dateFormatted}`,
        body: emailBody,
      }).catch(() => null);
      await base44.asServiceRole.entities.LandlordAppointment.update(apptId, { confirmation_email_sent: true });
    }

    return Response.json({ status: 'created', event_id: newId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});