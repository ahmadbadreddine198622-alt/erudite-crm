import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Only trigger on offer updates
    if (event.type !== 'update') {
      return Response.json({ skipped: true });
    }

    const offer = data;

    // Skip if already closed or alert already sent
    if (['accepted', 'rejected', 'expired'].includes(offer.status) || offer.expiration_alert_sent) {
      return Response.json({ skipped: true });
    }

    if (!offer.expires_at) {
      return Response.json({ skipped: true, reason: 'No expiration date' });
    }

    const now = new Date();
    const expiresAt = new Date(offer.expires_at);
    const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);

    // Alert if expires within 24 hours
    if (hoursUntilExpiry <= 24 && hoursUntilExpiry > 0) {
      // Update offer to flag alert was sent
      await base44.asServiceRole.entities.Offer.update(offer.id, {
        expiration_alert_sent: true
      });

      // Create activity alert
      await base44.asServiceRole.entities.Activity.create({
        lead_id: offer.lead_id,
        property_id: offer.property_id,
        type: 'system',
        title: 'Offer expiration alert',
        description: `Offer for ${offer.property_title} expires in ${Math.ceil(hoursUntilExpiry)} hours (${offer.offer_amount_aed} AED). Follow up urgently.`,
        agent_email: offer.agent_email
      });

      return Response.json({ 
        alert: true, 
        hours_until_expiry: hoursUntilExpiry,
        offer_id: offer.id 
      });
    }

    // Mark as expired if past expiration
    if (hoursUntilExpiry <= 0 && offer.status === 'submitted') {
      await base44.asServiceRole.entities.Offer.update(offer.id, {
        status: 'expired',
        expiration_alert_sent: true
      });

      await base44.asServiceRole.entities.Activity.create({
        lead_id: offer.lead_id,
        property_id: offer.property_id,
        type: 'system',
        title: 'Offer expired',
        description: `Offer for ${offer.property_title} (${offer.offer_amount_aed} AED) has expired.`,
        agent_email: offer.agent_email
      });

      return Response.json({ expired: true, offer_id: offer.id });
    }

    return Response.json({ skipped: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});