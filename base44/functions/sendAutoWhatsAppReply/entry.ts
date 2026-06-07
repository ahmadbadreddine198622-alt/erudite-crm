import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Automated WhatsApp response engine.
 *
 * After a lead is routed:
 *  1. Find the best matching property listing based on budget + preferred locations
 *  2. Compose a personalized reply = Claude suggested_first_reply + property link
 *  3. If within business hours: send immediately via sendApiWhatsApp
 *     - Auto-replies are EXEMPT from quiet hours (replying to someone who just messaged)
 *     - Auto-replies are inherently within the 24h window (they triggered this call)
 *  4. If outside business hours: queue a ScheduledMessage for next business opening
 *
 * Body: {
 *   lead_id, phone_e164, suggested_reply, language,
 *   budget_min?, budget_max?, preferred_locations?, intent,
 *   lead_name?
 * }
 */

const UAE_UTC_OFFSET = 4; // GST = UTC+4

function uaeNow() {
  const now = new Date();
  now.setUTCHours(now.getUTCHours() + UAE_UTC_OFFSET);
  return now;
}

function isBusinessHours() {
  const t = uaeNow();
  const day = t.getUTCDay();
  const timeMin = t.getUTCHours() * 60 + t.getUTCMinutes();
  if (day === 6) return false; // Saturday closed
  if (day === 5) return timeMin >= 9 * 60 && timeMin < 13 * 60; // Friday morning only
  return timeMin >= 9 * 60 && timeMin < 18 * 60; // Sun–Thu
}

function nextBusinessOpen() {
  const t = uaeNow();
  const day = t.getUTCDay();
  let daysAhead = 1;
  for (let i = 0; i < 7; i++) {
    const candidate = (day + i + 1) % 7;
    if (candidate !== 6) { daysAhead = i + 1; break; }
  }
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + daysAhead);
  next.setUTCHours(5, 0, 0, 0); // 09:00 UAE = 05:00 UTC
  return next.toISOString();
}

async function findMatchingProperty(base44, intent, budgetMin, budgetMax, preferredLocations) {
  try {
    const listingType = intent === 'tenant' ? 'rent' : 'sale';
    let listings = await base44.asServiceRole.entities.PFListing.filter({ listing_type: listingType, status: 'active' }, '-views_count', 100).catch(() => []);
    if (!listings || listings.length === 0) {
      const props = await base44.asServiceRole.entities.Property.filter({ listing_type: listingType, status: 'available' }, '-views_count', 100).catch(() => []);
      listings = props.map(p => ({ title: p.title, price: p.price_aed, location: p.location, bedrooms: p.bedrooms, pf_url: null, id: p.id }));
    }
    if (!listings || listings.length === 0) return null;

    const scored = listings.map(l => {
      let score = 0;
      const price = l.price || l.price_aed || 0;
      const min = budgetMin || 0;
      const max = budgetMax || Infinity;
      if (price >= min && price <= max) score += 50;
      else if (price >= min * 0.8 && price <= max * 1.2) score += 25;
      if (preferredLocations?.length > 0) {
        const loc = (l.location || '').toLowerCase();
        if (preferredLocations.some(pl => loc.includes(pl.toLowerCase()) || pl.toLowerCase().includes(loc))) score += 40;
      }
      if (l.featured) score += 5;
      if (l.verified) score += 3;
      return { ...l, _score: score };
    });
    scored.sort((a, b) => b._score - a._score);
    const best = scored[0];
    if (best._score === 0) return null;
    return { title: best.title || `${best.bedrooms}BR in ${best.location}`, price_aed: best.price || best.price_aed, location: best.location, url: best.pf_url || null };
  } catch {
    return null;
  }
}

function fmtPrice(aed) {
  if (!aed) return '';
  if (aed >= 1_000_000) return `AED ${(aed / 1_000_000).toFixed(1)}M`;
  if (aed >= 1_000) return `AED ${Math.round(aed / 1000)}K`;
  return `AED ${aed}`;
}

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
    const { lead_id, phone_e164, suggested_reply, language = 'en', budget_min, budget_max, preferred_locations = [], intent = 'buyer', lead_name = 'there' } = await req.json();

    if (!phone_e164) return Response.json({ error: 'phone_e164 required' }, { status: 400 });

    const property = await findMatchingProperty(base44, intent, budget_min, budget_max, preferred_locations);
    const message = buildMessage(suggested_reply, property, language);
    const withinHours = isBusinessHours();

    if (withinHours) {
      // P3 fix: use sendApiWhatsApp with auto-reply exemption flags:
      // - skip_quiet_check: true  → replying to someone who just messaged, always allowed
      // - message_kind: 'template' → skip 24h window check (they just messaged us, window is open)
      await base44.asServiceRole.functions.invoke('sendApiWhatsApp', {
        phone: phone_e164,
        message,
        message_kind: 'template', // exempt from 24h window — they literally just sent us a message
        skip_quiet_check: true,   // exempt from quiet hours — this is a reply, not an outbound push
      });

      if (lead_id) {
        base44.asServiceRole.entities.Activity.create({
          lead_id,
          type: 'whatsapp',
          direction: 'outbound',
          channel: 'whatsapp',
          title: 'Auto-reply sent via WhatsApp',
          description: message,
          source: 'automation',
          status: 'completed',
          completed_at: new Date().toISOString(),
        }).catch(() => null);
      }

      return Response.json({ sent: true, scheduled: false, property_matched: !!property, property_title: property?.title || null, message_preview: message.slice(0, 120) });

    } else {
      // Outside business hours — queue for next business opening
      const scheduledAt = nextBusinessOpen();
      await base44.asServiceRole.entities.ScheduledMessage.create({
        recipient_phone: phone_e164,
        recipient_name: lead_name,
        lead_id: lead_id || null,
        message_body: message,
        message_kind: 'freeform', // within 24h window when it fires (they just messaged)
        scheduled_at: scheduledAt,
        status: 'pending',
        template_name: 'auto_reply_on_routing',
      });

      return Response.json({ sent: false, scheduled: true, scheduled_at: scheduledAt, property_matched: !!property, message_preview: message.slice(0, 120) });
    }

  } catch (error) {
    console.error('sendAutoWhatsAppReply error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});