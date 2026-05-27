import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Trigger a Mailchimp Customer Journey for a specific lead.
 *
 * Body: { lead_id, journey_id?, step_id?, journey_name? }
 *   - journey_id + step_id can be looked up by journey_name from credentials
 *
 * The lead must already exist in the audience (call mailchimpSyncContact first).
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lead_id, journey_id, step_id, journey_name } = await req.json();
    if (!lead_id) return Response.json({ error: 'lead_id required' }, { status: 400 });

    const lead = await base44.asServiceRole.entities.Lead.get(lead_id);
    if (!lead?.email) return Response.json({ error: 'Lead has no email' }, { status: 400 });

    const cred = (await base44.asServiceRole.entities.MailchimpCredential.list())?.[0];
    if (!cred || !cred.is_connected) return Response.json({ error: 'Mailchimp not connected' }, { status: 400 });

    let resolvedJourneyId = journey_id;
    let resolvedStepId = step_id;
    if (!resolvedJourneyId && journey_name) {
      const j = cred.drip_campaigns?.find((c: any) => c.name === journey_name);
      if (j) { resolvedJourneyId = j.journey_id; resolvedStepId = j.step_id; }
    }
    if (!resolvedJourneyId || !resolvedStepId) {
      return Response.json({ error: 'journey_id and step_id (or journey_name) required' }, { status: 400 });
    }

    const apiKey = cred.api_key || Deno.env.get('MAILCHIMP_API_KEY');
    const dc = cred.server_prefix || apiKey.split('-')[1];

    const res = await fetch(
      `https://${dc}.api.mailchimp.com/3.0/customer-journeys/journeys/${resolvedJourneyId}/steps/${resolvedStepId}/actions/trigger`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`anystring:${apiKey}`)}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email_address: lead.email })
      }
    );

    if (!res.ok && res.status !== 204) {
      const err = await res.text();
      return Response.json({ error: `Mailchimp journey: ${res.status} ${err}` }, { status: res.status });
    }

    await base44.asServiceRole.entities.Activity.create({
      lead_id,
      type: 'email',
      direction: 'outbound',
      title: `Mailchimp drip started${journey_name ? `: ${journey_name}` : ''}`,
      description: `Lead added to Customer Journey ${resolvedJourneyId} step ${resolvedStepId}`,
      source: 'mailchimp',
      metadata: { journey_id: resolvedJourneyId, step_id: resolvedStepId }
    });

    return Response.json({ ok: true });
  } catch (error: any) {
    console.error('mailchimpTriggerCampaign error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
