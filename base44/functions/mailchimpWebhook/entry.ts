import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Mailchimp webhook receiver. Events: subscribe, unsubscribe, profile, upemail, cleaned.
 * Set the webhook URL in Mailchimp → Audience → Settings → Webhooks.
 *
 * Body is application/x-www-form-urlencoded with array-style keys.
 * Mailchimp also pings with empty body for validation — we respond 200 to those.
 */

Deno.serve(async (req) => {
  try {
    if (req.method === 'GET') return new Response('ok'); // webhook URL validation

    const base44 = createClientFromRequest(req);
    const text = await req.text();
    const params = new URLSearchParams(text);

    const type = params.get('type');
    const email = params.get('data[email]');
    if (!email) return Response.json({ ignored: 'no_email' });

    // Match by email
    const leads = await base44.asServiceRole.entities.Lead.filter({ email });
    const lead = leads?.[0];
    if (!lead) return Response.json({ ignored: 'no_matching_lead', email });

    const event = {
      subscribe: 'opted_in_to_marketing',
      unsubscribe: 'opted_out_of_marketing',
      cleaned: 'email_bounced',
      profile: 'profile_updated',
      upemail: 'email_changed'
    }[type || ''] || type;

    await base44.asServiceRole.entities.Activity.create({
      lead_id: lead.id,
      type: 'email',
      title: `Mailchimp: ${event}`,
      description: `Email event ${type} for ${email}`,
      source: 'mailchimp',
      metadata: Object.fromEntries(params.entries())
    });

    if (type === 'unsubscribe') {
      await base44.asServiceRole.entities.Lead.update(lead.id, {
        marketing_consent: false,
        do_not_email: true
      });
    }

    return Response.json({ ok: true });
  } catch (error: any) {
    console.error('mailchimpWebhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
