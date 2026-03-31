import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Only trigger on lead updates
    if (event.type !== 'update') {
      return Response.json({ skipped: true });
    }

    const lead = data;

    // Skip if already closed or disqualified
    if (['closed_won', 'closed_lost'].includes(lead.stage)) {
      return Response.json({ skipped: true, reason: 'Deal already closed' });
    }

    // Get last activity
    const activities = await base44.asServiceRole.entities.Activity.filter(
      { lead_id: lead.id },
      '-created_date',
      1
    );

    const lastActivityDate = activities?.[0]?.created_date || lead.created_date;
    const daysSinceActivity = Math.floor(
      (new Date() - new Date(lastActivityDate)) / (1000 * 60 * 60 * 24)
    );

    // Alert if >7 days without activity
    if (daysSinceActivity > 7 && lead.assigned_agent) {
      // Update lead with inactivity flag
      await base44.asServiceRole.entities.Lead.update(lead.id, {
        inactivity_days: daysSinceActivity
      });

      // Create system alert activity
      await base44.asServiceRole.entities.Activity.create({
        lead_id: lead.id,
        type: 'system',
        title: 'Stale lead alert',
        description: `No activity for ${daysSinceActivity} days. Lead may need reassignment or re-engagement.`,
        agent_email: lead.assigned_agent
      });

      return Response.json({ 
        alert: true, 
        days_inactive: daysSinceActivity,
        agent: lead.assigned_agent 
      });
    }

    return Response.json({ skipped: true, days_since_activity: daysSinceActivity });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});