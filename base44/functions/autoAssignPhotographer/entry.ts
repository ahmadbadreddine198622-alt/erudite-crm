import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Auto-assigns Dari as photographer when a landlord enters the photography stages.
 *
 * Triggered by entity automation on Landlord update (stage change to
 * 'photos_videos' or 'photographer_scheduling').
 *
 * - Finds or creates a PhotographyTask for the landlord's LandlordProperty.
 * - Sets assigned_photographer_email to Dari (dari@erudite-estate.com) if unassigned.
 * - Idempotent: won't overwrite an existing photographer assignment.
 */

const DEFAULT_PHOTOGRAPHER = 'dari@erudite-estate.com';
const PHOTOGRAPHY_STAGES = ['photos_videos', 'photographer_scheduling'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { data: landlord, old_data, changed_fields = [] } = payload;

    // Only act if stage actually changed
    if (!changed_fields.includes('stage') || !landlord || !landlord.stage) {
      return Response.json({ skipped: true, reason: 'stage not changed' });
    }

    const newStage = landlord.stage;
    if (!PHOTOGRAPHY_STAGES.includes(newStage)) {
      return Response.json({ skipped: true, reason: `stage ${newStage} is not a photography stage` });
    }

    // Find the landlord's LandlordProperty
    const properties = await base44.asServiceRole.entities.LandlordProperty.filter({ landlord_id: landlord.id });
    const lp = properties?.[0];
    if (!lp) {
      return Response.json({ skipped: true, reason: 'no LandlordProperty found for this landlord' });
    }

    // Check if a PhotographyTask already exists
    const existingTasks = await base44.asServiceRole.entities.PhotographyTask.filter({ landlord_id: landlord.id });
    const existingTask = existingTasks?.[0];

    if (existingTask) {
      // Task exists — only set photographer if it's currently unassigned
      if (!existingTask.assigned_photographer_email || existingTask.assigned_photographer_email === '') {
        await base44.asServiceRole.entities.PhotographyTask.update(existingTask.id, {
          assigned_photographer_email: DEFAULT_PHOTOGRAPHER,
          assigned_at: new Date().toISOString(),
        });
        // Instant WhatsApp + Email to the photographer (non-fatal)
        try {
          await base44.functions.invoke('notifyPhotographyEvent', { task_id: existingTask.id, event: 'task_assigned' });
        } catch (notifyErr) {
          console.error('notifyPhotographyEvent failed:', notifyErr.message);
        }
        return Response.json({ ok: true, action: 'assigned_existing', task_id: existingTask.id, photographer: DEFAULT_PHOTOGRAPHER });
      }
      // Already has a photographer — don't override
      return Response.json({ skipped: true, reason: 'photographer already assigned', existing_photographer: existingTask.assigned_photographer_email });
    }

    // Create a new PhotographyTask assigned to Dari
    const newTask = await base44.asServiceRole.entities.PhotographyTask.create({
      landlord_id: landlord.id,
      landlord_property_id: lp.id,
      assigned_photographer_email: DEFAULT_PHOTOGRAPHER,
      assigned_at: new Date().toISOString(),
      task_stage: 'inquiry',
    });

    // Instant WhatsApp + Email to the photographer (non-fatal)
    try {
      await base44.functions.invoke('notifyPhotographyEvent', { task_id: newTask.id, event: 'task_assigned' });
    } catch (notifyErr) {
      console.error('notifyPhotographyEvent failed:', notifyErr.message);
    }

    return Response.json({ ok: true, action: 'created', task_id: newTask.id, photographer: DEFAULT_PHOTOGRAPHER });
  } catch (error) {
    console.error('autoAssignPhotographer error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});