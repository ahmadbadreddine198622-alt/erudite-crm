import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Automatically creates follow-up Reminder tasks when a lead's stage changes.
 * Triggered by entity automation on Lead update.
 */

// Stage → array of task templates
// due_hours: hours from now to set the due date
const STAGE_TASKS = {
  // ─── Buyer pipeline ───
  financial_qualification: [
    { title: 'Request proof of funds / pre-approval letter', type: 'follow_up', priority: 'high', due_hours: 24 },
    { title: 'Follow up on mortgage pre-approval status', type: 'follow_up', priority: 'medium', due_hours: 72 },
  ],
  intent_lock: [
    { title: 'Confirm buyer / tenant intent in writing', type: 'follow_up', priority: 'high', due_hours: 24 },
    { title: 'Send personalised property shortlist', type: 'follow_up', priority: 'medium', due_hours: 48 },
  ],
  unit_matching: [
    { title: 'Send curated property listings to client', type: 'follow_up', priority: 'high', due_hours: 4 },
    { title: 'Schedule property viewing appointments', type: 'viewing', priority: 'high', due_hours: 48 },
  ],
  viewing: [
    { title: 'Call client for viewing feedback', type: 'follow_up', priority: 'urgent', due_hours: 24 },
    { title: 'Send property comparison summary', type: 'follow_up', priority: 'medium', due_hours: 48 },
    { title: 'Schedule second viewing if interested', type: 'viewing', priority: 'low', due_hours: 72 },
  ],
  objection_offer: [
    { title: 'Address client objections — prepare counter-offer', type: 'follow_up', priority: 'urgent', due_hours: 4 },
    { title: 'Share comparable sales data to support price', type: 'follow_up', priority: 'high', due_hours: 24 },
  ],
  negotiation_deal_lock: [
    { title: 'Draft MOU / LOI for client review', type: 'follow_up', priority: 'urgent', due_hours: 8 },
    { title: 'Confirm final agreed price with both parties', type: 'follow_up', priority: 'urgent', due_hours: 4 },
    { title: 'Prepare commission agreement', type: 'follow_up', priority: 'high', due_hours: 24 },
  ],
  closing_dld: [
    { title: 'Prepare DLD transfer paperwork', type: 'follow_up', priority: 'urgent', due_hours: 24 },
    { title: 'Confirm NOC and mortgage clearance', type: 'follow_up', priority: 'high', due_hours: 48 },
    { title: 'Book DLD trustee appointment', type: 'follow_up', priority: 'high', due_hours: 48 },
  ],
  closed: [
    { title: 'Send congratulations message to client', type: 'follow_up', priority: 'medium', due_hours: 2 },
    { title: 'Request client testimonial / referral', type: 'follow_up', priority: 'low', due_hours: 168 }, // 1 week
    { title: 'Log commission and raise invoice', type: 'custom', priority: 'high', due_hours: 24 },
  ],
  // ─── Tenant pipeline ───
  new_tenant_lead: [
    { title: 'Qualify tenant — budget, move-in date, preferences', type: 'follow_up', priority: 'high', due_hours: 24 },
  ],
  qualified_tenant: [
    { title: 'Send shortlisted rental units', type: 'follow_up', priority: 'high', due_hours: 8 },
    { title: 'Schedule viewing for top unit choices', type: 'viewing', priority: 'high', due_hours: 48 },
  ],
  viewing_decision: [
    { title: 'Follow up after viewing — get tenant decision', type: 'follow_up', priority: 'urgent', due_hours: 24 },
    { title: 'Negotiate any rent reduction or inclusions', type: 'follow_up', priority: 'medium', due_hours: 48 },
  ],
  contract_cheques: [
    { title: 'Collect tenancy cheques and security deposit', type: 'follow_up', priority: 'urgent', due_hours: 24 },
    { title: 'Draft and send tenancy agreement for signature', type: 'follow_up', priority: 'urgent', due_hours: 8 },
    { title: 'Verify tenant ID and Emirates ID', type: 'follow_up', priority: 'high', due_hours: 48 },
  ],
  ejari_movein: [
    { title: 'Register Ejari with RERA', type: 'follow_up', priority: 'urgent', due_hours: 48 },
    { title: 'Coordinate key handover with landlord', type: 'follow_up', priority: 'urgent', due_hours: 48 },
    { title: 'DEWA connection setup follow-up', type: 'follow_up', priority: 'medium', due_hours: 72 },
  ],
  // ─── Landlord pipeline ───
  price_discovery: [
    { title: 'Prepare Comparative Market Analysis (CMA) report', type: 'follow_up', priority: 'high', due_hours: 24 },
    { title: 'Present pricing recommendation to landlord', type: 'follow_up', priority: 'high', due_hours: 48 },
  ],
  form_a_signing: [
    { title: 'Chase Form A signature from landlord', type: 'follow_up', priority: 'urgent', due_hours: 8 },
    { title: 'Collect owner documents (Title Deed, EID, Passport)', type: 'follow_up', priority: 'high', due_hours: 48 },
  ],
  photos_videos: [
    { title: 'Schedule professional photographer', type: 'custom', priority: 'high', due_hours: 48 },
    { title: 'Confirm access / key collection for photoshoot', type: 'follow_up', priority: 'medium', due_hours: 24 },
  ],
  listing_publication: [
    { title: 'Verify listing is live on Property Finder / Bayut', type: 'follow_up', priority: 'high', due_hours: 4 },
    { title: 'Share listing link with landlord for review', type: 'follow_up', priority: 'medium', due_hours: 8 },
  ],
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    // Automation payload: { event, data, old_data, changed_fields }
    const { data: lead, old_data, changed_fields = [] } = payload;

    // Only act if stage actually changed
    if (!changed_fields.includes('stage') || !lead || !lead.stage) {
      return Response.json({ skipped: true, reason: 'stage not changed' });
    }

    const newStage = lead.stage;
    const oldStage = old_data?.stage;
    const tasks = STAGE_TASKS[newStage];

    if (!tasks || tasks.length === 0) {
      return Response.json({ skipped: true, reason: `no tasks defined for stage: ${newStage}` });
    }

    const now = new Date();
    const leadName = lead.full_name || lead.name || 'Lead';
    const assignedTo = lead.assigned_agent_email || lead.created_by || null;

    // Deduplicate: don't create tasks that already exist for this stage/lead in the last hour
    const recentReminders = await base44.asServiceRole.entities.Reminder.filter(
      { lead_id: lead.id, status: 'pending' }, '-created_date', 50
    ).catch(() => []);

    const existingTitles = new Set(recentReminders.map(r => r.title));

    const created = [];
    for (const task of tasks) {
      if (existingTitles.has(task.title)) continue; // skip duplicates

      const dueDate = new Date(now.getTime() + task.due_hours * 3600 * 1000);

      const reminder = await base44.asServiceRole.entities.Reminder.create({
        title: task.title,
        notes: `Auto-created when ${leadName} moved to stage: ${newStage}${oldStage ? ` (from ${oldStage})` : ''}`,
        due_date: dueDate.toISOString(),
        priority: task.priority,
        status: 'pending',
        type: task.type,
        lead_id: lead.id,
        lead_name: leadName,
        assigned_to: assignedTo,
        source: 'ai_suggested',
        tags: ['auto', newStage],
      });
      created.push(reminder.id);
    }

    // Log a single activity entry on the lead
    if (created.length > 0) {
      await base44.asServiceRole.entities.LeadActivity.create({
        lead_id: lead.id,
        activity_type: 'system',
        title: `${created.length} task${created.length > 1 ? 's' : ''} auto-created for stage: ${newStage}`,
        body: tasks.slice(0, created.length).map(t => `• ${t.title}`).join('\n'),
        created_by: 'system',
        meta: { stage: newStage, old_stage: oldStage, task_count: created.length },
      }).catch(() => null);
    }

    return Response.json({ ok: true, stage: newStage, tasks_created: created.length, task_ids: created });
  } catch (error) {
    console.error('autoCreateStageTasks:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});