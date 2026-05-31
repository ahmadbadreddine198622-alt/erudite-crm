import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Automated WhatsApp response engine.
 *
 * After a lead is routed:
 *  1. Check UAE business hours (Sun–Thu 09:00–18:00, Fri 09:00–13:00 GST/UTC+4)
 *  2. Find the best matching property listing based on budget + preferred locations
 *  3. Compose a personalized reply = Claude suggested_first_reply + property link
 *  4. If within hours: send immediately via sendWhatsAppMessage
 *  5. If outside hours: queue a ScheduledMessage for next business opening
 *
 * Body: {
 *   lead_id, phone_e164, suggested_reply, language,
 *   budget_min?, budget_max?, preferred_locations?, intent,
 *   lead_name?
 * }
 */

const UAE_UTC_OFFSET = 4; // GST = UTC+4

// Returns current time in UAE as a Date-like object
function uaeNow() {
  const now = new Date();
  now.setUTCHours(now.getUTCHours() + UAE_UTC_OFFSET);
  return now; // NOTE: still a UTC Date but shifted so .getUTCHours() == UAE local hour
}

/**
 * Returns true if current UAE time is within business hours.
 * Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
 * Business: Sun–Thu 09:00–18:00, Fri 09:00–13:00, Sat closed.
 */
function isBusinessHours() {
  const t = uaeNow();
  const day = t.getUTCDay();
  const hour = t.getUTCHours();
  const minute = t.getUTCMinutes();
  const timeMin = hour * 60 + minute;

  if (day === 6) return false; // Saturday — closed
  if (day === 5) return timeMin >= 9 * 60 && timeMin < 13 * 60; // Friday morning only
  return timeMin >= 9 * 60 && timeMin < 18 * 60; // Sun–Thu
}

/**
 * Returns an ISO datetime for next business day opening (09:00 UAE / 05:00 UTC).
 */
function nextBusinessOpen() {
  const t = uaeNow();
  let day = t.getUTCDay();
  // Advance to next valid business day
  let daysAhead = 1;
  for (let i = 0; i < 7; i++) {
    const candidate = (day + i + 1) % 7;
    if (candidate !== 6) { // not Saturday
      daysAhead = i + 1;
      break;
    }
  }
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + daysAhead);
  next.setUTCHours(5, 0, 0, 0); // 09:00 UAE = 05:00 UTC
  return next.toISOString();
}

/**
 * Find the best matching property from PFListing or Property entity.
 * Returns { title, price_aed, location, url } or null.
 */
async function findMatchingProperty(base44, intent, budgetMin, budgetMax, preferredLocations) {
  try {
    const listingType = intent === 'tenant' ? 'rent' : 'sale';
    const filter = { listing_type: listingType, status: 'active' };

    // Try PFListing first (has pf_url)
    let listings = await base44.asServiceRole.entities.PFListing.filter(filter, '-views_count', 100).catch(() => []);

    if (!listings || listings.length === 0) {
      // Fallback to internal Property entity
      const props = await base44.asServiceRole.entities.Property.filter({ listing_type: listingType, status: 'available' }, '-views_count', 100).catch(() => []);
      listings = props.map(p => ({
        title: p.title,
        price: p.price_aed,
        location: p.location,
        bedrooms: p.bedrooms,
        pf_url: null,
        id: p.id,
      }));
    }

    if (!listings || listings.length === 0) return null;

    // Score each listing
    const scored = listings.map(l => {
      let score = 0;
      const price = l.price || l.price_aed || 0;

      // Budget match
      const min = budgetMin || 0;
      const max = budgetMax || Infinity;
      if (price >= min && price <= max) score += 50;
      else if (price >= min * 0.8 && price <= max * 1.2) score += 25; // within 20%

      // Location match
      if (preferredLocations && preferredLocations.length > 0) {
        const loc = (l.location || '').toLowerCase();
        const hit = preferredLocations.some(pl => loc.includes(pl.toLowerCase()) || pl.toLowerCase().includes(loc));
        if (hit) score += 40;
      }

      // Boost featured/verified
      if (l.featured) score += 5;
      if (l.verified) score += 3;

      return { ...l, _score: score };
    });

    scored.sort((a, b) => b._score - a._score);
    const best = scored[0];
    if (best._score === 0) return null; // no meaningful match

    return {
      title: best.title || `${best.bedrooms}BR in ${best.location}`,
      price_aed: best.price || best.price_aed,
      location: best.location,
      url: best.pf_url || null,
    };
  } catch {
    return null;
  }
}

/** Format AED price nicely */
function fmtPrice(aed) {
  if (!aed) return '';
  if (aed >= 1_000_000) return `AED ${(aed / 1_000_000).toFixed(1)}M`;
  if (aed >= 1_000) return `AED ${Math.round(aed / 1000)}K`;
  return `AED ${aed}`;
}

/** Build the outbound message */
function buildMessage(suggestedReply, property, language) {
  let msg = suggestedReply || 'Thank you for reaching out! Our team will be with you shortly.';

  if (property) {
    const priceStr = property.price_aed ? ` — ${fmtPrice(property.price_aed)}` : '';
    const link = property.url ? `\n🔗 ${property.url}` : '';

    if (language === 'ar') {
      msg += `\n\n🏠 بناءً على اهتمامك، إليك عقار مناسب:\n*${property.title}* في ${property.location}${priceStr}${link}`;
    } else {
      msg += `\n\n🏠 Based on your criteria, here's a top match:\n*${property.title}* in ${property.location}${priceStr}${link}`;
    }
  }

  return msg;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const {
      lead_id,
      phone_e164,
      suggested_reply,
      language = 'en',
      budget_min,
      budget_max,
      preferred_locations = [],
      intent = 'buyer',
      lead_name = 'there',
    } = await req.json();

    if (!phone_e164) {
      return Response.json({ error: 'phone_e164 required' }, { status: 400 });
    }

    // 1. Find best matching property
    const property = await findMatchingProperty(base44, intent, budget_min, budget_max, preferred_locations);

    // 2. Build personalized message
    const message = buildMessage(suggested_reply, property, language);

    // 3. Check business hours
    const withinHours = isBusinessHours();

    if (withinHours) {
      // Send immediately
      await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
        phone_number: phone_e164,
        message,
      });

      // Log activity on lead
      if (lead_id) {
        await base44.asServiceRole.entities.LeadActivity.create({
          lead_id,
          activity_type: 'whatsapp',
          title: 'Auto-reply sent via WhatsApp',
          body: message,
          created_by: 'system',
          meta: { auto_reply: true, property_matched: !!property, language },
        }).catch(() => null);
      }

      return Response.json({
        sent: true,
        scheduled: false,
        property_matched: !!property,
        property_title: property?.title || null,
        message_preview: message.slice(0, 120),
      });

    } else {
      // Outside business hours — queue for next opening
      const scheduledAt = nextBusinessOpen();

      await base44.asServiceRole.entities.ScheduledMessage.create({
        recipient_phone: phone_e164,
        recipient_name: lead_name,
        lead_id: lead_id || null,
        message_body: message,
        scheduled_at: scheduledAt,
        status: 'pending',
        template_name: 'auto_reply_on_routing',
      });

      return Response.json({
        sent: false,
        scheduled: true,
        scheduled_at: scheduledAt,
        property_matched: !!property,
        message_preview: message.slice(0, 120),
      });
    }

  } catch (error) {
    console.error('sendAutoWhatsAppReply error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});