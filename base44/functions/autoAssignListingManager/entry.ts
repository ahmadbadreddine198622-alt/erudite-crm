// autoAssignListingManager
// Triggered by entity automation on Landlord update.
// 1. If stage just changed TO 'listing_creation' AND listing_manager_email is empty → assign to Ajwa
//    and set listing_production_stage = 'received' on the linked LandlordProperty (only if unset).
// 2. If listing_manager_email just changed TO 'ajwa@erudite-estate.com' (from empty) → send email notification.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const AJWA_EMAIL = 'ajwa@erudite-estate.com';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { data, old_data, changed_fields } = payload;
    if (!data?.id) return Response.json({ ok: true, skipped: 'no data' });

    const landlord = data;
    const prev = old_data || {};

    const actions = [];

    // ── PART 1: Auto-assign when stage changes to listing_creation ──
    const stageChangedToListingCreation =
      changed_fields?.includes('stage') &&
      landlord.stage === 'listing_creation' &&
      prev.stage !== 'listing_creation';

    if (stageChangedToListingCreation && !landlord.listing_manager_email) {
      // Set listing_manager_email on Landlord
      await base44.asServiceRole.entities.Landlord.update(landlord.id, {
        listing_manager_email: AJWA_EMAIL,
      });
      actions.push('auto_assigned_listing_manager');

      // Set listing_production_stage = 'received' on linked LandlordProperty ONLY if unset
      const props = await base44.asServiceRole.entities.LandlordProperty.filter({ landlord_id: landlord.id });
      const lp = props[0];
      if (lp && !lp.listing_production_stage) {
        await base44.asServiceRole.entities.LandlordProperty.update(lp.id, {
          listing_production_stage: 'received',
        });
        actions.push('set_production_stage_received');
      }

      // Override landlord data for email notification below
      landlord.listing_manager_email = AJWA_EMAIL;
    }

    // ── PART 2: Email Ajwa on assignment (any path) ──
    // Fire when listing_manager_email transitions from empty → Ajwa
    const wasEmpty = !prev.listing_manager_email || prev.listing_manager_email.trim() === '';
    const isNowAjwa = landlord.listing_manager_email === AJWA_EMAIL;
    const assignmentChanged = changed_fields?.includes('listing_manager_email') || actions.includes('auto_assigned_listing_manager');

    if (assignmentChanged && wasEmpty && isNowAjwa) {
      const project = landlord.project_name || '(no project)';
      const unit = landlord.unit_reference || '(no unit)';
      const owner = landlord.full_name_en || landlord.full_name || '(unknown owner)';
      const agent = landlord.assigned_agent_email || '(unassigned)';

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: AJWA_EMAIL,
        subject: `New listing assigned: ${project} ${unit}`,
        body: `Hi Ajwa,\n\nA new unit has been assigned to you for listing production.\n\nOwner: ${owner}\nProject: ${project}\nUnit: ${unit}\nAssigned Agent: ${agent}\n\nView your queue: https://app.base44.com/listing-production\n\nPropCRM`,
      });
      actions.push('email_sent');
    }

    return Response.json({ ok: true, actions });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});