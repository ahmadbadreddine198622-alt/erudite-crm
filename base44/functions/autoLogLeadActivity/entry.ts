import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Called by entity automation when a Lead is updated.
// Checks changed_fields and logs LeadActivity entries for stage, assignment, status changes.

const STAGE_LABELS = {
  contact_identity: 'Contact & Identity',
  financial_qualification: 'Financial Qualification',
  intent_lock: 'Intent Lock',
  unit_matching: 'Unit Matching & Presentation',
  viewing: 'Viewing',
  objection_offer: 'Objection Handling & Offer',
  negotiation_deal_lock: 'Negotiation & Deal Lock',
  closing_dld: 'Closing & DLD',
  closed: 'Closed',
  new_tenant_lead: 'New Tenant Lead',
  qualified_tenant: 'Qualified Tenant',
  viewing_decision: 'Viewing Decision',
  contract_cheques: 'Contract & Cheques',
  ejari_movein: 'Ejari & Move-In',
  intake_clarify: 'Intake / Clarify',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { event, data, old_data, changed_fields } = payload;

    if (!data || !data.id) {
      return Response.json({ ok: true, skipped: 'no data' });
    }

    const activitiesToCreate = [];

    if (changed_fields && changed_fields.includes('stage') && old_data && old_data.stage !== data.stage) {
      const oldLabel = STAGE_LABELS[old_data.stage] || old_data.stage || 'unknown';
      const newLabel = STAGE_LABELS[data.stage] || data.stage || 'unknown';
      activitiesToCreate.push({
        lead_id: data.id,
        activity_type: 'stage_change',
        title: `Moved to ${newLabel}`,
        body: `Previously in: ${oldLabel}`,
        created_by: data.assigned_agent_name || 'System',
        meta: { old_stage: old_data.stage, new_stage: data.stage },
      });
    }

    if (changed_fields && changed_fields.includes('assigned_agent_email') && old_data && old_data.assigned_agent_email !== data.assigned_agent_email) {
      activitiesToCreate.push({
        lead_id: data.id,
        activity_type: 'assignment_change',
        title: `Assigned to ${data.assigned_agent_name || data.assigned_agent_email || 'agent'}`,
        body: old_data.assigned_agent_email
          ? `Previously assigned to ${old_data.assigned_agent_name || old_data.assigned_agent_email}`
          : 'New assignment',
        created_by: 'System',
        meta: { old_agent: old_data.assigned_agent_email, new_agent: data.assigned_agent_email },
      });
    }

    if (changed_fields && changed_fields.includes('status') && old_data && old_data.status !== data.status) {
      const statusLabels = { active: 'Active', lost: 'Lost', on_hold: 'On Hold' };
      activitiesToCreate.push({
        lead_id: data.id,
        activity_type: 'field_change',
        title: `Status changed to ${statusLabels[data.status] || data.status}`,
        body: old_data.status ? `Previously: ${statusLabels[old_data.status] || old_data.status}` : '',
        created_by: 'System',
        meta: { field: 'status', old_value: old_data.status, new_value: data.status },
      });
    }

    for (const activity of activitiesToCreate) {
      await base44.asServiceRole.entities.LeadActivity.create(activity);
    }

    return Response.json({ ok: true, created: activitiesToCreate.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});